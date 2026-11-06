import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
export function createDB(filename=':memory:') {
  const sqlite=new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys=ON');
  const migrated=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").get();
  if(!migrated) sqlite.exec(readFileSync(new URL('../drizzle/0000_music_school.sql',import.meta.url),'utf8'));
  function prepare(sql) {
    let params=[];
    return {bind(...values){params=values;return this},async all(){return {results:sqlite.prepare(sql).all(...params)}},async first(){return sqlite.prepare(sql).get(...params)||null},async run(){return {success:true,meta:sqlite.prepare(sql).run(...params)}}};
  }
  return {prepare,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements) result.push(await s.run());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}},close(){sqlite.close()}};
}
export function createBucket(directory) {
  mkdirSync(directory,{recursive:true});
  return {async put(key,body,options){await writeFile(join(directory,key),new Uint8Array(body));await writeFile(join(directory,key+'.json'),JSON.stringify(options.httpMetadata))},async get(key){if(!existsSync(join(directory,key)))return null;return {body:await readFile(join(directory,key)),httpMetadata:JSON.parse(await readFile(join(directory,key+'.json'),'utf8'))}}};
}
