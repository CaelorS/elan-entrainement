import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const sessions=sqliteTable('sessions',{id:text('id').primaryKey(),payload:text('payload').notNull(),updated:integer('updated').notNull()});
export const runs=sqliteTable('runs',{id:text('id').primaryKey(),payload:text('payload').notNull(),updated:integer('updated').notNull()});
export const program=sqliteTable('program',{id:text('id').primaryKey(),payload:text('payload').notNull(),updated:integer('updated').notNull()});
