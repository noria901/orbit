# ORBIT — 地球観測

宇宙から地球を眺めて、寄っていけるオープンデータ・デジタルツイン。
Three.js + 実測/計算を明示的に区別する観測レイヤ群。

**Live**: https://noria901.github.io/orbit/ *(現時点の本番配信は `dev` ブランチ=Cesium版。
このブランチ `migration/threejs-backend` はThree.jsへの移行作業中)*

## レイヤ

| レイヤ | 種別 | データ源 | 更新 |
|---|---|---|---|
| ISS | 実測 | [wheretheiss.at](https://wheretheiss.at/) | 5秒ポーリング(タブ表示中のみ) |
| 衛星カタログ(Starlink/GPS/GLONASS/Galileo/北斗/みちびき/OneWeb/Iridium/気象衛星/宇宙ステーション/その他 ≒1.6万機) | 計算(SGP4) | [CelesTrak](https://celestrak.org/) GP/TLE `GROUP=active` | GitHub Actions が3時間ごとに取得・コミット |
| 地震(24h, M2.5+) | 実測 | [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/) (Public Domain) | 4分キャッシュ + 失敗時バックオフ |
| アメダス実況 | 実測 | 気象庁 bosai JSON(非公式・政府標準利用規約) | 観測局のタイムスタンプが更新された時のみ再取得 |
| 地点プローブ | 実測 | [Open-Meteo](https://open-meteo.com/)(CC BY 4.0) | クリック時、0.01°丸めで10分キャッシュ |
| 基図 | — | Blue Marble 2002(Wikimedia Commons、Public Domain) | 静的1枚画像 |

## アーキテクチャ(Three.js版)

CesiumJSへの依存を撤去し、Three.jsを基盤にした自前の3D地球儀・観測レイヤ描画に移行した
(詳細: [Issue #2](https://github.com/noria901/orbit/issues/2))。

- `index.html` — シーン初期化・データ取得ループ・UI配線をまとめた薄いエントリポイント
- `src/*.js` — 描画・データ・数学ロジックを機能単位に分割したESモジュール。ビルドステップ無しで
  ブラウザに直接読み込まれる(`<script type="module">` + `importmap`)。同じファイルを
  Node組み込みテストランナー(`node --test`)でも実行できる
- `test/*.test.js` — 各モジュールに対応するユニットテスト。純粋ロジック(座標変換・SGP4伝播の
  ラップ・カメラ数学など)は完全に検証、Three.js依存部分(ジオメトリ/マテリアル構築)も
  実際のThree.jsオブジェクトを使って検証している

### モジュール一覧

| モジュール | 役割 |
|---|---|
| `geo.js` | WGS84 ⇄ ECEF 座標変換 |
| `math.js` | Vec3/Mat3/Mat4/Quat、Cesiumの`Transforms`相当のENUフレーム計算 |
| `time.js` | 時刻ユーティリティ |
| `cache.js` | localStorageキャッシュ + 指数バックオフ |
| `catalogue.js` | TLEパース・カテゴリ分類・SGP4ラッパー |
| `data.js` | 地震/アメダス/ISS/地点プローブ/TLEのfetch層 |
| `iss.js` | ISS推測航法(大圏航法による位置予測) |
| `earth.js` | WGS84楕円体メッシュ + テクスチャ読込 |
| `atmosphere.js` | 大気グローシェーダ |
| `lighting.js` | 太陽方向計算(簡易Meeus法) + 昼夜ライティング |
| `controls.js` | 球面座標ベースの手動カメラ操作(ドラッグ/ホイール) |
| `camera-rig.js` | flyToアニメーション + 高速移動対象への自前追従 |
| `points.js` | Points(点群)汎用ヘルパー |
| `quakes.js` / `amedas-layer.js` / `satellites-layer.js` / `iss-layer.js` | 各観測レイヤの描画 |
| `orbits.js` | 軌道地上投影線(準天頂軌跡など) |
| `picker.js` | 画面投影距離での点群ピッキング + 地表Raycaster |
| `model-loader.js` | ISS glTFモデルの遅延ロード・重心オフセット補正・失敗時フォールバック |

### 開発

```bash
node --test          # 全テスト実行
```

ローカルでブラウザ実行を試す場合、`three`と`satellite.js`は外部CDN
(jsdelivr / cdnjs)から読み込む構成になっている。オフラインや制限されたネットワーク環境では
`npm install three satellite.js` した上で `index.html` の `importmap` と `<script>` タグを
一時的にローカルパスへ差し替えるとよい(コミットはしないこと)。

## ライセンス

コード: MIT。データは各レイヤの出典元ライセンスに従う(上表参照)。
