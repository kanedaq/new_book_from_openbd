# new_book_from_openbd
openBDプロジェクトを利用して、新着書籍の情報を取得します。

自分用プロジェクトなので、いろいろ手抜きがあります。

typescriptに不慣れな時に開発したコードですが、宜しければご利用ください。

## 処理内容
openBD APIを呼び出して全ISBNを取得し、PostgreSQLデータベースとの差分を新着書籍として抽出します。

## 必要なソースコード
このリポジトリのソースコードだけでは動きませんので、他のサイトから入手をお願いします。

### 以下のサイトの postgres.js のコードを、src/postgres.js に保存してください。

connectionString（接続URL）は、ご自身の環境に合わせて書き直してください。

https://qiita.com/masaks/items/3ee1b5a06a95315a7ae7

### 以下のサイトのコードを、src/toISBN10.js に保存してください。

toISBN10関数は export してください。

https://qiita.com/iz-j/items/edbdf29065777f9518af

### postgres.js 及び toISBN10 を開発された方々に感謝いたします。

postgres.js 及び toISBN10 の著作権は、各々の開発者が保有しています。

本ソフトウェア（new_book_from_openbd）についてのお問い合わせを、postgres.js 及び toISBN10 の開発者の方々になさらないよう、お願いいたします。

## 必要なデータベース
PostgreSQLをインストールし、create_table.sql を実行して openbd テーブルを作成してください。

## 設定ファイル
.env が設定ファイルです。設定ファイルの中のコメントに従って設定を行ってください。

## インストール方法と実行方法
git cloneしてから、

npm install（最初の一回だけ）

npm run main

