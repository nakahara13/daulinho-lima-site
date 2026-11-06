'use strict';
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;
function toast(text){const el=$('.toast');el.textContent=text;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4200)}
function message(form,text,error=false){const el=$('.form-message',form);el.textContent=text;el.classList.toggle('error',error)}
async function api(path,method='GET',body){
  const options={method,headers:{}};
  if(body instanceof FormData)options.body=body;
  else if(body!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body)}
  const res=await fetch(path,options);
  let result;
  try{result=await res.json()}catch{throw new Error('Não foi possível obter uma resposta. Tente novamente.')}
  if(!res.ok)throw new Error(result.error||'Não foi possível concluir. Tente novamente.');
  return result;
}
const menu=$('.menu-toggle');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');$('#navigation').classList.toggle('open',open)});
$$('#navigation a').forEach(a=>a.addEventListener('click',()=>{menu.setAttribute('aria-expanded','false');$('#navigation').classList.remove('open')}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){menu.setAttribute('aria-expanded','false');$('#navigation').classList.remove('open');menu.focus()}});
document.addEventListener('click',e=>{
  const close=e.target.closest('[data-close]');
  if(close)close.closest('dialog')?.close();
  const contact=e.target.closest('[data-contact],[data-course]');
  if(contact){const dialog=$('#contact-dialog'),link=$('a[href^="https://wa.me/"]',dialog);if(link){const url=new URL(link.href);url.searchParams.set('text',contact.dataset.course?'Olá! Quero conhecer o curso de '+contact.dataset.course+'.':'Olá! Quero conhecer os cursos da escola.');link.href=url.toString()}dialog.showModal()}
});
$$('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close()}));

let category='all';
function filterPosts(){
  const query=($('#post-search')?.value||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  let visible=0;
  $$('[data-post-category]').forEach(card=>{const search=card.dataset.search.normalize('NFD').replace(/[\u0300-\u036f]/g,'');card.hidden=(category!=='all'&&card.dataset.postCategory!==category)||!search.includes(query);if(!card.hidden)visible++});
  const empty=$('.search-empty');if(empty)empty.hidden=visible>0;
}
$$('[data-filter]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.filter;$$('[data-filter]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});filterPosts()}));
$('#post-search')?.addEventListener('input',filterPosts);
$('#comment-form')?.addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,button=$('[type="submit"]',form);button.disabled=true;message(form,'Enviando seu comentário…');
  try{const data=Object.fromEntries(new FormData(form));data.post_id=form.dataset.post;const result=await api('/api/comments','POST',data);form.reset();message(form,result.message);toast('Comentário enviado para aprovação.')}catch(error){message(form,error.message,true)}finally{button.disabled=false}
});
$('[data-share]')?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:document.title,url:location.href});else{await navigator.clipboard.writeText(location.href);toast('Link copiado. Compartilhe essa história!')}}catch(error){if(error.name!=='AbortError')toast('Copie o endereço da página para compartilhar.')}});

let adminData=null,deleteId=null,uploading=false;
function imageURL(value){return /^https:\/\//i.test(value||'')||/^\/media\/[\w.-]+$/.test(value||'')?value:''}
function renderAdmin(){
  $('#admin-post-list').innerHTML=adminData.posts.length?adminData.posts.map(p=>'<article class="admin-row"><img src="'+escapeHTML(imageURL(p.cover))+'" alt=""><div class="admin-row-content"><h3>'+escapeHTML(p.title)+'</h3><p><span class="status '+escapeHTML(p.status)+'">'+(p.status==='published'?'Publicado':'Rascunho')+'</span>'+escapeHTML(p.category)+' · '+escapeHTML(p.author)+'</p></div><div class="row-actions">'+(p.status==='published'?'<a href="/blog/'+escapeHTML(p.slug)+'" target="_blank" rel="noopener">Ver post ↗</a>':'')+'<button data-edit="'+escapeHTML(p.id)+'">Editar</button><button data-delete="'+escapeHTML(p.id)+'">Excluir</button></div></article>').join(''):'<p class="empty">Sua próxima história começa no botão Novo post.</p>';
  const statusLabels={pending:'Aguardando aprovação',approved:'Aprovado',rejected:'Recusado'};
  $('#admin-comment-list').innerHTML=adminData.comments.length?adminData.comments.map(c=>'<article class="admin-row admin-comment"><div class="admin-row-content"><span class="status '+escapeHTML(c.status)+'">'+statusLabels[c.status]+'</span><b>'+escapeHTML(c.name)+'</b><p>Em: '+escapeHTML(c.post_title)+'</p><p>'+escapeHTML(c.body)+'</p></div><div class="row-actions">'+(c.status!=='approved'?'<button data-moderate="'+escapeHTML(c.id)+'" data-status="approved">Aprovar</button>':'')+(c.status!=='rejected'?'<button data-moderate="'+escapeHTML(c.id)+'" data-status="rejected">Recusar</button>':'')+'</div></article>').join(''):'<p class="empty">Os comentários dos leitores aparecerão aqui.</p>';
  const pending=adminData.comments.filter(c=>c.status==='pending').length;$('#pending-count').textContent=pending||'';
}
function fillSettings(){
  const form=$('#settings-form'),s=adminData.settings;
  ['whatsapp','phone','email','address','city','hours'].forEach(key=>form.elements[key].value=s[key]||'');form.elements.demo.checked=s.demo;
  const labels={name:'Nome do curso',tag:'Tipo de instrumento',description:'Descrição',schedule:'Dias e horários',level:'Público e nível',image:'URL da imagem'};
  $('#course-fields').innerHTML=s.courses.map((c,i)=>'<fieldset class="course-fieldset"><legend>Curso '+(i+1)+'</legend>'+Object.entries(labels).map(([key,label])=>'<label>'+label+(key==='description'?'<textarea name="course.'+i+'.'+key+'" required rows="3" maxlength="2000">'+escapeHTML(c[key])+'</textarea>':'<input name="course.'+i+'.'+key+'" required maxlength="2000" value="'+escapeHTML(c[key])+'">')+'</label>').join('')+'</fieldset>').join('');
}
async function loadAdmin(settings=false){adminData=await api('/api/admin/data');renderAdmin();if(settings)fillSettings()}
function previewCover(){const input=$('#post-form').elements.cover,preview=$('#cover-preview'),url=imageURL(input.value);preview.hidden=!url;if(url)preview.src=url;else preview.removeAttribute('src')}
function openEditor(id){
  const form=$('#post-form');form.reset();form.elements.id.value='';message(form,'');
  if(id){const p=adminData.posts.find(p=>p.id===id);if(!p)return;['id','title','author','category','excerpt','cover','content','status'].forEach(key=>form.elements[key].value=p[key]);$('#editor-title').textContent='Ajuste sua história.'}
  else{$('#editor-title').textContent='Uma nova história.';form.elements.author.value='Daulinho Lima';form.elements.category.value='Música';form.elements.status.value='published'}
  previewCover();$('#editor-dialog').showModal();
}
if($('#admin-post-list')){
  loadAdmin(true).catch(error=>{$('#admin-post-list').textContent=error.message;toast(error.message)});
  $('#new-post').addEventListener('click',()=>openEditor());
  $$('[data-tab]').forEach(tab=>tab.addEventListener('click',()=>{$$('[data-tab]').forEach(t=>{const active=t===tab;t.classList.toggle('active',active);t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;$('#panel-'+t.dataset.tab).hidden=!active})}));
  $('.admin-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=$$('[data-tab]'),current=tabs.indexOf(document.activeElement),index=e.key==='Home'?0:e.key==='End'?tabs.length-1:(current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[index].click();tabs[index].focus()});
  document.addEventListener('click',async e=>{
    const edit=e.target.closest('[data-edit]');if(edit)openEditor(edit.dataset.edit);
    const remove=e.target.closest('[data-delete]');if(remove){deleteId=remove.dataset.delete;$('#delete-dialog').showModal()}
    const moderate=e.target.closest('[data-moderate]');if(moderate){moderate.disabled=true;try{await api('/api/admin/comments/'+encodeURIComponent(moderate.dataset.moderate),'PATCH',{status:moderate.dataset.status});await loadAdmin();toast('Comentário atualizado.')}catch(error){toast(error.message);moderate.disabled=false}}
  });
  $('#confirm-delete').addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;try{await api('/api/admin/posts/'+encodeURIComponent(deleteId),'DELETE');$('#delete-dialog').close();await loadAdmin();toast('Post excluído.')}catch(error){toast(error.message)}finally{button.disabled=false}});
  $('#post-form').elements.cover.addEventListener('input',previewCover);
  $('#cover-preview').addEventListener('error',()=>{$('#cover-preview').hidden=true});
  $('#cover-upload').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    const form=$('#post-form'),button=$('[type="submit"]',form);
    if(file.size>5*1024*1024){message(form,'A imagem deve ter até 5 MB.',true);return}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){message(form,'Use JPG, PNG ou WebP.',true);return}
    uploading=true;button.disabled=true;message(form,'Enviando imagem…');
    try{const body=new FormData();body.append('file',file);const result=await api('/api/admin/upload','POST',body);form.elements.cover.value=result.url;previewCover();message(form,'Imagem enviada. Salve o post para publicar.')}catch(error){message(form,error.message,true)}finally{uploading=false;button.disabled=false}
  });
  $('#post-form').addEventListener('submit',async e=>{
    e.preventDefault();if(uploading)return;const form=e.currentTarget,button=$('[type="submit"]',form);button.disabled=true;message(form,'Salvando…');
    try{const data=Object.fromEntries(new FormData(form));await api('/api/admin/posts','POST',data);$('#editor-dialog').close();await loadAdmin();toast(data.status==='published'?'Post publicado. Já está no blog!':'Rascunho salvo.')}catch(error){message(form,error.message,true)}finally{button.disabled=false}
  });
  $('#settings-form').addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,button=$('[type="submit"]',form);button.disabled=true;message(form,'Salvando informações…');
    try{const values=Object.fromEntries(new FormData(form)),data={};['whatsapp','phone','email','address','city','hours'].forEach(k=>data[k]=values[k]);data.demo=form.elements.demo.checked;data.courses=adminData.settings.courses.map((c,i)=>Object.fromEntries(Object.keys(c).map(k=>[k,values['course.'+i+'.'+k]??c[k]])));await api('/api/admin/settings','PUT',data);await loadAdmin();message(form,'Informações atualizadas. As alterações já aparecem no site.');toast('Informações da escola salvas.')}catch(error){message(form,error.message,true)}finally{button.disabled=false}
  });
}
