/* keifu （系譜） — nodes/edges JSON in, Graph / Cards / Tree out.
   Zero dependencies, no build step, single file.
   Original implementation, written for this project from its own earlier
   code (the Studio Tico LP graph and the chat-map templates). No code from
   any other graph library is used or reproduced; public API names are
   generic functional terms (mount / select / focus / fit).
   Spec: ../COMPONENT-SPEC.md — Roadmap: ../KEIFU-ROADMAP.md
     (Phase 1: programmatic control + viewport)
   Usage: keifu.mount(el, data, opts)
     data: {nodes:[{id,label,kind,group,day,meta,superseded}],
            edges:[{from,to,qty,label,type,day}],
            events:[{day,text}] (optional),
            dates:[...] (optional labels for day indices)}
     opts: {strings:{...}, colors:{kindOrGroup: cssColor},
            onSelect(id), onHover(id|null), onDragEnd(id),
            onViewChange(view), onDayChange(day), view:"graph"}
   Returns a handle: {setData, select, focus, highlight, filter,
                      expand, collapse, fit, destroy}.
*/
(function (global) {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var DEFAULT_STRINGS = {
    graph: "Graph", cards: "Cards", tree: "Tree", fit: "Fit",
    composition: "Composition", whereUsed: "Where used",
    shared: "shared", superseded: "superseded", play: "▶", pause: "❚❚"
  };
  var PALETTE = ["#d97706", "#2563eb", "#dc2626", "#059669", "#7c3aed", "#0891b2", "#be185d", "#65a30d"];

  var cssDone = false;
  function injectCSS() {
    if (cssDone) return; cssDone = true;
    var s = document.createElement("style");
    s.textContent = [
      ".kf{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--kf-fg,inherit)}",
      ".kf *{box-sizing:border-box}",
      ".kf-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px}",
      ".kf-bar button{font:inherit;padding:4px 10px;border:1px solid var(--kf-border,#8886);border-radius:999px;background:transparent;color:inherit;cursor:pointer}",
      ".kf-bar button[aria-pressed='true']{background:var(--kf-accent,#2563eb);color:var(--kf-on-accent,#fff);border-color:transparent}",
      ".kf svg{display:block;width:100%;height:auto;touch-action:none}",
      ".kf-edge{stroke:var(--kf-edge,#999);stroke-width:1.2}",
      ".kf-edge.derive{stroke-dasharray:5 4}",
      ".kf-node{cursor:pointer}",
      ".kf-node circle{stroke:#fff;stroke-width:1.5}",
      ".kf-node text{fill:var(--kf-fg,inherit);font-size:11px;text-anchor:middle;pointer-events:none}",
      ".kf-node.dim,.kf-edge.dim{opacity:.15}",
      ".kf-node.ghost{opacity:.35}",
      ".kf-node.ghost circle{stroke-dasharray:3 3}",
      ".kf-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}",
      ".kf-card{border:1px solid var(--kf-border,#8886);border-radius:10px;padding:8px 10px;cursor:pointer;text-align:left;background:transparent;color:inherit;font:inherit}",
      ".kf-card b{display:block;font-size:13px}",
      ".kf-card span{color:var(--kf-muted,#777);font-size:11px}",
      ".kf-group{grid-column:1/-1;font-size:11px;color:var(--kf-muted,#777);margin-top:6px}",
      ".kf-tree{font-size:13px}",
      ".kf-trow{padding:2px 0 2px 4px;cursor:pointer;white-space:nowrap}",
      ".kf-trow .kf-tog{display:inline-block;width:14px;color:var(--kf-muted,#777)}",
      ".kf-tkids{margin-left:16px;border-left:1px solid var(--kf-border,#8884);padding-left:6px}",
      ".kf-detail{border:1px solid var(--kf-border,#8886);border-radius:10px;padding:10px 12px;margin-top:8px}",
      ".kf-detail h4{margin:0 0 4px;font-size:13px}",
      ".kf-detail .kf-sec{margin-top:6px;font-size:11px;color:var(--kf-muted,#777)}",
      ".kf-detail ul{margin:2px 0 0;padding-left:16px}",
      ".kf-events{margin-top:8px;font-size:12px}",
      ".kf-events div{padding:2px 0}",
      ".kf-events b{margin-right:8px}",
      ".kf input[type=range]{flex:1;min-width:120px}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function mount(el, data, opts) {
    injectCSS();
    opts = opts || {};
    var S = Object.assign({}, DEFAULT_STRINGS, opts.strings || {});
    var root = document.createElement("div");
    root.className = "kf";
    el.appendChild(root);

    var W = 640, H = 420;
    var state = {
      view: opts.view || "graph", day: Infinity, selected: null,
      timer: null, raf: null,
      vb: { x: 0, y: 0, w: W },
      filterFn: null, collapsed: Object.create(null), highlightId: null
    };
    var N = [], E = [], byId = Object.create(null), days = [];
    var colorCache = Object.create(null);
    var svgEl = null;

    function colorOf(n) {
      var key = n.group || n.kind || "";
      if (opts.colors && opts.colors[key]) return opts.colors[key];
      if (!colorCache[key]) colorCache[key] = PALETTE[Object.keys(colorCache).length % PALETTE.length];
      return colorCache[key];
    }
    function childrenOf(id) { return E.filter(function (e) { return e.from === id; }); }
    function parentsOf(id) { return E.filter(function (e) { return e.to === id; }); }
    function dayOf(x) { return (x.day == null ? 0 : x.day); }

    function hiddenSet() {
      var hid = Object.create(null), q = Object.keys(state.collapsed);
      while (q.length) {
        var cur = q.shift();
        childrenOf(cur).forEach(function (e) {
          if (!hid[e.to]) { hid[e.to] = 1; q.push(e.to); }
        });
      }
      return hid;
    }
    var _hid = {};
    function visNode(n) {
      if (dayOf(n) > state.day) return false;
      if (_hid[n.id]) return false;
      if (state.filterFn && !state.filterFn(n)) return false;
      return true;
    }
    function visEdge(e) {
      return dayOf(e) <= state.day && byId[e.from] && byId[e.to] && visNode(byId[e.from]) && visNode(byId[e.to]);
    }
    function refreshVis() { _hid = hiddenSet(); }

    function load(d, keepPos) {
      var prev = Object.create(null);
      if (keepPos) N.forEach(function (n) { prev[n.id] = n; });
      data = d || { nodes: [], edges: [] };
      byId = Object.create(null); colorCache = Object.create(null);
      N = (data.nodes || []).map(function (n, i) {
        var c = Object.assign({}, n);
        var old = prev[c.id];
        if (old) { c.x = old.x; c.y = old.y; c.vx = old.vx; c.vy = old.vy; }
        else {
          var ang = (i / Math.max(1, data.nodes.length)) * Math.PI * 2;
          c.x = W / 2 + Math.cos(ang) * 150; c.y = H / 2 + Math.sin(ang) * 110;
          c.vx = 0; c.vy = 0;
        }
        c.drag = false;
        byId[c.id] = c; return c;
      });
      E = (data.edges || []).filter(function (e) { return byId[e.from] && byId[e.to]; })
        .map(function (e) { return Object.assign({}, e); });
      var ds = Object.create(null);
      N.concat(E).forEach(function (x) { ds[dayOf(x)] = 1; });
      (data.events || []).forEach(function (ev) { ds[ev.day || 0] = 1; });
      days = Object.keys(ds).map(Number).sort(function (a, b) { return a - b; });
      if (state.selected && !byId[state.selected]) state.selected = null;
      if (state.highlightId && !byId[state.highlightId]) state.highlightId = null;
      Object.keys(state.collapsed).forEach(function (k) { if (!byId[k]) delete state.collapsed[k]; });
      refreshVis();
    }

    var bar = document.createElement("div"); bar.className = "kf-bar"; root.appendChild(bar);
    var viewBtns = {};
    [["graph", S.graph], ["cards", S.cards], ["tree", S.tree]].forEach(function (pair) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = pair[1];
      b.setAttribute("aria-pressed", state.view === pair[0] ? "true" : "false");
      b.addEventListener("click", function () { setView(pair[0]); });
      viewBtns[pair[0]] = b; bar.appendChild(b);
    });
    var fitBtn = document.createElement("button");
    fitBtn.type = "button"; fitBtn.textContent = S.fit;
    fitBtn.addEventListener("click", function () { fit(); });
    bar.appendChild(fitBtn);
    var playBtn = document.createElement("button"); playBtn.type = "button"; playBtn.textContent = S.play;
    playBtn.addEventListener("click", togglePlay);
    var slider = document.createElement("input"); slider.type = "range"; slider.min = 0; slider.step = 1;
    slider.addEventListener("input", function () { stopPlay(); setDay(days[Number(slider.value)], true); });
    var dateEl = document.createElement("span");
    bar.appendChild(playBtn); bar.appendChild(slider); bar.appendChild(dateEl);
    var body = document.createElement("div"); root.appendChild(body);
    var detail = document.createElement("div"); root.appendChild(detail);
    var eventsBox = document.createElement("div"); eventsBox.className = "kf-events"; root.appendChild(eventsBox);

    function dayLabel(d) {
      if (data.dates && data.dates[d] != null) return data.dates[d];
      return "day " + d;
    }
    function setDay(d, fire) {
      var changed = state.day !== d;
      state.day = d;
      var idx = days.indexOf(d);
      slider.max = Math.max(0, days.length - 1);
      slider.value = idx < 0 ? days.length - 1 : idx;
      dateEl.textContent = (d === Infinity || idx < 0) ? "" : dayLabel(d);
      renderBody(); renderEvents();
      if (fire && changed && opts.onDayChange) opts.onDayChange(d);
    }
    function stopPlay() { if (state.timer) { clearInterval(state.timer); state.timer = null; playBtn.textContent = S.play; } }
    function togglePlay() {
      if (state.timer) { stopPlay(); return; }
      playBtn.textContent = S.pause;
      var i = days.indexOf(state.day); if (i < 0 || i >= days.length - 1) i = -1;
      state.timer = setInterval(function () {
        i++;
        if (i >= days.length) { stopPlay(); return; }
        setDay(days[i], true);
      }, 900);
    }
    function renderEvents() {
      if (!data.events || !data.events.length) { eventsBox.innerHTML = ""; return; }
      eventsBox.innerHTML = data.events.filter(function (ev) { return (ev.day || 0) <= state.day; })
        .map(function (ev) { return "<div><b>" + esc(dayLabel(ev.day || 0)) + "</b>" + esc(ev.text) + "</div>"; }).join("");
    }
    function setView(v) {
      var changed = state.view !== v;
      state.view = v;
      Object.keys(viewBtns).forEach(function (k) { viewBtns[k].setAttribute("aria-pressed", k === v ? "true" : "false"); });
      renderBody();
      if (changed && opts.onViewChange) opts.onViewChange(v);
    }

    function applyView() {
      if (!svgEl) return;
      var h = state.vb.w * H / W;
      svgEl.setAttribute("viewBox", state.vb.x + " " + state.vb.y + " " + state.vb.w + " " + h);
    }
    function fit() {
      state.vb = { x: 0, y: 0, w: W };
      applyView();
    }
    function toSVG(svg, clientX, clientY) {
      var pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }
    function attachViewport(svg) {
      svg.addEventListener("wheel", function (e) {
        e.preventDefault();
        var c = toSVG(svg, e.clientX, e.clientY);
        var factor = e.deltaY > 0 ? 1.12 : 0.89;
        var nw = Math.min(W * 2.5, Math.max(W / 8, state.vb.w * factor));
        var s = nw / state.vb.w;
        state.vb.x = c.x - (c.x - state.vb.x) * s;
        state.vb.y = c.y - (c.y - state.vb.y) * s;
        state.vb.w = nw;
        applyView();
      }, { passive: false });
      var pan = null, pointers = Object.create(null), pinchD = 0;
      svg.addEventListener("pointerdown", function (e) {
        pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (Object.keys(pointers).length === 2) {
          var ps = Object.values(pointers);
          pinchD = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
          pan = null;
        } else if (e.target === svg) {
          pan = { x: e.clientX, y: e.clientY, vb: Object.assign({}, state.vb) };
        }
      });
      svg.addEventListener("pointermove", function (e) {
        if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        var ids = Object.keys(pointers);
        if (ids.length === 2 && pinchD > 0) {
          var ps2 = Object.values(pointers);
          var d = Math.hypot(ps2[0].x - ps2[1].x, ps2[0].y - ps2[1].y);
          var c = toSVG(svg, (ps2[0].x + ps2[1].x) / 2, (ps2[0].y + ps2[1].y) / 2);
          var nw = Math.min(W * 2.5, Math.max(W / 8, state.vb.w * pinchD / Math.max(20, d)));
          var s = nw / state.vb.w;
          state.vb.x = c.x - (c.x - state.vb.x) * s;
          state.vb.y = c.y - (c.y - state.vb.y) * s;
          state.vb.w = nw;
          pinchD = d;
          applyView();
          return;
        }
        if (!pan) return;
        var rect = svg.getBoundingClientRect();
        var scale = state.vb.w / rect.width;
        state.vb.x = pan.vb.x - (e.clientX - pan.x) * scale;
        state.vb.y = pan.vb.y - (e.clientY - pan.y) * scale;
        applyView();
      });
      function endPointer(e) { delete pointers[e.pointerId]; if (!Object.keys(pointers).length) { pan = null; pinchD = 0; } }
      svg.addEventListener("pointerup", endPointer);
      svg.addEventListener("pointercancel", endPointer);
    }

    var edgeEls = [], nodeEls = [];
    function renderGraph() {
      body.innerHTML = "";
      var svg = document.createElementNS(NS, "svg");
      svgEl = svg;
      svg.setAttribute("role", "img");
      edgeEls = []; nodeEls = [];
      E.forEach(function (e) {
        if (!visEdge(e)) return;
        var ln = document.createElementNS(NS, "line");
        ln.setAttribute("class", "kf-edge" + (e.type === "derive" ? " derive" : ""));
        svg.appendChild(ln);
        var item = { el: ln, a: byId[e.from], b: byId[e.to], label: null };
        if (e.qty != null || e.label) {
          var t = document.createElementNS(NS, "text");
          t.setAttribute("font-size", "10"); t.setAttribute("text-anchor", "middle");
          t.setAttribute("fill", "var(--kf-muted,#777)");
          t.textContent = e.qty != null ? "×" + e.qty : e.label;
          svg.appendChild(t); item.label = t;
        }
        edgeEls.push(item);
      });
      N.forEach(function (n) {
        if (!visNode(n)) return;
        var g = document.createElementNS(NS, "g");
        g.setAttribute("class", "kf-node" + (n.superseded ? " ghost" : ""));
        var c = document.createElementNS(NS, "circle");
        var deg = childrenOf(n.id).length + parentsOf(n.id).length;
        c.setAttribute("r", 12 + Math.min(8, deg * 1.2));
        c.setAttribute("fill", colorOf(n));
        var t = document.createElementNS(NS, "text");
        t.textContent = n.label;
        g.appendChild(c); g.appendChild(t);
        svg.appendChild(g);
        nodeEls.push({ el: g, c: c, t: t, n: n });
        attachDrag(g, n, svg);
        g.addEventListener("pointerenter", function () { if (opts.onHover) opts.onHover(n.id); });
        g.addEventListener("pointerleave", function () { if (opts.onHover) opts.onHover(null); });
      });
      body.appendChild(svg);
      attachViewport(svg);
      applyView();
      applyDim(); draw(); kick();
    }
    function draw() {
      edgeEls.forEach(function (e) {
        e.el.setAttribute("x1", e.a.x); e.el.setAttribute("y1", e.a.y);
        e.el.setAttribute("x2", e.b.x); e.el.setAttribute("y2", e.b.y);
        if (e.label) { e.label.setAttribute("x", (e.a.x + e.b.x) / 2); e.label.setAttribute("y", (e.a.y + e.b.y) / 2 - 4); }
      });
      nodeEls.forEach(function (o) {
        o.c.setAttribute("cx", o.n.x); o.c.setAttribute("cy", o.n.y);
        o.t.setAttribute("x", o.n.x); o.t.setAttribute("y", o.n.y + Number(o.c.getAttribute("r")) + 13);
      });
    }
    function tick() {
      var i, j, a, b, dx, dy, d2, f, d;
      var vis = N.filter(visNode);
      for (i = 0; i < vis.length; i++) {
        a = vis[i];
        for (j = i + 1; j < vis.length; j++) {
          b = vis[j];
          dx = a.x - b.x; dy = a.y - b.y;
          d2 = dx * dx + dy * dy || 1;
          f = 3800 / d2; d = Math.sqrt(d2);
          a.vx += dx / d * f; a.vy += dy / d * f;
          b.vx -= dx / d * f; b.vy -= dy / d * f;
        }
      }
      E.forEach(function (e) {
        if (!visEdge(e)) return;
        a = byId[e.from]; b = byId[e.to];
        dx = a.x - b.x; dy = a.y - b.y;
        var dd = Math.sqrt(dx * dx + dy * dy) || 1;
        var rest = (a.kind === "root" || b.kind === "dir") ? 122 : 100;
        var stretch = (dd - rest) / dd;
        b.vx += dx * stretch * 0.03; b.vy += dy * stretch * 0.03;
        a.vx -= dx * stretch * 0.03; a.vy -= dy * stretch * 0.03;
      });
      vis.forEach(function (n) {
        n.vx += (W / 2 - n.x) * 0.0022;
        n.vy += (H / 2 - n.y) * 0.0022;
      });
      var maxv = 0;
      vis.forEach(function (n) {
        if (n.drag) { n.vx = 0; n.vy = 0; return; }
        n.vx *= 0.86; n.vy *= 0.86;
        if (Math.abs(n.vx) < 0.02) n.vx = 0;
        if (Math.abs(n.vy) < 0.02) n.vy = 0;
        n.x += n.vx; n.y += n.vy;
        if (n.x < 46) { n.x = 46; n.vx = 0; } else if (n.x > W - 46) { n.x = W - 46; n.vx = 0; }
        if (n.y < 18) { n.y = 18; n.vy = 0; } else if (n.y > H - 26) { n.y = H - 26; n.vy = 0; }
        maxv = Math.max(maxv, Math.abs(n.vx) + Math.abs(n.vy));
      });
      draw();
      if (maxv > 0.03) { state.raf = requestAnimationFrame(tick); }
      else { state.raf = null; }
    }
    function kick() { if (!state.raf && state.view === "graph") state.raf = requestAnimationFrame(tick); }
    function attachDrag(g, n, svg) {
      var moved = 0, sx = 0, sy = 0;
      g.addEventListener("pointerdown", function (e) {
        e.stopPropagation();
        n.drag = true; moved = 0; sx = e.clientX; sy = e.clientY;
        if (g.setPointerCapture) try { g.setPointerCapture(e.pointerId); } catch (err) {}
        kick();
      });
      g.addEventListener("pointermove", function (e) {
        if (!n.drag) return;
        moved = Math.max(moved, Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy));
        var loc = toSVG(svg, e.clientX, e.clientY);
        n.x = loc.x; n.y = loc.y;
        draw(); kick();
      });
      g.addEventListener("pointerup", function () {
        n.drag = false;
        if (moved < 5) select(n.id, true);
        else if (opts.onDragEnd) opts.onDragEnd(n.id);
        kick();
      });
      g.addEventListener("pointercancel", function () { n.drag = false; kick(); });
    }
    function focusNode() {
      var id = state.highlightId || state.selected;
      return id ? byId[id] : null;
    }
    function applyDim() {
      if (state.view !== "graph") return;
      var sel = focusNode();
      nodeEls.forEach(function (o) {
        var dim = false;
        if (sel && o.n !== sel) {
          dim = !E.some(function (e) {
            return (e.from === sel.id && e.to === o.n.id) || (e.to === sel.id && e.from === o.n.id);
          });
        }
        o.el.classList.toggle("dim", dim);
      });
      edgeEls.forEach(function (e) {
        var dim = !!sel && e.a !== sel && e.b !== sel;
        e.el.classList.toggle("dim", dim);
        if (e.label) e.label.style.opacity = dim ? 0.15 : 1;
      });
    }

    function renderCards() {
      body.innerHTML = "";
      var wrap = document.createElement("div"); wrap.className = "kf-cards";
      var groups = Object.create(null);
      N.forEach(function (n) { if (visNode(n)) (groups[n.group || n.kind || ""] = groups[n.group || n.kind || ""] || []).push(n); });
      Object.keys(groups).forEach(function (gname) {
        var h = document.createElement("div"); h.className = "kf-group"; h.textContent = gname;
        wrap.appendChild(h);
        groups[gname].forEach(function (n) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "kf-card";
          b.innerHTML = "<b>" + esc(n.label) + "</b><span>" + esc(n.kind || "") +
            (n.meta && n.meta.role ? " — " + esc(n.meta.role) : "") +
            (n.superseded ? " · " + esc(S.superseded) : "") + "</span>";
          b.addEventListener("click", function () { select(n.id, true); });
          wrap.appendChild(b);
        });
      });
      body.appendChild(wrap);
    }

    function renderTree() {
      body.innerHTML = "";
      var wrap = document.createElement("div"); wrap.className = "kf-tree";
      var hasParent = Object.create(null);
      E.forEach(function (e) { if (visEdge(e)) hasParent[e.to] = 1; });
      var roots = N.filter(function (n) { return visNode(n) && !hasParent[n.id]; });
      roots.forEach(function (r) { wrap.appendChild(treeRow(r, [])); });
      body.appendChild(wrap);
    }
    function treeRow(n, path) {
      var box = document.createElement("div");
      var row = document.createElement("div"); row.className = "kf-trow";
      var kids = childrenOf(n.id).map(function (e) { return byId[e.to]; }).filter(function (k) { return k && visNode(k); });
      var shared = parentsOf(n.id).length > 1;
      var cyclic = path.indexOf(n.id) >= 0;
      var folded = !!state.collapsed[n.id];
      row.innerHTML = "<span class='kf-tog'>" + (kids.length && !cyclic ? (folded ? "▸" : "▾") : "·") + "</span>" +
        esc(n.label) + (shared ? " <span style='color:var(--kf-muted,#777)'>(" + esc(S.shared) + ")</span>" : "") +
        (n.superseded ? " <span style='color:var(--kf-muted,#777)'>(" + esc(S.superseded) + ")</span>" : "");
      row.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (kids.length && !cyclic) {
          if (state.collapsed[n.id]) delete state.collapsed[n.id]; else state.collapsed[n.id] = 1;
          refreshVis(); renderBody();
        } else select(n.id, true);
      });
      box.appendChild(row);
      if (kids.length && !cyclic && !folded) {
        var kw = document.createElement("div"); kw.className = "kf-tkids";
        kids.forEach(function (k) { kw.appendChild(treeRow(k, path.concat([n.id]))); });
        box.appendChild(kw);
      }
      return box;
    }

    function renderDetail() {
      var n = state.selected ? byId[state.selected] : null;
      if (!n) { detail.innerHTML = ""; return; }
      var kids = childrenOf(n.id), pars = parentsOf(n.id);
      var h = "<div class='kf-detail'><h4>" + esc(n.label) + "</h4>";
      h += "<div>" + esc(n.kind || "") + (n.meta && n.meta.role ? " — " + esc(n.meta.role) : "") + "</div>";
      if (n.meta && n.meta.note) h += "<div>" + esc(n.meta.note) + "</div>";
      if (kids.length) {
        h += "<div class='kf-sec'>" + esc(S.composition) + "</div><ul>" + kids.map(function (e) {
          return "<li>" + esc(byId[e.to].label) + (e.qty != null ? " ×" + e.qty : "") + "</li>";
        }).join("") + "</ul>";
      }
      if (pars.length) {
        h += "<div class='kf-sec'>" + esc(S.whereUsed) + "</div><ul>" + pars.map(function (e) {
          return "<li>" + esc(byId[e.from].label) + (e.qty != null ? " ×" + e.qty : "") + "</li>";
        }).join("") + "</ul>";
      }
      h += "</div>";
      detail.innerHTML = h;
    }

    function select(id, fire) {
      state.selected = id;
      renderDetail(); applyDim();
      if (fire && opts.onSelect) opts.onSelect(id);
    }
    function renderBody() {
      refreshVis();
      if (state.view === "graph") renderGraph();
      else if (state.view === "cards") renderCards();
      else renderTree();
      renderDetail();
    }
    function focusOn(id) {
      var n = byId[id]; if (!n) return;
      var changed = false, seen = Object.create(null), queue = [id];
      seen[id] = 1;
      while (queue.length) {
        var cur = queue.shift();
        parentsOf(cur).forEach(function (e) {
          if (seen[e.from]) return;
          seen[e.from] = 1;
          if (state.collapsed[e.from]) { delete state.collapsed[e.from]; changed = true; }
          queue.push(e.from);
        });
      }
      if (changed) renderBody();
      select(id, false);
      refreshVis();
      if (!visNode(n)) return;
      var h = state.vb.w * H / W;
      state.vb.x = n.x - state.vb.w / 2;
      state.vb.y = n.y - h / 2;
      applyView();
    }

    load(data, false);
    state.day = days.length ? days[days.length - 1] : Infinity;
    slider.max = Math.max(0, days.length - 1); slider.value = Math.max(0, days.length - 1);
    if (days.length) dateEl.textContent = dayLabel(state.day);
    renderBody(); renderEvents();

    return {
      setData: function (d) {
        stopPlay();
        load(d, true);
        state.day = days.length ? days[days.length - 1] : Infinity;
        slider.max = Math.max(0, days.length - 1); slider.value = Math.max(0, days.length - 1);
        if (days.length) dateEl.textContent = dayLabel(state.day);
        renderBody(); renderEvents();
      },
      select: function (id) { select(id, false); },
      focus: function (id) { focusOn(id); },
      highlight: function (id) { state.highlightId = id; applyDim(); },
      filter: function (fn) { state.filterFn = fn || null; renderBody(); },
      expand: function (id) { delete state.collapsed[id]; renderBody(); },
      collapse: function (id) { state.collapsed[id] = 1; renderBody(); },
      fit: function () { fit(); },
      destroy: function () { stopPlay(); if (state.raf) cancelAnimationFrame(state.raf); root.remove(); }
    };
  }

  global.keifu = { mount: mount, version: "0.2.0" };
})(typeof window !== "undefined" ? window : this);
