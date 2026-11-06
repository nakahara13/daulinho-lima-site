import { renderArticle, safeImage, slugify, readingMinutes } from './post-template.js';

const form = document.querySelector('#post-form');
const publishForm = document.querySelector('#publish-form');
const status = document.querySelector('#editor-status');
const publishStatus = document.querySelector('#publish-status');
const previewSection = document.querySelector('#editor-preview');
const preview = document.querySelector('#post-preview');
const coverPreview = document.querySelector('#cover-preview');
const coverNote = document.querySelector('#cover-note');
const upload = document.querySelector('#cover-upload');
const publishButton = document.querySelector('#publish-button');
let embeddedCover = '';
let manualSlug = false;
let loadingCover = false;
let pendingUpdate = null;
let previewTimer;

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
form.elements.date.value = localDate();

function message(element, text, error = false) {
  element.textContent = text;
  element.classList.toggle('error', error);
  element.classList.toggle('success', Boolean(text) && !error);
}
function clearUpdate() {
  pendingUpdate = null;
  publishButton.textContent = 'Publicar no GitHub ↗';
}
function updatePath() {
  const slug = slugify(form.elements.slug.value || form.elements.title.value);
  document.querySelector('#post-path').textContent = `blog/${slug || 'seu-post'}.html`;
  document.querySelector('#reading-time').textContent = `${readingMinutes(form.elements.content.value)} min de leitura`;
}
function updateCover() {
  const value = embeddedCover || form.elements.cover.value.trim();
  coverPreview.hidden = !value;
  if (value) coverPreview.src = safeImage(value);
  else coverPreview.removeAttribute('src');
  coverNote.textContent = embeddedCover ? 'A imagem está incorporada no HTML. Você não precisa enviar outro arquivo de capa.' : value ? 'A capa usará este endereço. Mantenha a imagem disponível nessa URL.' : 'Escolha uma imagem ou informe uma URL de capa.';
}
function readPost(validate = true) {
  if (loadingCover) throw new Error('Aguarde a leitura da imagem de capa.');
  if (validate && !form.reportValidity()) return null;
  const data = Object.fromEntries(new FormData(form));
  const post = {
    title:data.title.trim(), excerpt:data.excerpt.trim(), author:data.author.trim(), category:data.category.trim(),
    date:data.date, slug:slugify(data.slug || data.title), content:data.content.trim(), cover:embeddedCover || data.cover.trim(),
  };
  if (!post.slug) throw new Error('Informe um endereço para o post com letras e números.');
  if (post.slug === 'index') throw new Error('O endereço “index” é reservado para a lista do blog. Escolha outro endereço para o post.');
  if (!post.cover || safeImage(post.cover) !== post.cover) throw new Error('Use uma URL de imagem que comece com https:// ou escolha um arquivo JPG, PNG, WebP, GIF ou AVIF.');
  if (!post.title || !post.author || !post.category || !post.excerpt || !post.content || !post.date) throw new Error('Preencha os dados do post antes de continuar.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date) || Number.isNaN(Date.parse(`${post.date}T12:00:00Z`))) throw new Error('Informe uma data válida.');
  return post;
}
function showPreview(post, scroll = false) {
  clearTimeout(previewTimer);
  const html = renderArticle(post);
  const policy = `default-src 'none'; style-src 'unsafe-inline' ${location.origin} https://fonts.googleapis.com; img-src https: data: ${location.origin}; font-src https://fonts.gstatic.com; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'`;
  preview.srcdoc = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`);
  previewSection.hidden = false;
  if (scroll) previewSection.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start'});
}
form.elements.title.addEventListener('input', () => {
  if (!manualSlug) form.elements.slug.value = slugify(form.elements.title.value);
});
form.elements.slug.addEventListener('input', () => { manualSlug = Boolean(form.elements.slug.value); });
form.elements.slug.addEventListener('change', () => { form.elements.slug.value = slugify(form.elements.slug.value); updatePath(); });
form.elements.cover.addEventListener('input', () => { embeddedCover = ''; upload.value = ''; updateCover(); });
form.addEventListener('input', () => {
  clearUpdate();
  updatePath();
  clearTimeout(previewTimer);
  if (!previewSection.hidden) previewTimer = setTimeout(() => {
    try { const post = readPost(false); if (post) showPreview(post); } catch { /* Keep the last valid preview while the author types. */ }
  }, 400);
});
form.addEventListener('submit', event => {
  event.preventDefault();
  try { const post = readPost(); if (post) { showPreview(post, true); message(status, 'Prévia atualizada. Confira o texto antes de baixar ou publicar.'); } }
  catch (error) { message(status, error.message, true); }
});
document.querySelector('#close-preview').addEventListener('click', () => { previewSection.hidden = true; });
coverPreview.addEventListener('error', () => { coverPreview.hidden = true; coverNote.textContent = 'Não foi possível carregar a capa. Confira a URL ou escolha outro arquivo.'; });
upload.addEventListener('change', async () => {
  const file = upload.files[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) { upload.value = ''; message(status, 'Escolha uma imagem JPG, PNG, WebP, GIF ou AVIF.', true); return; }
  if (file.size > 3 * 1024 * 1024) { upload.value = ''; message(status, 'Escolha uma imagem de até 3 MB.', true); return; }
  loadingCover = true;
  message(status, 'Preparando a imagem de capa…');
  try {
    embeddedCover = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Não foi possível ler a imagem. Escolha o arquivo novamente.')); reader.readAsDataURL(file); });
    form.elements.cover.value = '';
    clearUpdate();
    updateCover();
    message(status, 'Capa pronta. A imagem será salva dentro do próprio HTML.');
  } catch (error) { message(status, error.message, true); }
  finally { loadingCover = false; }
});
document.querySelector('#download-post').addEventListener('click', () => {
  try {
    const post = readPost();
    if (!post) return;
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([renderArticle(post)], {type:'text/html;charset=utf-8'}));
    link.href = url;
    link.download = `${post.slug}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    message(status, `HTML gerado: ${post.slug}.html. Coloque esse arquivo na pasta blog/ do projeto e envie para o GitHub para publicar.`);
  } catch (error) { message(status, error.message, true); }
});
document.querySelector('#import-post').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    // A 3 MB cover appears in the page, social metadata, and editable source.
    if (file.size > 16 * 1024 * 1024) throw new Error('Esse HTML é grande demais. Abra um arquivo de até 16 MB.');
    const parsed = new DOMParser().parseFromString(await file.text(), 'text/html');
    const source = parsed.querySelector('#post-source');
    if (!source) throw new Error('Este arquivo não foi criado pelo editor. Copie o texto para criar uma nova versão.');
    const post = JSON.parse(source.textContent);
    for (const field of ['title', 'excerpt', 'author', 'category', 'date', 'slug', 'content']) form.elements[field].value = String(post[field] ?? '');
    embeddedCover = String(post.cover || '').startsWith('data:') ? String(post.cover) : '';
    form.elements.cover.value = embeddedCover ? '' : String(post.cover || '');
    upload.value = '';
    manualSlug = true;
    clearUpdate();
    updatePath();
    updateCover();
    const validated = readPost(false);
    showPreview(validated);
    message(status, `Post aberto: ${file.name}. Edite, baixe o novo HTML ou publique a atualização.`);
  } catch (error) { message(status, error.message, true); }
  finally { event.target.value = ''; }
});

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}
async function githubRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options, redirect:'error',
    headers:{Accept:options.method ? 'application/vnd.github+json' : 'application/vnd.github.object+json', Authorization:`Bearer ${token}`, 'X-GitHub-Api-Version':'2026-03-10', ...(options.body ? {'Content-Type':'application/json'} : {})},
  });
  if (response.status === 404 && !options.method) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) throw new Error('O GitHub não aceitou o token. Confira o token e sua validade.');
    if ([403, 404].includes(response.status)) throw new Error('Confira o repositório, a branch e o acesso do token. Ele precisa da permissão Contents: Read and write neste repositório.');
    if (response.status === 409) throw new Error('O arquivo mudou no GitHub. Clique em publicar novamente para carregar a versão atual.');
    throw new Error(`Não foi possível publicar no GitHub (${response.status}). Confira os dados e tente novamente.`);
  }
  return result;
}
publishForm.addEventListener('input', clearUpdate);
publishForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const post = readPost();
    if (!post || !publishForm.reportValidity()) return;
    const repository = document.querySelector('#github-repository').value.trim();
    const branch = document.querySelector('#github-branch').value.trim();
    const token = document.querySelector('#github-token').value.trim();
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Informe o repositório no formato usuario/repositorio.');
    if (!branch || !token) throw new Error('Informe a branch e o token do GitHub.');
    const html = renderArticle(post);
    const key = `${repository}\n${branch}\n${html}`;
    const path = `blog/${post.slug}.html`;
    const endpoint = `https://api.github.com/repos/${repository.split('/').map(encodeURIComponent).join('/')}/contents/blog/${encodeURIComponent(post.slug)}.html`;
    publishButton.disabled = true;
    message(publishStatus, `Verificando ${path} em ${repository}…`);
    const existing = await githubRequest(`${endpoint}?ref=${encodeURIComponent(branch)}`, token);
    if (existing && (!pendingUpdate || pendingUpdate.key !== key || pendingUpdate.sha !== existing.sha)) {
      pendingUpdate = {key, sha:existing.sha};
      publishButton.textContent = 'Substituir post existente ↗';
      message(publishStatus, `Já existe ${path} na branch ${branch}. Confira os dados e clique em “Substituir post existente” para atualizar esse arquivo.`);
      return;
    }
    message(publishStatus, `Publicando ${path} em ${repository}…`);
    await githubRequest(endpoint, token, {method:'PUT', body:JSON.stringify({message:`${existing ? 'Atualiza' : 'Publica'} post: ${post.title}`, content:toBase64(html), branch, ...(existing ? {sha:existing.sha} : {})})});
    document.querySelector('#github-token').value = '';
    clearUpdate();
    message(publishStatus, `Post enviado para ${repository}, branch ${branch}. Aguarde o deploy da Vercel: o endereço será /blog/${post.slug}.html.`);
  } catch (error) {
    clearUpdate();
    message(publishStatus, error instanceof TypeError ? 'Não foi possível conectar ao GitHub. Confira sua conexão e tente novamente.' : error.message, true);
  } finally { publishButton.disabled = false; }
});

updatePath();
updateCover();
