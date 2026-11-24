# Accessibility

chat-map renders your Muse conversations as one HTML map. The graph view is visual by nature, so this statement is plain about what that means: what the other views and search can do instead, and what has not been verified.

## What helps

- **Cards and tree views show the same content without the map.** Threads appear as grouped cards, or as a foldable tree of clusters and chats — reading them does not depend on position, lines, or colour.
- **Search finds a chat by name or role** and jumps to it in whichever view is open.
- **Details are text.** Tapping a thread shows its role, its birthday, and its dated connections as readable text.
- **The mono tone reduces reliance on colour** — grey structure, monospace type, and a single highlight colour.

## Known limitations

- **The graph view is spatial.** What is near what, and which lines connect, carries meaning that has no text equivalent inside the tool. Cluster membership is shown by node colour in this view (in the cards and tree views the same grouping is structural, so it survives as text there).
- **Not tested with screen readers or other assistive technology.** The generated HTML is a single self-contained file and does not author ARIA roles or landmarks for the map.
- **Graph interactions are pointer- and touch-oriented** — drag, pan, zoom, and tap. The cards and tree views need only ordinary scrolling and tapping/clicking.
- **The timeline is an animation.** The dates it plays back are also available as text in each thread's details.

## Reporting a barrier

Open a GitHub Issue in this repository. You never need to disclose a disability, and screenshots or recordings are optional. It helps to include:

- Which view you were using (graph, cards, or tree), and what you tried to do
- Your browser and device, and any assistive technology involved
- What happened instead of what you expected

chat-map is maintained by one person, so replies are best-effort — but every report is read, and if a fix is possible it will be tracked in the open.

---

## 日本語

chat-map は、Muse の会話を1枚の HTML マップに描く道具です。グラフ表示は本質的に視覚的なので、この声明では、他の表示と検索で何が代替できるか、何が未検証かを正直に書きます。

**助けになるもの**

- **カード表示とツリー表示は、地図なしで同じ内容を見られます**。スレッドがグループ化されたカード、またはクラスタとチャットの折りたたみツリーとして並ぶため、位置・線・色に依存しません
- **検索**でチャットを名前や役割から探し、開いている表示の中でその場所へ跳べます
- **詳細はテキストです**。スレッドをタップすると、役割・誕生日・日付つきのつながりが読める形で出ます
- **モノクロの色調（mono）は色への依存を減らします**。グレーの構造＋等幅フォント＋ハイライトは1色だけです

**既知の制限**

- **グラフ表示は空間的です**。何が何の近くにあるか、どの線がつながっているかに意味があり、道具の中にテキストの等価物はありません。クラスタ分けも、この表示ではノードの色で示されます（カード／ツリー表示ではグルーピングが構造として残るため、テキストでも失われません）
- **スクリーンリーダー等の支援技術での検証は行っていません**。生成される HTML は自己完結の単一ファイルで、マップに対する ARIA ロールやランドマークは付けていません
- **グラフの操作はポインタ／タッチ前提です**（ドラッグ、パン、ズーム、タップ）。カード／ツリー表示は通常のスクロールとタップ／クリックだけで使えます
- **タイムラインはアニメーションです**。再生される日付情報は、各スレッドの詳細にもテキストで入っています

**バリアの報告**：このリポジトリの GitHub Issues へどうぞ。障害の開示は不要で、スクリーンショットや録画も任意です。「どの表示で（グラフ／カード／ツリー）、何をしようとしたか」「ブラウザと端末、使っている支援技術があれば」「期待と違ってどうなったか」を書いてもらえると助かります。個人で維持しているため返信はベストエフォートですが、報告はすべて読み、直せるものは公開の場で追跡します。
