import {createClient} from '@libsql/client/web';

function rows(result){return result.rows.map(row=>Object.fromEntries(result.columns.map((name,i)=>[name,row[i]])))}

// Adapta o cliente remoto ao contrato D1 usado pela aplicação.
export function createDatabase(client){
  return {
    prepare(sql){
      let args=[];
      return {
        bind(...values){args=values;return this},
        statement(){return {sql,args}},
        async all(){return {results:rows(await client.execute({sql,args}))}},
        async first(){return (await this.all()).results[0]??null},
        async run(){const result=await client.execute({sql,args});return {success:true,meta:{changes:result.rowsAffected}}},
      };
    },
    async batch(statements){return client.batch(statements.map(s=>s.statement()),'write')},
  };
}

// Capas ficam no mesmo banco remoto, sem depender do disco temporário da função.
export function createImageStore(db){
  return {
    async put(key,body,options){await db.prepare('INSERT INTO uploads (key,body,content_type) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET body=excluded.body,content_type=excluded.content_type').bind(key,new Uint8Array(body),options.httpMetadata.contentType).run()},
    async get(key){const record=await db.prepare('SELECT body,content_type FROM uploads WHERE key=?').bind(key).first();return record?{body:record.body,httpMetadata:{contentType:record.content_type}}:null},
  };
}

export function createTursoRuntime(environment){
  const client=createClient({url:environment.TURSO_DATABASE_URL,authToken:environment.TURSO_AUTH_TOKEN});
  const DB=createDatabase(client);
  return {DB,BUCKET:createImageStore(DB)};
}
