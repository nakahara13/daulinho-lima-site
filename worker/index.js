import { DEFAULTS, SEEDS, arrow } from './data.js';
import { home, blogPage, articlePage, adminPage, shell } from './views.js';
// STYLE e CLIENT são incorporados ao Worker pelo build, sem arquivos de assets externos.

function json(data,status=200) { return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}}); }
function admin(request,env) {
  if(env.LOCAL_DEV===true) return true;
  const id=request.headers.get('oai-authenticated-user-id');
  if(!id) return false;
  if(env.ADMIN_USER_ID) return id===env.ADMIN_USER_ID;
  // O primeiro acesso é protegido pela política owner-private do Sites.
  return env.SITE_OWNER_PRIVATE==='true';
}
async function initialize(db) {
  if(await db.prepare("SELECT value FROM settings WHERE key='initialized'").first()) return;
  const date='2026-11-06T12:00:00.000Z';
  await db.batch([
    ...SEEDS.map(p=>db.prepare('INSERT OR IGNORE INTO posts (id,slug,title,excerpt,content,cover,category,author,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(p.id,p.slug,p.title,p.excerpt,p.content,p.cover,p.category,'Daulinho Lima','published',date,date)),
    db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)').bind('school',JSON.stringify(DEFAULTS)),
    db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)').bind('initialized','true'),
  ]);
}
async function getData(env,all=false) {
  if(!env.DB&&env.READ_ONLY_DEMO)return {settings:DEFAULTS,posts:SEEDS.map(p=>({...p,author:'Daulinho Lima',status:'published',created_at:'2026-11-06T12:00:00.000Z',updated_at:'2026-11-06T12:00:00.000Z'}))};
  await initialize(env.DB);
  const setting=await env.DB.prepare("SELECT value FROM settings WHERE key='school'").first();
  const posts=await env.DB.prepare('SELECT * FROM posts'+(all?'':" WHERE status='published'")+' ORDER BY created_at DESC, id ASC').all();
  return {settings:{...DEFAULTS,...JSON.parse(setting?.value||'{}')},posts:posts.results};
}
function validImage(value) { return typeof value==='string'&&(/^https:\/\/[^\s<>]+$/i.test(value)||/^\/media\/[a-zA-Z0-9._-]+$/.test(value)); }
async function api(request,env,url) {
  const path=url.pathname,method=request.method;
  if(path.startsWith('/api/admin/')) {
    if(!admin(request,env)) return json({error:'Entre com a conta administradora para continuar.'},403);
    if(method!=='GET'&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin) return json({error:'Origem não autorizada.'},403);
    // Fixa a identidade da primeira pessoa proprietária que abre o painel privado.
    if(!env.LOCAL_DEV&&!env.ADMIN_USER_ID) {
      const id=request.headers.get('oai-authenticated-user-id');
      await env.DB.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('admin_user_id',?)").bind(id).run();
      const owner=await env.DB.prepare("SELECT value FROM settings WHERE key='admin_user_id'").first();
      if(owner.value!==id) return json({error:'Acesso restrito à administração da escola.'},403);
    }
  }
  await initialize(env.DB);
  if(path==='/api/admin/data'&&method==='GET') {
    const data=await getData(env,true);
    const comments=await env.DB.prepare('SELECT comments.id,comments.name,comments.body,comments.status,comments.created_at,posts.title AS post_title FROM comments JOIN posts ON posts.id=comments.post_id ORDER BY comments.created_at DESC').all();
    return json({...data,comments:comments.results});
  }
  if(path==='/api/admin/posts'&&method==='POST') {
    const b=await request.json();
    const limits={title:[1,160],author:[1,80],category:[1,50],excerpt:[1,300],content:[20,50000],cover:[1,2000]};
    for(const [key,[min,max]] of Object.entries(limits)) if(typeof b[key]!=='string'||b[key].trim().length<min||b[key].length>max) return json({error:'Verifique o campo '+key+'.'},400);
    if(!['draft','published'].includes(b.status)) return json({error:'Status inválido.'},400);
    if(!validImage(b.cover)) return json({error:'Use uma imagem HTTPS ou enviada pelo painel.'},400);
    const id=b.id||crypto.randomUUID(),now=new Date().toISOString();
    if(typeof id!=='string'||id.length>100) return json({error:'Identificador inválido.'},400);
    const existing=await env.DB.prepare('SELECT slug FROM posts WHERE id=?').bind(id).first();
    if(b.id&&!existing) return json({error:'Post não encontrado.'},404);
    const slug=existing?.slug||(b.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)||'post')+'-'+id.slice(0,8);
    await env.DB.prepare('INSERT INTO posts (id,slug,title,excerpt,content,cover,category,author,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,cover=excluded.cover,category=excluded.category,author=excluded.author,status=excluded.status,updated_at=excluded.updated_at').bind(id,slug,b.title.trim(),b.excerpt.trim(),b.content.trim(),b.cover,b.category.trim(),b.author.trim(),b.status,now,now).run();
    return json({ok:true,id,slug});
  }
  if(path.startsWith('/api/admin/posts/')&&method==='DELETE') {
    const id=decodeURIComponent(path.split('/').pop());
    await env.DB.batch([env.DB.prepare('DELETE FROM comments WHERE post_id=?').bind(id),env.DB.prepare('DELETE FROM posts WHERE id=?').bind(id)]);
    return json({ok:true});
  }
  if(path==='/api/admin/settings'&&method==='PUT') {
    const b=await request.json();
    for(const field of ['whatsapp','phone','email','address','city','hours']) if(typeof b[field]!=='string'||b[field].length>300) return json({error:'Dados de contato inválidos.'},400);
    const digits=b.whatsapp.replace(/\D/g,'');
    if(digits&&!/^\d{10,15}$/.test(digits)) return json({error:'Informe o WhatsApp com país e DDD, de 10 a 15 dígitos.'},400);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return json({error:'Informe um e-mail válido.'},400);
    if(!b.address.trim()||!b.city.trim()||!b.hours.trim()) return json({error:'Preencha endereço, cidade e horário.'},400);
    if(!Array.isArray(b.courses)||b.courses.length!==4) return json({error:'Preencha os quatro cursos.'},400);
    for(const c of b.courses) for(const key of ['name','tag','description','schedule','level','image']) if(typeof c?.[key]!=='string'||!c[key].trim()||c[key].length>2000) return json({error:'Preencha os dados dos cursos.'},400);
    if(b.courses.some(c=>!validImage(c.image))) return json({error:'Use imagens HTTPS para os cursos.'},400);
    const setting={whatsapp:digits,phone:b.phone,email:b.email,address:b.address,city:b.city,hours:b.hours,demo:!!b.demo,courses:b.courses};
    await env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(JSON.stringify(setting),'school').run();
    return json({ok:true});
  }
  if(path==='/api/admin/upload'&&method==='POST') {
    if(Number(request.headers.get('content-length'))>3*1024*1024+10000) return json({error:'A imagem deve ter até 3 MB.'},413);
    const form=await request.formData(),file=form.get('file');
    if(!file||typeof file.arrayBuffer!=='function'||file.size>3*1024*1024) return json({error:'Escolha uma imagem de até 3 MB.'},400);
    const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
    if(!types[file.type]) return json({error:'Use uma imagem JPG, PNG ou WebP.'},400);
    const buffer=await file.arrayBuffer(),bytes=new Uint8Array(buffer);
    const valid=file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:file.type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if(!valid) return json({error:'O arquivo não é uma imagem válida.'},400);
    if(!env.BUCKET) return json({error:'O armazenamento de imagens não está disponível.'},503);
    const key=crypto.randomUUID()+'.'+types[file.type];
    await env.BUCKET.put(key,buffer,{httpMetadata:{contentType:file.type}});
    return json({url:'/media/'+key});
  }
  if(path.startsWith('/api/admin/comments/')&&method==='PATCH') {
    const b=await request.json(),id=decodeURIComponent(path.split('/').pop());
    if(!['approved','rejected','pending'].includes(b.status)) return json({error:'Status inválido.'},400);
    await env.DB.prepare('UPDATE comments SET status=? WHERE id=?').bind(b.status,id).run();
    return json({ok:true});
  }
  if(path==='/api/comments'&&method==='POST') {
    if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin) return json({error:'Origem não autorizada.'},403);
    const b=await request.json();
    if(b.website) return json({ok:true});
    if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80||typeof b.body!=='string'||b.body.trim().length<3||b.body.length>2000) return json({error:'Informe seu nome e um comentário entre 3 e 2.000 caracteres.'},400);
    const post=await env.DB.prepare("SELECT id FROM posts WHERE id=? AND status='published'").bind(String(b.post_id||'')).first();
    if(!post) return json({error:'Publicação não encontrada.'},404);
    const raw=(request.headers.get('cf-connecting-ip')||'local')+'|'+(request.headers.get('user-agent')||'');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
    const fingerprint=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
    const recent=await env.DB.prepare('SELECT COUNT(*) AS total FROM comments WHERE fingerprint=? AND created_at>?').bind(fingerprint,new Date(Date.now()-60000).toISOString()).first();
    if(recent.total>=3) return json({error:'Aguarde um minuto antes de enviar outro comentário.'},429);
    await env.DB.prepare('INSERT INTO comments (id,post_id,name,body,status,created_at,fingerprint) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),post.id,b.name.trim(),b.body.trim(),'pending',new Date().toISOString(),fingerprint).run();
    return json({ok:true,message:'Comentário enviado! Ele será publicado após a aprovação da escola.'},201);
  }
  return json({error:'Rota não encontrada.'},404);
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/';
    try {
      if(path==='/styles.css') return new Response(STYLE,{headers:{'content-type':'text/css; charset=utf-8','cache-control':'public,max-age=3600'}});
      if(path==='/app.js') return new Response(CLIENT,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'public,max-age=3600'}});
      if(path==='/favicon.svg') return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#111"/><text x="32" y="45" text-anchor="middle" font-size="45" fill="white">♪</text></svg>',{headers:{'content-type':'image/svg+xml'}});
      if(path.startsWith('/media/')) {
        const key=path.slice(7);
        if(!/^[a-zA-Z0-9._-]+$/.test(key)) return new Response('Não encontrado',{status:404});
        const object=await env.BUCKET?.get(key);
        if(!object) return new Response('Imagem não encontrada',{status:404});
        return new Response(object.body,{headers:{'content-type':object.httpMetadata?.contentType||'application/octet-stream','cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff'}});
      }
      if(path.startsWith('/api/')) {
        if(Number(request.headers.get('content-length'))>100000&&!path.endsWith('/upload')) return json({error:'Conteúdo muito grande.'},413);
        return await api(request,env,url);
      }
      if(request.method!=='GET'&&request.method!=='HEAD') return new Response('Método não permitido',{status:405});
      const {settings,posts}=await getData(env);
      let html,status=200;
      if(path==='/') html=home(settings,posts);
      else if(path==='/blog') html=blogPage(settings,posts);
      else if(path==='/admin') html=adminPage(settings,admin(request,env));
      else if(path.startsWith('/blog/')) {
        const post=posts.find(p=>p.slug===decodeURIComponent(path.slice(6)));
        if(post) {
          const comments=env.DB?await env.DB.prepare("SELECT name,body,created_at FROM comments WHERE post_id=? AND status='approved' ORDER BY created_at DESC").bind(post.id).all():{results:[]};
          html=articlePage(settings,post,posts,comments.results);
        }
      }
      if(!html) {status=404;html=shell('<section class="container login-page"><span class="eyebrow">404 · PAUSA NA MELODIA</span><h1>Essa nota<br><em>não está aqui.</em></h1><p>A página pode ter mudado de endereço. Continue explorando a escola.</p><a class="button dark" href="/">Voltar ao início '+arrow+'</a></section>',settings,'Página não encontrada — Daulinho Lima');}
      return new Response(request.method==='HEAD'?null:html,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data: blob:; connect-src 'self'; frame-src https://maps.google.com; base-uri 'self'; form-action 'self'; object-src 'none'"}});
    } catch(error) {
      console.error('Falha na requisição:',error.name,error.message);
      if(error instanceof SyntaxError) return json({error:'Os dados enviados não são válidos.'},400);
      if(path.startsWith('/api/')) return json({error:'Não foi possível concluir. Tente novamente.'},500);
      return new Response('Não foi possível carregar a escola agora. Tente novamente em instantes.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
    }
  },
};
