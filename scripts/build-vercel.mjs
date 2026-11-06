import {mkdir,writeFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';
import {setupVercelDatabase} from './setup-vercel-db.mjs';

export async function buildVercel(environment=process.env){
  const directory=new URL('../public/',import.meta.url);
  await mkdir(directory,{recursive:true});
  for(const path of ['styles.css','app.js','favicon.svg']){
    const response=await worker.fetch(new Request('https://build.local/'+path),{});
    if(!response.ok)throw new Error('Não foi possível gerar '+path);
    await writeFile(new URL(path,directory),Buffer.from(await response.arrayBuffer()));
  }
  if(environment.TURSO_DATABASE_URL||environment.TURSO_AUTH_TOKEN)await setupVercelDatabase(environment);
  else console.log('Banco não configurado: páginas demonstrativas disponíveis; gravações ficam desabilitadas até a configuração do Turso.');
  console.log('Build Vercel concluído: public/ + função api/site.js.');
}
