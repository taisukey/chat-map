---
name: chat-map
description: Draw the user's conversation landscape as one map — every chat thread as a node, branch / handover / recurring-delivery / related edges between them, fused with a historic timeline the user can replay day by day. Use when the user asks for a map, graph or overview of their chats, side chats or threads, or wants the map refreshed after threads are added.
---

# Chat Map

Draw the user's conversation landscape as one map: every chat thread (a main chat and its side chats / topic threads) as a node, the relations between them as edges, fused with a historic timeline so the map can be replayed day by day and watched growing. Born from a real 16-thread Muse landscape; no equivalent skill was found in public skill catalogs or a GitHub search at the time — the nearest neighbour, knowledge-graph-memory, turns session logs into Obsidian memory notes, which is a different job.

## Status

- **v1** — `assets/chat-map-template.html`: the original Graph × Historic Timeline widget.
- **v2 (current)** — `assets/chat-map-template-v2.html`: a unified widget that adds a grouped-cards view, a tone toggle and optional Obsidian links.

## Trigger

- Run when the user asks for a map / graph / overview of their chats, side chats or threads （チャット地図, 全体像を見せて, and similar), or when a new side chat has just been created / handed over and the user wants the map updated.

## Steps

1. Enumerate the threads with `chat.list` (include archived ones). Nodes: the main chat plus every side chat. Record each thread's display name, archived state and a one-line role from its name and what memory says about it.
2. Date each thread by when it actually started carrying its topic (first substantive work in it), using conversation records and memory. A date you cannot ground stays an estimate and is labelled as such in the output — never present an estimate as exact.
3. Classify the relations as edges, using only relations you can point to in the record:
   - `branch` （分岐） — a topic split off into its own thread.
   - `handover` （引継ぎ） — work, a skill or a document was explicitly transferred to that thread.
   - `recurring` （定期配信） — a scheduled job delivers into that thread.
   - `related` （関連） — same subject or device, no transfer.
   Each edge gets the date the relation began (usually the younger thread's date) and a short note.
4. Cluster the nodes by theme (hub / environment / making / operations, or the user's own grouping) and assign each cluster a colour.
5. Render with a bundled template: replace the single shared data object with the nodes, edges and timeline events you gathered. The v1 template renders the graph and timeline. The v2 template merges the graph and the card design in one widget: a view toggle （グラフ／カード） and a tone toggle （標準／ダーク — a flat near-black briefing-card style) sit in the icon-only control bar (play ▶, ISO date, chat-count bubble + number, view and tone icon toggles — no text labels, so the bar reads in any language), and the choice persists in the widget state. The graph view provides the force layout, day slider, play button, synchronised timeline feed, tap-for-details and archived toggle; the card view (from the `chat_map_cards` skill) is the quiet grouped-cards rendering. The tone toggle changes colours only — never geometry — so switching never shifts the layout.
   Optional linking (v2 only): set `vault` (Obsidian vault name) and `notesDir` on the data, a `node` id on timeline events, and a `note` path on any node whose summary note does not follow the default `notesDir/<birthday> <label>.md` pattern — linked timeline entries then point to the chat's summary note in Obsidian via `obsidian://open?vault=…&file=…` links (values URI-encoded, `/` as `%2F`). Caveats, verified in November 2026: these links only work when the rendered HTML is opened in a real browser. Inside Muse's own chat and widget surfaces, custom URL schemes such as `obsidian://` do not reach the OS (shown as `[blocked]` on macOS, inert on iOS), so the template detects embedding (inside an iframe, or with the widget bridge present) and renders the timeline as plain text there instead of presenting links that cannot work. The template file starts with `<meta charset="utf-8">`: the Muse shell supplies UTF-8 inside the widget, but a standalone copy served as a bare fragment has no other encoding declaration (plain static servers send `text/html` without a charset), and browsers then misread the Japanese text as a legacy encoding — mojibake. Keep that first line in every render.
6. Offer the two follow-ups as options, without doing them unasked: export as Obsidian notes (one note per thread, wikilinks as edges, for the vault graph view), and refresh this map whenever threads are added.

## Does NOT do

- Never invent a date, a relation or a role. If the record does not show it, leave the edge out or mark the date an estimate.
- Read-only with respect to the threads themselves: this skill never posts into, renames or archives a chat.
- Chat titles and one-line roles only — never quote conversation content into the map.
- No schedule: the map is rebuilt when the user asks, not on a timer.

## Assets

- `assets/chat-map-template.html` — v1: the original graph-only widget (force graph + day slider + playback + event feed). Data is injected through its single `DATA` object.
- `assets/chat-map-template-v2.html` — v2: the unified widget (graph ⇄ card view toggle, 標準 ⇄ ダーク tone toggle, optional Obsidian links). Data is injected through the single `window.CM_DATA` object defined before the views' scripts (both views read it).
