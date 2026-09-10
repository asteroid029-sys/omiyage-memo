# おみやげメモ

スマホ向けの個人用お土産リストPWAです。データはブラウザのIndexedDBに保存するため、アプリ用サーバーやDBは不要です。

## 機能
- お土産の追加・編集・削除
- 名前、場所、GoogleマップURL、写真、予想金額、備考メモ
- 購入済みチェック
- すべて / 未購入 / 購入済みの絞り込み
- 購入数の進捗と予想金額合計
- 写真は端末側で最大1200px程度に圧縮して保存
- Service Workerによるオフライン利用

## いちばん簡単な公開方法
このフォルダをそのまま静的ホスティングに置きます。GitHub Pages / Cloudflare Pages / Netlify / Vercel などで動作します。

アプリ本体のサーバー処理はありません。HTML/CSS/JSを配信するだけです。

## スマホでアプリっぽく使う
Safari / Chromeで公開URLを開き、「ホーム画面に追加」します。PWAとして単独画面で起動できます。

## データ保存について
データはその端末・そのブラウザ内のIndexedDBに保存されます。別端末との同期はされません。また、ブラウザデータを消すと登録内容も消えます。

## 将来、端末間同期したい場合
Supabaseを追加する構成が簡単です。

テーブル例: souvenirs
- id: uuid
- user_id: uuid
- name: text
- place: text
- map_url: text
- photo_url: text
- price: integer
- memo: text
- done: boolean
- created_at: timestamptz
- updated_at: timestamptz

写真はSupabase Storageへ保存し、ログインはMagic LinkやGoogleログインにすると個人利用でも扱いやすいです。
