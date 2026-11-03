---
name: chat-map
description: Draw the user's conversation landscape as one map — every chat thread as a node, branch / handover / recurring-delivery / related edges between them, fused with a historic timeline the user can replay day by day. Use when the user asks for a map, graph or overview of their chats, side chats or threads, or wants the map refreshed after threads are added.
---

# Chat Map

Draw the user's conversation landscape as one map: every chat thread (a main chat and its side chats / topic threads) as a node, the relations between them as edges, fused with a historic timeline so the map can be replayed day by day and watched growing. Born from the user's own 16-thread Muse landscape on 2026-11-03; no equivalent skill was found in the user's skill-hub catalog (1,258 skills) or in a GitHub search — the nearest neighbour, knowledge-graph-memory, turns session logs into Obsidian memory notes, which is a different job.

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
5. Render with the bundled template `assets/chat-map-template.html`: replace the `DATA` object with the nodes, edges and timeline events you gathered, then present it as an HTML widget. The template provides the force layout, day slider, play button, synchronised timeline feed, tap-for-details and archived toggle.
6. Offer the two follow-ups as options, without doing them unasked: export as Obsidian notes (one note per thread, wikilinks as edges, for the vault graph view), and refresh this map whenever threads are added.

## Does NOT do

- Never invent a date, a relation or a role. If the record does not show it, leave the edge out or mark the date an estimate.
- Read-only with respect to the threads themselves: this skill never posts into, renames or archives a chat.
- Chat titles and one-line roles only — never quote conversation content into the map.
- No schedule: the map is rebuilt when the user asks, not on a timer.

## Assets

- `assets/chat-map-template.html` — the fused Graph × Historic Timeline widget (force graph + day slider + playback + event feed). Data is injected through the single `DATA` object at the top of its script.
