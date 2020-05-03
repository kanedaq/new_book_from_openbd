import dotenv from "dotenv";
import fs from "fs";
const rp = require('request-promise');

// https://qiita.com/masaks/items/3ee1b5a06a95315a7ae7 の postgres.js を利用（感謝）
import {getPostgresClient} from "./postgres"

// https://qiita.com/iz-j/items/edbdf29065777f9518af の toISBN10 を利用（感謝）
import {toISBN10} from "./toISBN10"

// NTPサーバーから現在時刻を取得して返す
async function ntp_now(): Promise<Date> {
    const options = {
        uri: "https://ntp-a1.nict.go.jp/cgi-bin/json",
    };

    let now: Date = new Date();  // nullにしたくないので仮の値を入れておく
    const time_before = now.getTime();  // NTPサーバーにアクセス前の時刻
    await rp(options)
        .then(async function (res: string) {
            const time_after = new Date().getTime();  // NTPサーバーにアクセス後の時刻
            const json = JSON.parse(res);
            const time_std = Number(json.st) * 1000;
            const time_fix = time_std + (time_after - time_before) / 2;
            now = new Date(time_fix);
        });
    return now;
}

// OpenBD APIを呼んで全ISBNを取得
async function openbd_coverage(): Promise<string[]> {
    const options = {
        uri: "https://api.openbd.jp/v1/coverage",
        "Content-Type": "application/json",
    };

    let array: string[] = [];
    await rp(options)
        .then(function (coverage: string) {
            array = JSON.parse(coverage);
        });
    return array;
}

// OpenBD の get API を呼ぶ
async function openbd_post(isbns: string): Promise<string[] | null> {
    let json = null;

    const options = {
        method: "POST",
        uri: "http://api.openbd.jp/v1/get",
        form: {
            isbn: isbns
        },
    };
    await rp(options)
        .then(function (res: string) {
            json = JSON.parse(res);
        });

    return json;
}

// PostgreSQL登録用の日付フォーマット
function date_format_for_pg(dt: Date): string {
    return dt.getFullYear().toString() + '/'
        + (dt.getMonth() + 1) + '/'
        + dt.getDate() + ' '
        + dt.getHours() + ':'
        + dt.getMinutes() + ':'
        + dt.getSeconds();
}

// PostgreSQL登録用の列値
function set_col(
    param: any[],
    column: string
): string
{
    column = column.trim();
    if (0 < column.length) {
        param.push(column);
        return column;
    }
    else {
        param.push(null);
        return "NULL";
    }
}

// PostgreSQLに書籍情報を登録
async function db_insert(
    json: any,
    db: any,
    regist_datetime: string,
    this_year: number,
    fo: any
)
{
    let sql = `INSERT INTO openbd (isbn, title, volume, series, publisher, pubdate, cover, author, regist_datetime) VALUES
 `;
    let param: Array<string | null> = [];
    let param_no = 1;
    let is_first = true;

    for (const elem of json) {
        const isbn: string = set_col(param, elem.summary.isbn);
        const title: string = set_col(param, elem.summary.title);
        const volume: string = set_col(param, elem.summary.volume);
        const series: string = set_col(param, elem.summary.series);
        const publisher: string = set_col(param, elem.summary.publisher);
        const pubdate: string = set_col(param, elem.summary.pubdate);
        const cover: string = set_col(param, elem.summary.cover);
        const author: string = set_col(param, elem.summary.author);

        if (pubdate != "NULL") {
            if (this_year - 1 <= Number(pubdate.slice(0, 4))) {
                let output: string = "-----------------------------------\n";
                if (title != "NULL") {
                    output += "書名：" + title + '\n';
                }
                if (author != "NULL") {
                    output += "著者：" + author + '\n';
                }
                if (publisher != "NULL") {
                    output += "出版者：" + publisher + '\n';
                }
                output += "出版年月：" + pubdate + "\n";
                output += "ISBN：" + isbn + '\n';
                output += "http://www.amazon.co.jp/dp/" + toISBN10(isbn) + "/\n\n";
                fs.writeSync(fo, output);
            }
        }

        if (is_first) {
            is_first = false;
        }
        else {
            sql += ',';
        }
        sql += `($${param_no}, $${param_no+1}, $${param_no+2}, $${param_no+3}, $${param_no+4}, $${param_no+5}, $${param_no+6}, $${param_no+7}, '${regist_datetime}')
`;
        param_no += 8;
    }
    await db.begin();
    await db.execute(sql, param);
    await db.commit();
}

// 該当ブロックから新着情報を抽出する処理
async function do_block(
    array_isbn: string[],
    db: any,
    regist_datetime: string,
    this_year: number,
    fo: any
): Promise<number>
{
    // 新規ISBNを抽出するSQL文構築
    let sql =
`WITH coverage AS (
SELECT '${array_isbn[0]}' AS isbn
`;
    for (let ii = 1; ii < array_isbn.length; ++ii) {
        sql +=
`UNION ALL
SELECT '${array_isbn[ii]}'
`;
    }
    sql +=
`)
SELECT isbn
FROM coverage
    EXCEPT
SELECT isbn
FROM openbd
`;

    // DB処理
    const db_rows = await db.execute(sql);
    if (db_rows.length <= 0) {
        console.log("ブロック内の新ISBN件数: 0");
        return 0;
    }

    // 最大10000件ずつopenBD APIにpost
    let count_block = 0;
    let count_this_func = 0;
    let post_isbns = "";
    for (const db_row of db_rows) {
        if (0 < count_block) {
            post_isbns += ',';
        }
        post_isbns += db_row.isbn;
        ++count_block;
        if (count_block == 10000) {
            const json = await openbd_post(post_isbns);
            await db_insert(json, db, regist_datetime, this_year, fo);

            count_this_func += count_block;
            count_block = 0;
            post_isbns = "";
        }
    }
    if (0 < count_block) {
        const json = await openbd_post(post_isbns);
        await db_insert(json, db, regist_datetime, this_year, fo);
    }

    count_this_func += count_block;
    console.log("ブロック内の新ISBN件数: " + db_rows.length + "、コミット件数: " + count_this_func);
    return count_this_func;
}

// main
(async () => {
    dotenv.config();

    // 新着本をファイルに出力するための処理
    const filename_o = `${process.env.NEWLY_ARRIVED_OUTFILE}`;
    let fo = null;
    if (filename_o != "undefined") {
        fo = fs.openSync(filename_o, "w");
    }

    const size_block = Number(`${process.env.BLOCK_SIZE}`);

    // openBDから全ISBNを取得
    let all_isbn = await openbd_coverage();
    console.log("openBD APIで取得したカバレッジ（全ISBN）件数: " + all_isbn.length);
    const num_block = Math.ceil(all_isbn.length / size_block);
    console.log(num_block.toString() + " ブロックに分けて処理します。");

    // DB登録
    const db = await getPostgresClient();
    try {
        const start = await ntp_now();
        const regist_datetime: string = date_format_for_pg(start);
        const this_year: number = start.getFullYear();

        let count_total = 0;
        let block = 0;

        while (0 < all_isbn.length) {
            ++block;
            console.log("[" + block + " / " + num_block + "]");
            count_total += await do_block(all_isbn.splice(0, size_block), db, regist_datetime, this_year, fo);
            console.log("今まで: " + count_total + " 件コミットしました。");
        }
        console.log("トータル: " + count_total + " 件コミットしました。");

        const end = await ntp_now();
        console.log("処理時間: " + (end.getTime() - start.getTime()) / 1000 + " 秒");
        console.log("1ブロックあたり処理時間: " + (end.getTime() - start.getTime()) / (1000 * num_block) + " 秒");
    } finally {
        await db.release();
        if (fo != null) {
            fs.closeSync(fo);
        }
    }
})();
