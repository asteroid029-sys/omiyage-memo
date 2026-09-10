# おみやげメモ v2

スマホ向け・個人利用用のお土産買い物リストPWAです。データは端末内のIndexedDBに保存します。

## v2 改善点

- 写真選択をカメラ固定からギャラリー/ファイル選択へ変更
- 日本円とは別に現地通貨の金額を登録可能（EURを初期値に設定、為替換算なし）
- 購入済みカードは打ち消し線を使わず、背景色・左ライン・購入済みバッジで区別
- 「買える場所」からGoogleマップ検索を直接起動可能
- 自由タグを作成可能。トップ画面でタグ絞り込み可能
- 現地通貨の合計を通貨ごとに表示

## Googleマップについて

通常のWebアプリからGoogleマップアプリでユーザーが選択した場所を、そのまま自動でWebアプリへ受け戻して登録することはできません（Maps API等を使った別実装が必要です）。

このバージョンでは、場所名を入力して「Googleマップで場所を探す」を押すと、その場所名でGoogleマップを開きます。一覧からも同じ場所をGoogleマップで再度開けます。

## 更新方法（GitHub Pages）

GitHubリポジトリ内の `index.html` / `styles.css` / `app.js` / `sw.js` をこのv2ファイルで置き換えてください。`manifest.webmanifest` は変更なしでも動作します。

Service Workerのキャッシュ名をv2に更新しているため、公開後に古い画面が残る場合はページを一度閉じて開き直してください。

## v3 updates
- Tap a souvenir thumbnail to open a full-screen photo viewer.
- Added app icons (180/192/512 and maskable 512) for Home Screen / PWA install.
- Manifest now includes id, scope, standalone display, portrait orientation, and icon definitions.
- Service Worker cache version updated to v3.

### Important after updating from an older Home Screen shortcut
If the old shortcut still opens with the browser address/search bar, remove that shortcut once, open the GitHub Pages URL in Chrome, reload it, then use **Add to Home screen / Install app** again. Existing IndexedDB souvenir data normally remains as long as you do not clear the site's storage.
