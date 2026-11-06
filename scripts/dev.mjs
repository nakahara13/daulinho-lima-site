import {createServer} from 'node:http';
import {mkdirSync,readFileSync} from 'node:fs';
import {createDB,createBucket} from './local-storage.mjs';
import './build.mjs';
const {default:worker}=await import('../dist/server/index.js?dev='+Date.now());
const data=new URL('../data/',import.meta.url);
mkdirSync(data,{recursive:true});
const env={DB:createDB(new URL('school.sqlite',data).pathname),BUCKET:createBucket(new URL('uploads/',data).pathname),LOCAL_DEV:true};
const port=Number(process.env.PORT||4180);
const server=createServer(async(req,res)=>{
  try{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>5*1024*1024+10000){res.writeHead(413);res.end('Arquivo muito grande');return}chunks.push(chunk)}
    const headers=new Headers();
    for(const [name,value] of Object.entries(req.headers)) if(!name.startsWith('oai-')&&value)headers.set(name,Array.isArray(value)?value.join(','):value);
    const request=new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
    const response=await worker.fetch(request,env);
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){console.error(e);res.writeHead(500);res.end('Erro no servidor local')}
});
server.listen(port,'127.0.0.1',()=>console.log('Daulinho Lima: http://127.0.0.1:'+port+' · Painel: /admin · Ctrl+C para encerrar'));
process.on('SIGINT',()=>server.close(()=>{env.DB.close();process.exit(0)}));
