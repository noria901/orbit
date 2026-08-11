# CLAUDE.md — orbit プロジェクト開発ノート

このファイルは、次にこのリポジトリを触るAI(Claude Code含む)や人間向けの引き継ぎメモ。
「なぜこの実装になっているか」「何を試して何がダメだったか」を残す。コミットログより先に読むこと。

## 検証ルール(このプロジェクトで何度も破られた実績があるため明記する)

**外部ライブラリ・APIの挙動を修正する前に、必ず一次情報を確認すること。検索結果の断片(GitHub Issue、フォーラム投稿、コミュニティの憶測)を読んで「それっぽい」で満足して動いてはいけない。**

このプロジェクトの開発中、以下の順で何度も同じ失敗をした:
1. 検索して、それらしい説明が載ったIssue/フォーラム投稿を見つける
2. それを一次情報と混同し、確認できたと判断する
3. 推測で直す
4. 動作報告を待たずに「直ったはず」と言う
5. 実際には直っておらず、別の推測でまた直す(3へ戻る)

これを断ち切るために:
- 公式リファレンスドキュメント(例: cesium.com/learn/.../ref-doc/、nasa-gibs.github.io/gibs-api-docs/)を先に読む。検索結果はそこへ辿り着くための手段であって、答えそのものではない。
- リファレンスドキュメントに答えが無ければ、該当ライブラリの実際のソースコード(GitHubへのリンクが大抵ドキュメント内にある)を読む。
- それでも確証が持てない場合は、推測で直すのではなく、実機のコンソールログ・スクリーンショットを要求してから直す。このプロジェクトで実際に一発診断できた不具合(GIBSタイル欠損、ISSモデルの重心オフセット、地形トグルのIonトークン問題)は全部、実機ログを見てから直したものだった。
- 1つの修正を送り出す前に「これは検証済みの事実に基づいているか、それとも都合の良い仮説か」を自問する。後者なら、まだ直す段階ではない。

このルールを書いた時点でこの原則自体が繰り返し破られていた。次にこのリポジトリを触る者(このAI自身を含む)は、このルールを一度読んで終わりにせず、実際の作業の中で守られているか自己点検すること。

## アーキテクチャ概要

- 単一ファイル `index.html`(Cesium + Vanilla JS、ビルドステップ無し)
- 地球儀・基本カメラ操作・大気・ライティング → **Cesium純正のまま使う**(壊れたことがない)
- 衛星の追従カメラ(高速移動対象へのフライイン+追従) → **Cesium標準機能(trackedEntity)を捨てて自前実装**
- データ取得は全レイヤ「実測 or 計算」をUI上で明示区別する設計思想(観測台帳の流れを継承)

## ハマった箇所と教訓

### 1. GitHub Pages + Jekyll
`.nojekyll` を置かないとGitHub Pagesが独自ビルドを試みて失敗する。静的サイトなら必須。

### 2. GitHub Actionsトークンのスコープ
デバイスフロー認証で `repo` スコープだけだと `.github/workflows/` への push が拒否される。
`workflow` スコープも必要。

### 3. GIBS(NASA衛星画像)のタイル配信
- KVP方式(`?LAYER=...&TILEMATRIX=...`)はTileMatrixラベルの解釈がサーバー実装依存でズレることがあり、
  実際にブロック状の低解像度描画になる不具合が出た。REST方式(URLパスに直接埋め込み)の方が安定。
- `maximumLevel` は当てずっぽうで決めるとハマる。250mセットはlevel 8、500mセットはlevel 7が正解
  (NASA公式 `nasa-gibs/gibs-ml` の解像度対応表で確認)。Cesiumコミュニティの別レイヤの例を
  鵜呑みにして5にしたら逆にボケた。
- GIBSの実際のEPSG:4326グリッドは **-180°〜396°/90°〜-198°(576°×288°)** という
  パディング付きの変則矩形で、素直な360°×180°ではない(NASA公式GDAL_WMS設定例で確認)。
  → **これをCesiumのカスタムGeographicTilingSchemeにそのまま反映すると、地球儀本体の
  ジオメトリ分割と噛み合わず、球面に放射状の欠けが生じる不具合が出た。**
  最終的に標準スキームに戻し、東経側での一部タイル404/400は許容する判断にした
  (下地のBlue Marbleが透けて見えるだけなので実害は小さい)。
- 単純な400/404はCORS/存在しないタイルの想定内挙動。`errorEvent` にリスナーを付けると
  Cesium既定の大量console.error出力を抑止できる。

### 4. 高速移動オブジェクト(ISS, 衛星)のカメラ追従
これが一番長く迷走した箇所。時系列で:
1. `viewer.flyTo(anchor)` で `anchor` を追加した**その場で**flyToを呼んだら失敗
   → 追加直後のエンティティはバウンディングスフィア未計算(次のレンダーフレームまでPENDING)。
   `camera.flyToBoundingSphere(new BoundingSphere(position, radius), options)` に位置を
   同期サンプリングして直接渡す方式に変更。
2. flyToが「今の位置」に飛んでいた → ISSは秒速7.66kmで動くため、2.4秒のフライト中に
   対象は十数km先へ進んでしまい追いつけない。**「到着予定時刻の予測位置」に飛ぶ**よう修正
   (ISS位置計算を時刻の関数として実装し直し、`issPositionAt(未来のtimestamp)` で予測)。
3. `viewer.trackedEntity` を試したが、フライイン中にセットすると内部の `EntityView` が
   毎フレーム `camera.transform` を強制上書きし、①独自flyToアニメーションと競合してガクつく
   ②ユーザーの手動ドラッグ操作もその都度巻き戻されて効かなくなる、の2つの不具合を出した。
   → **最終的にtrackedEntityを完全に諦め、`scene.postUpdate` で「対象が1フレームに動いた分だけ
   camera.positionを平行移動させる」自前の追従カメラに統一**(camera.transformには一切触らない)。
4. ISS実写3Dモデル(NASA VTAD, glTF, 約42MB)の重心オフセット補正で複数回のバグ:
   - `show=false` のまま `boundingSphere` を読むとCesium内部でTypeError(追加直後のエンティティ問題と同系統)
   - `show=true` にした後も、`modelMatrix`が「仮配置(issShownの位置)」の状態で`boundingSphere.center`を
     測ってしまい、ローカル座標のつもりがワールド座標(issShownとほぼ同じ桁数、数百万m)を
     読んでしまうバグで2回失敗(「隅に飛ぶ」→補正式に食わせたら「数百万m先に消える」)。
   - さらに、tickハンドラの「補正値が無い間は仮配置する」フォールバックが`issModel`代入直後から
     毎フレーム動いてしまい、単位行列のまま測るはずが実際は仮配置後の状態で測っていた
     (2回目の修正が効かなかった理由)。
   - 最終的に「`issModel`への代入自体を測定成功まで遅延させる」ことで解決。
     診断ログ(`console.info('[orbit] ISSモデル診断...')`)を仕込んで実機コンソールの数値を
     見せてもらいながら特定した。**この手のバグは推測で直さず、実機ログを見るのが結局最速。**
   - このモデル、42MB・高ポリゴンで、環境によっては `WebGL: CONTEXT_LOST_WEBGL` を誘発する
     リスクがある(実際に1回、別要因の地形機能と合わせて疑ったが誤診断だった)。
5. 「地形起伏」トグルは `Cesium.createWorldTerrainAsync()` を呼んでいたが、これはCesium Ionの
   トークンが必要な機能で、本プロジェクトは意図的にIonを無効化している
   (`Cesium.Ion.defaultAccessToken = undefined`)。Promise自体は失敗せず、実際の破綻は
   カメラが地表に近づいて詳細タイルを要求した瞬間、Cesium内部の `createPotentiallyVisibleSet`
   で `RangeError: Invalid array length` → `WebGL: CONTEXT_LOST_WEBGL` という深刻なクラッシュを
   引き起こしていた。**Ion不使用の方針である以上この機能は提供できないため、トグルごと撤去した。**

### 5. デバッグ手段について
このプロジェクトは claude.ai のサンドボックスから作業しているが、**サンドボックスの
ネットワークegressが `noria901.github.io` はもちろん `cdnjs.cloudflare.com`(Cesium本体)、
`gibs.earthdata.nasa.gov`、`assets.science.nasa.gov` など、このアプリが依存する外部ドメインを
すべてブロックしている**。Playwright + Chromiumはサンドボックス内に実在し起動もできるが、
Cesium.js自体が読み込めないため実質何も検証できない(実際に検証して確認済み)。
→ **このリポジトリのバグ修正は、ユーザーに実機のブラウザdevtoolsコンソールログを
貼ってもらう以外に確実な検証手段が無い。** 推測で直すと高確率で外れる
(GIBSタイルスキームやISSモデルのオフセット問題がその実例)。次にAIが触るときも
「ログをもらってから直す」を徹底すること。

## 未解決・既知の制限

- ISS実写3Dモデル(`ISS_MODEL_URL`)は重心オフセット補正込みで動作するはずだが、
  42MBという重さそのものが低スペック端末でWebGLコンテキストロストを誘発するリスクは残っている。
- GIBS実写レイヤは東経側の一部タイルで404/400が出ることがある(標準タイリングスキームと
  GIBSの実グリッドの不一致による)。下地のBlue Marbleに自然にフォールバックするため
  実害は小さいが、根本解決ではない。
- Graphify(ユーザー独自のコード知識グラフツール、BacklogBotByClaudeCode由来)は
  このclaude.aiチャット環境からは接続手段が無い(MCPレジストリに無し)。

## コード知識グラフ (Graphify)

`graphify-out/graph.json` + `graph.html` を同梱している(PyPIパッケージ名は `graphifyy`、
コマンド名は `graphify`。名前が紛らわしいので注意)。

- `index.html` には専用のHTML抽出器が無く、素で渡すと`document`扱いになりLLM意味解析
  (要APIキー)経路に回されて何も抽出されない。そのため `<script>` 内のインラインJSだけを
  `.graphify-src/orbit.js` に抜き出し、tree-sitterベースのAST抽出(`extract_js`、LLM不要・
  完全ローカル)にかけている。
- 再生成する場合:
  ```bash
  uv tool install graphifyy   # 未インストールなら
  # index.htmlの<script>ブロックを .graphify-src/orbit.js に抽出してから
  # graphify.extract / build / cluster / export の各関数を直接呼ぶ
  # (CLI単体では完結せず、Pythonライブラリとして呼ぶ必要がある。
  #  詳細は過去のコミット差分か、~/.claude/skills/graphify/SKILL.md を参照)
  ```
- `graphify-out/cache/` はキャッシュなので `.gitignore` 済み。`graph.json`/`graph.html` のみ追跡。
- `GRAPH_REPORT.md`(god nodes等のレポート)は生成に内部の中間データ(cohesion_scores等)が
  多数必要で、CLIの`graphify install`で入る `/graphify` スキル経由でないと素直には作れなかった
  ため今回は省略している。

## 開発フロー

- `dev` ブランチで直接作業、GitHub Pagesも `dev` から配信(pushで自動反映、数十秒〜数分)
- GitHub Actions (`.github/workflows/fetch-tle.yml`) がCelesTrakのTLEデータを3時間毎に取得
- コード変更前に必ず `grep`/`view` で該当箇所の現状を確認してから編集する
  (このファイル自体が何度も「別の場所で上書きされていた」系のバグで痛い目を見た教訓)
