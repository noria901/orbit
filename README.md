# ORBIT — 地球観測

宇宙から地球を眺めて、寄っていけるオープンデータ・デジタルツイン。
CesiumJS + 実測/計算を明示的に区別する観測レイヤ群。

**Live**: https://noria901.github.io/orbit/ *(GitHub Pages を `dev` ブランチから配信)*

## レイヤ

| レイヤ | 種別 | データ源 | 更新 |
|---|---|---|---|
| ISS | 実測 | [wheretheiss.at](https://wheretheiss.at/) | 5秒ポーリング(タブ表示中のみ) |
| 衛星カタログ(Starlink/GPS/GLONASS/Galileo/北斗/みちびき/OneWeb/Iridium/気象衛星/宇宙ステーション/その他 ≒1.2万機) | 計算(SGP4) | [CelesTrak](https://celestrak.org/) GP/TLE `GROUP=active` | GitHub Actions が3時間ごとに取得・コミット |
| 地震(24h, M2.5+) | 実測 | [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/) (Public Domain) | 4分キャッシュ + 失敗時バックオフ |
| アメダス実況 | 実測 | 気象庁 bosai JSON(非公式・政府標準利用規約) | 観測局のタイムスタンプが更新された時のみ再取得 |
| 地点プローブ | 実測 | [Open-Meteo](https://open-meteo.com/)(CC BY 4.0) | クリック時、0.01°丸めで10分キャッシュ |
| 基図 | — | Cesium同梱 Natural Earth II(Public Domain) | 静的 |

## 選択時のフライイン + 近接概形

ISSまたはカタログ衛星をクリックすると、カメラがその対象へ2.4秒かけて接近し、以後は対象の動きに追従する。
8,000mより近づくとドット表示から立体形状に切り替わる:

- **ISS**: 選択と同時に[NASA VTAD制作の実glTFモデル](https://science.nasa.gov/resource/international-space-station-3d-model/)(約42MB、Public Domain)を遅延読み込み。読み込み完了までと、CORS等で失敗した場合は実寸比の代表ボックス形状(全長109m×パネル展張73m)で継続表示。姿勢は実測lat/lonの逐次差分から算出した進行方位(forward azimuth)で決定。
- **カタログ衛星**: 個体ごとの正確なCADモデルは存在しないため、本体(2m級)+太陽電池パネルの簡略化した代表シルエットを表示。進行方向はSGP4伝播から得た速度ベクトルで自動配向。

## なぜ CelesTrak を直接ブラウザから叩かないか

CelesTrak の `gp.php` エンドポイントは CORS ヘッダーを返さない(確認済み: `Access-Control-Allow-Origin` なし)。
ブラウザから直接 fetch すると失敗するため、GitHub Actions(ブラウザではないので CORS 制約を受けない)が
サーバー側で取得し、`data/active.tle` として同一オリジンにコミットする構成にしている。

これは CelesTrak の [Usage Policy](https://celestrak.org/NORAD/documentation/) が明示する

> Only download the data you need, when you are going to use it, and only download data once per update.

にも合致する — 訪問者が何人いようと CelesTrak への実際のリクエストは3時間に1回、Actions からのみ発生する。

## キャッシュ

`localStorage` に前回の観測結果(地震・アメダス・地点プローブ・TLEカタログ)を保存し、再訪時は
TTL 内ならネットワークに一切出ずに即座に復元描画する。ブラウザの devtools → Application → Local Storage
で `orbit:` プレフィックスのキーを見れば、何がいつキャッシュされたか確認できる。

## 開発

```
main  … 安定版
dev   … 開発ブランチ(Pages配信元、ここに直接push)
```

`.github/workflows/fetch-tle.yml` は手動実行(workflow_dispatch)も可能。

## ライセンス

コード: MIT (LICENSE参照)
データ: 各レイヤの出典元ライセンスに従う(上表参照)。このリポジトリ自体はデータを再配布する目的ではなく、
定期スナップショットをビューアが読むためだけに保持している。
