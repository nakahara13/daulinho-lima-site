import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createClient} from '@libsql/client/web';

export async function migrateVercelDatabase(client){
  await client.execute('CREATE TABLE IF NOT EXISTS _school_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)');
  for(const [name,file] of [['0000_music_school','../drizzle/0000_music_school.sql'],['0001_uploads','../server/uploads.sql']]){
    const applied=await client.execute({sql:'SELECT name FROM _school_migrations WHERE name=?',args:[name]});
    if(applied.rows.length)continue;
    const sql=await readFile(new URL(file,import.meta.url),'utf8');
    const statements=sql.split(/;\s*(?:--> statement-breakpoint\s*)?/).map(s=>s.trim()).filter(Boolean);
    await client.batch([...statements,{sql:'INSERT INTO _school_migrations (name,applied_at) VALUES (?,?)',args:[name,new Date().toISOString()]}],'write');
    console.log('Migração aplicada: '+name);
  }
}

export async function setupVercelDatabase(environment=process.env){
  if(!environment.TURSO_DATABASE_URL||!environment.TURSO_AUTH_TOKEN)throw new Error('Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN antes de preparar o banco.');
  const client=createClient({url:environment.TURSO_DATABASE_URL,authToken:environment.TURSO_AUTH_TOKEN});
  try{await migrateVercelDatabase(client)}finally{client.close()}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  try{await setupVercelDatabase()}catch(error){console.error('Não foi possível preparar o banco. Verifique as variáveis do Turso e a conexão.');process.exitCode=1}
}
