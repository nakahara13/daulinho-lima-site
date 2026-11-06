import {createHash,timingSafeEqual} from 'node:crypto';
import worker from '../dist/server/index.js';
import {createTursoRuntime} from './turso.js';

function same(a,b){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest())}
function authorized(request,environment){
  const header=request.headers.get('authorization')||'';
  if(!header.startsWith('Basic '))return false;
  const credentials=Buffer.from(header.slice(6),'base64').toString('utf8');
  const separator=credentials.indexOf(':');
  if(separator<0)return false;
  const validUser=same(credentials.slice(0,separator),environment.ADMIN_USERNAME||'admin');
  const validPassword=same(credentials.slice(separator+1),environment.ADMIN_PASSWORD);
  return validUser&&validPassword;
}
function unavailable(message){return Response.json({error:message},{status:503,headers:{'cache-control':'no-store'}})}

export function createVercelHandler({environment=process.env,runtimeFactory=createTursoRuntime}={}){
  let runtime;
  return async function fetch(request){
    try{
      const url=new URL(request.url);
      if(url.searchParams.has('__route')){
        url.pathname='/'+url.searchParams.get('__route').replace(/^\/+/, '');
        url.searchParams.delete('__route');
      }
      const path=url.pathname.replace(/\/$/,'')||'/';
      const restricted=path==='/admin'||path.startsWith('/api/admin/');
      const configured=!!(environment.TURSO_DATABASE_URL&&environment.TURSO_AUTH_TOKEN);
      if(restricted){
        if(!environment.ADMIN_PASSWORD||environment.ADMIN_PASSWORD.length<16)return unavailable('Configure ADMIN_PASSWORD na Vercel com uma senha de pelo menos 16 caracteres para ativar o painel.');
        if(!authorized(request,environment))return new Response('Entre com o usuário e a senha da administração.',{status:401,headers:{'www-authenticate':'Basic realm="Daulinho Lima", charset="UTF-8"','cache-control':'no-store','content-type':'text/plain; charset=utf-8'}});
        if(!configured)return unavailable('Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN na Vercel e publique novamente para ativar o blog e o painel.');
      }
      if(!configured&&path.startsWith('/api/'))return unavailable('O blog ainda está em demonstração. Configure o banco de dados para habilitar publicações e comentários.');
      // Cabeçalhos de identidade recebidos do público nunca autorizam o painel.
      const headers=new Headers(request.headers);
      for(const name of [...headers.keys()])if(name.startsWith('oai-'))headers.delete(name);
      headers.delete('cf-connecting-ip');
      const forwarded=request.headers.get('x-vercel-forwarded-for');
      if(forwarded)headers.set('cf-connecting-ip',forwarded.split(',')[0].trim());
      if(restricted)headers.set('oai-authenticated-user-id','vercel-administrator');
      const routed=new Request(url,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,duplex:'half'});
      if(configured)runtime??=runtimeFactory(environment);
      return worker.fetch(routed,{...runtime,READ_ONLY_DEMO:!configured,ADMIN_USER_ID:'vercel-administrator'});
    }catch(error){
      console.error('Falha no adaptador Vercel:',error.name);
      return unavailable('Não foi possível conectar o site ao armazenamento. Verifique a configuração e tente novamente.');
    }
  };
}
