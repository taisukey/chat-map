# chat-map

An agent skill that draws your conversation landscape as one map.

When an assistant conversation grows into a main chat plus many side chats, it gets hard to see the whole: which thread branched off from which, what was handed over where, and which thread a scheduled job delivers into. **chat-map** turns that into a single picture — every thread as a node, the relations between them as edges — fused with a historic timeline, so you can scrub or play back the days and watch the landscape grow.

## What it produces

An interactive widget (force-directed graph + timeline) with:

- **Nodes** — one per chat thread, coloured by theme cluster, archived threads faded
- **Edges** — four kinds: *branch* (a topic split off), *handover* (work or a skill was transferred), *recurring* (a scheduled job delivers there), *related* (same subject, no transfer)
- **Historic timeline** — a day slider and play button; threads and edges appear on the day they began, and a dated event feed lights up in sync
- **Details on tap** — each thread's role, its birthday, and its dated connections

## How it works

The skill is a procedure, not a script:

1. Enumerate the threads (including archived ones)
2. Date each thread from the conversation record; ungrounded dates are labelled estimates — never dressed up as exact
3. Classify relations from evidence only (a split, an explicit handover, a scheduled delivery, a shared subject)
4. Render through the bundled template (`assets/chat-map-template.html`) by replacing its single `DATA` object

It never invents a date or a relation, never posts into the threads it maps, and quotes no conversation content — titles and one-line roles only.

## Layout

- `SKILL.md` — the skill itself
- `assets/chat-map-template.html` — the Graph × Historic Timeline widget template

## 日本語

チャットが Main と多数の Side chat に枝分かれし、引き継ぎや定期配信が絡むと全体像が見えなくなります。chat-map は、各スレッドをノード、関係（分岐／引継ぎ／定期配信／関連）をエッジとして一枚の地図にし、日付スライダーと再生で「いつ何が生まれたか」まで辿れるようにするエージェントスキルです。日付や関係は記録に基づくものだけを使い、根拠のない日付は「目安」と明記します。

---

Created by taisukey with Muse. Commits to this repository carry a `Co-authored-by: Muse` trailer — AI collaboration is disclosed upfront, on purpose.
