-- Project Name : library
-- Date/Time    : 2020/05/03 20:36:58
-- Author       : kanedaq
-- RDBMS Type   : PostgreSQL
-- Application  : A5:SQL Mk-2

/*
  BackupToTempTable, RestoreFromTempTable疑似命令が付加されています。
  これにより、drop table, create table 後もデータが残ります。
  この機能は一時的に $$TableName のような一時テーブルを作成します。
*/

-- openBD
--* BackupToTempTable
drop table if exists openbd cascade;

--* RestoreFromTempTable
create table openbd (
  isbn text not null
  , title text
  , volume text
  , series text
  , publisher text
  , pubdate text
  , cover text
  , author text
  , regist_datetime timestamp not null
  , constraint openbd_PKC primary key (isbn)
) ;

create index openbd_IX1
  on openbd(pubdate);

comment on table openbd is 'openBD';
comment on column openbd.isbn is 'ISBN';
comment on column openbd.title is '書名';
comment on column openbd.volume is '巻号';
comment on column openbd.series is 'シリーズ名';
comment on column openbd.publisher is '出版者';
comment on column openbd.pubdate is '出版年月';
comment on column openbd.cover is '書影URL';
comment on column openbd.author is '著者名';
comment on column openbd.regist_datetime is 'データ登録日時';
