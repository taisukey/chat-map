/* keifu （系譜） — nodes/edges JSON in, Graph / Cards / Tree out.
   Zero dependencies, no build step, single file.
   Spec: ../COMPONENT-SPEC.md (v0.1)
   Usage: keifu.mount(el, data, opts)
     data: {nodes:[{id,label,kind,group,day,meta,superseded}],
            edges:[{from,to,qty,label,type,day}],
            events:[{day,text}] (optional),
            dates:[...] (optional labels for day indices)}
     opts: {strings:{...}, colors:{kindOrGroup: cssColor}, onSelect(id), view:"graph"}
   Returns a handle: {setData(data), select(id), destroy()}.
*/
(function (global) {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var DEFAULT_STRINGS = {
    graph: "Graph", cards: "Cards", tree: "Tree",
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
      ".kf-edge text{fill:var(--kf-muted,#777);stroke:none}",
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

    var state = { view: opts.view || "graph", day: Infinity, selected: null, timer: null, raf: null };
    var N = [], E = [], byId = {}, days = [], W = 640, H = 420;
    var colorCache = {};

    function colorOf(n) {
      var key = n.group || n.kind || "";
      if (opts.colors && opts.colors[key]) return opts.colors[key];
      if (!colorCache[key]) colorCache[key] = PALETTE[Object.keys(colorCache).length % PALETTE.length];
      return colorCache[key];
    }
    function childrenOf(id) { return E.filter(function (e) { return e.from === id; }); }
    function parentsOf(id) { return E.filter(function (e) { return e.to === id; }); }
    function dayOf(x) { return (x.day == null ? 0 : x.day); }
    function visDay(x) { return dayOf(x) <= state.day; }

    function load(d) {
      data = d || { nodes: [], edges: [] };
      byId = {}; colorCache = {};
      N = (data.nodes || []).map(function (n, i) {
        var c = Object.assign({}, n);
        var ang = (i / Math.max(1, data.nodes.length)) * Math.PI * 2;
        c.x = W / 2 + Math.cos(ang) * 150; c.y = H / 2 + Math.sin(ang) * 110;
        c.vx = 0; c.vy = 0; c.drag = false;
        byId[c.id] = c; return c;
      });
      E = (data.edges || []).filter(function (e) { return byId[e.from] && byId[e.to]; })
        .map(function (e) { return Object.assign({}, e); });
      var ds = {};
      N.concat(E).forEach(function (x) { ds[dayOf(x)] = 1; });
      (data.events || []).forEach(function (ev) { ds[ev.day || 0] = 1; });
      days = Object.keys(ds).map(Number).sort(function (a, b) { return a - b; });
      if (state.day !== Infinity && days.indexOf(state.day) < 0) state.day = Infinity;
    }

    /* ---------- toolbar ---------- */
    var bar = document.createElement("div"); bar.className = "kf-bar"; root.appendChild(bar);
    var viewBtns = {};
    [["graph", S.graph], ["cards", S.cards], ["tree", S.tree]].forEach(function (pair) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = pair[1];
      b.setAttribute("aria-pressed", state.view === pair[0] ? "true" : "false");
      b.addEventListener("click", function () { setView(pair[0]); });
      viewBtns[pair[0]] = b; bar.appendChild(b);
    });
    var playBtn = null, slider = null, dateEl = null;
    if (true) {
      playBtn = document.createElement("button"); playBtn.type = "button"; playBtn.textContent = S.play;
      playBtn.addEventListener("click", togglePlay);
      slider = document.createElement("input"); slider.type = "range"; slider.min = 0; slider.step = 1;
      slider.addEventListener("input", function () { stopPlay(); setDay(days[Number(slider.value)]); });
      dateEl = document.createElement("span");
      bar.appendChild(playBtn); bar.appendChild(slider); bar.appendChild(dateEl);
    }
    var body = document.createElement("div"); root.appendChild(body);
    var detail = document.createElement("div"); root.appendChild(detail);
    var eventsBox = document.createElement("div"); eventsBox.className = "kf-events"; root.appendChild(eventsBox);

    function dayLabel(d) {
      if (data.dates && data.dates[d] != null) return data.dates[d];
      return "day " + d;
    }
    function setDay(d) {
      state.day = d;
      var idx = days.indexOf(d);
      if (slider) { slider.max = Math.max(0, days.length - 1); slider.value = idx < 0 ? days.length - 1 : idx; }
      if (dateEl) dateEl.textContent = (d === Infinity || idx < 0) ? "" : dayLabel(d);
      renderBody(); renderEvents();
    }
    function stopPlay() { if (state.timer) { clearInterval(state.timer); state.timer = null; playBtn.textContent = S.play; } }
    function togglePlay() {
      if (state.timer) { stopPlay(); return; }
      playBtn.textContent = S.pause;
      var i = days.indexOf(state.day); if (i < 0 || i >= days.length - 1) i = -1;
      state.timer = setInterval(function () {
        i++;
        if (i >= days.length) { stopPlay(); return; }
        setDay(days[i]);
      }, 900);
    }
    function renderEvents() {
      if (!data.events || !data.events.length) { eventsBox.innerHTML = ""; return; }
      eventsBox.innerHTML = data.events.filter(function (ev) { return (ev.day || 0) <= state.day; })
        .map(function (ev) { return "<div><b>" + esc(dayLabel(ev.day || 0)) + "</b>" + esc(ev.text) + "</div>"; }).join("");
    }

    function setView(v) {
      state.view = v;
      Object.keys(viewBtns).forEach(function (k) { viewBtns[k].setAttribute("aria-pressed", k === v ? "true" : "false"); });
      renderBody();
    }

    /* ---------- graph ---------- */
    var edgeEls = [], nodeEls = [];
    function renderGraph() {
      body.innerHTML = "";
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("role", "img");
      edgeEls = []; nodeEls = [];
      E.forEach(function (e) {
        if (!visDay(e) || !visDay(byId[e.from]) || !visDay(byId[e.to])) return;
        var ln = document.createElementNS(NS, "line");
        ln.setAttribute("class", "kf-edge" + (e.type === "derive" ? " derive" : ""));
        svg.appendChild(ln);
        var item = { el: ln, a: byId[e.from], b: byId[e.to], label: null };
        if (e.qty != null || e.label) {
          var t = document.createElementNS(NS, "text");
          t.setAttribute("font-size", "10"); t.setAttribute("text-anchor", "middle");
          t.textContent = e.qty != null ? "×" + e.qty : e.label;
          svg.appendChild(t); item.label = t;
        }
        edgeEls.push(item);
      });
      N.forEach(function (n) {
        if (!visDay(n)) return;
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
      });
      body.appendChild(svg);
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
      var vis = N.filter(visDay);
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
        if (!visDay(e)) return;
        a = byId[e.from]; b = byId[e.to];
        if (!visDay(a) || !visDay(b)) return;
        dx = a.x - b.x; dy = a.y - b.y;
        var dd = Math.sqrt(dx * dx + dy * dy) || 1;
        var rest = (a.kind === "root" || b.kind === "dir") ? 122 : 100;
        var stretch = (dd - rest) / dd;
        /* symmetric spring: b toward a, a toward b (dx points a-b) */
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
        n.drag = true; moved = 0; sx = e.clientX; sy = e.clientY;
        if (g.setPointerCapture) try { g.setPointerCapture(e.pointerId); } catch (err) {}
        kick();
      });
      g.addEventListener("pointermove", function (e) {
        if (!n.drag) return;
        moved = Math.max(moved, Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy));
        var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        var loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        n.x = loc.x; n.y = loc.y;
        draw(); kick();
      });
      g.addEventListener("pointerup", function () {
        n.drag = false;
        if (moved < 5) select(n.id, true);
        kick();
      });
    }
    function applyDim() {
      if (state.view !== "graph") return;
      var sel = state.selected ? byId[state.selected] : null;
      nodeEls.forEach(function (o) {
        var dim = false;
        if (sel && o.n !== sel) {
          dim = !E.some(function (e) {
            return (e.from === sel.id && e.to === o.n.id) || (e.to === sel.id && e.from === o.n.id);
          });
        }
        o.el.classList.toggle("dim", dim);
        o.el.classList.toggle("sel", !!sel && o.n === sel);
      });
      edgeEls.forEach(function (e) {
        var dim = !!sel && e.a !== sel && e.b !== sel;
        e.el.classList.toggle("dim", dim);
        if (e.label) e.label.style.opacity = dim ? 0.15 : 1;
      });
    }

    /* ---------- cards ---------- */
    function renderCards() {
      body.innerHTML = "";
      var wrap = document.createElement("div"); wrap.className = "kf-cards";
      var groups = {};
      N.forEach(function (n) { if (visDay(n)) (groups[n.group || n.kind || ""] = groups[n.group || n.kind || ""] || []).push(n); });
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

    /* ---------- tree ---------- */
    function renderTree() {
      body.innerHTML = "";
      var wrap = document.createElement("div"); wrap.className = "kf-tree";
      var hasParent = {};
      E.forEach(function (e) { if (visDay(e)) hasParent[e.to] = 1; });
      var roots = N.filter(function (n) { return visDay(n) && !hasParent[n.id]; });
      roots.forEach(function (r) { wrap.appendChild(treeRow(r, [], 0)); });
      body.appendChild(wrap);
    }
    function treeRow(n, path, depth) {
      var box = document.createElement("div");
      var row = document.createElement("div"); row.className = "kf-trow";
      var kids = childrenOf(n.id).map(function (e) { return byId[e.to]; }).filter(function (k) { return k && visDay(k); });
      var shared = parentsOf(n.id).length > 1;
      var cyclic = path.indexOf(n.id) >= 0; /* n already appears among its ancestors */
      row.innerHTML = "<span class='kf-tog'>" + (kids.length && !cyclic ? "▸" : "·") + "</span>" +
        esc(n.label) + (shared ? " <span style='color:var(--kf-muted,#777)'>(" + esc(S.shared) + ")</span>" : "") +
        (n.superseded ? " <span style='color:var(--kf-muted,#777)'>(" + esc(S.superseded) + ")</span>" : "");
      row.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var k = box.querySelector(".kf-tkids");
        if (k) { k.style.display = k.style.display === "none" ? "" : "none"; return; }
        select(n.id, true);
      });
      box.appendChild(row);
      if (kids.length && !cyclic) {
        var kw = document.createElement("div"); kw.className = "kf-tkids";
        kids.forEach(function (k) { kw.appendChild(treeRow(k, path.concat([n.id]), depth + 1)); });
        box.appendChild(kw);
      }
      return box;
    }

    /* ---------- detail ---------- */
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
      if (state.view === "graph") renderGraph();
      else if (state.view === "cards") renderCards();
      else renderTree();
      renderDetail();
    }

    load(data);
    if (slider) { slider.max = Math.max(0, days.length - 1); slider.value = days.length - 1; }
    state.day = days.length ? days[days.length - 1] : Infinity;
    if (dateEl && days.length) dateEl.textContent = dayLabel(state.day);
    renderBody(); renderEvents();

    return {
      setData: function (d) { stopPlay(); load(d); state.day = days.length ? days[days.length - 1] : Infinity; if (slider) { slider.max = Math.max(0, days.length - 1); slider.value = days.length - 1; } if (dateEl && days.length) dateEl.textContent = dayLabel(state.day); renderBody(); renderEvents(); },
      select: function (id) { select(id, false); },
      destroy: function () { stopPlay(); if (state.raf) cancelAnimationFrame(state.raf); root.remove(); }
    };
  }

  global.keifu = { mount: mount, version: "0.1.0" };
})(typeof window !== "undefined" ? window : this);
