import {copyFile, lstat, mkdir, readdir, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {extname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));

function decodeEntities(value) {
  const named = {amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' '};
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match;
    const code = entity[1].toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\uFFFD';
  });
}

/** Read the metadata emitted by the browser editor; the article itself stays unchanged. */
export function parsePostHTML(html, filename) {
  const metadata = new Map();
  const tags = html.match(/<meta\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi) ?? [];
  for (const tag of tags) {
    const attributes = new Map();
    const pattern = /([^\s=/'">]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const match of tag.slice(5, -1).matchAll(pattern)) {
      attributes.set(match[1].toLowerCase(), decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''));
    }
    const name = (attributes.get('name') ?? attributes.get('property') ?? '').toLowerCase();
    if (!name) continue;
    if (metadata.has(name)) throw new Error(`${filename}: metadado duplicado: ${name}.`);
    metadata.set(name, (attributes.get('content') ?? '').trim());
  }
  const required = name => {
    const value = metadata.get(name);
    if (!value) throw new Error(`${filename}: falta o metadado ${name}.`);
    return value;
  };
  const slug = required('post:slug');
  if (!slugPattern.test(slug)) throw new Error(`${filename}: slug inválido: ${slug}. Use letras minúsculas, números e hífens.`);
  if (slug === 'index') throw new Error(`${filename}: o nome index é reservado para a lista do blog.`);
  if (filename !== `${slug}.html`) throw new Error(`${filename}: o arquivo deve se chamar ${slug}.html.`);
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = decodeEntities(titleTag?.[1] ?? '').trim().replace(/\s+[—–|\-]\s+Daulinho Lima\s*$/i, '').trim();
  if (!title) throw new Error(`${filename}: falta um título válido.`);
  const date = required('post:date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error(`${filename}: data inválida. Use AAAA-MM-DD.`);
  }
  const minutes = required('post:minutes');
  if (!/^[1-9]\d{0,2}$/.test(minutes)) throw new Error(`${filename}: o tempo de leitura precisa ser um número inteiro entre 1 e 999.`);
  return {id: slug, slug, title, excerpt: required('description'), cover: required('og:image'), category: required('post:category'), author: required('author'), date, minutes: Number(minutes), url: `/blog/${slug}.html`};
}

function isInside(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

async function assertRegularFile(path) {
  const info = await lstat(path);
  if (!info.isFile()) throw new Error(`Esperado um arquivo comum: ${path}.`);
}

async function validateCover(root, post, filename) {
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml);(?:base64,|charset=[^,]+,)/i.test(post.cover)) return;
  if (/^https:\/\//i.test(post.cover)) {
    try {
      const url = new URL(post.cover);
      if (url.protocol === 'https:' && url.hostname && !url.username && !url.password) return;
    } catch { /* Report the invalid cover below. */ }
    throw new Error(`${filename}: URL de capa inválida.`);
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(post.cover) || post.cover.startsWith('//') || post.cover.includes('\\')) throw new Error(`${filename}: a capa precisa ser uma imagem local, HTTPS ou data:image.`);
  let path;
  try { path = decodeURIComponent(post.cover.split(/[?#]/, 1)[0]); }
  catch { throw new Error(`${filename}: caminho de capa inválido.`); }
  const absolute = path.startsWith('/') ? resolve(root, `.${path}`) : resolve(root, 'blog', path);
  let actual;
  try { actual = await realpath(absolute); }
  catch { throw new Error(`${filename}: capa local não encontrada: ${post.cover}.`); }
  if (!isInside(resolve(root, 'assets'), absolute) || !isInside(resolve(root, 'assets'), actual)) throw new Error(`${filename}: capas locais precisam estar na pasta assets, que é copiada para o site.`);
  if (relative(resolve(root, 'assets'), absolute).split(sep).some(part => part.startsWith('.'))) throw new Error(`${filename}: capas locais não podem estar em arquivos ou pastas ocultas.`);
  await assertRegularFile(absolute);
  if (!/\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(extname(absolute))) throw new Error(`${filename}: o arquivo de capa não é uma imagem.`);
  post.cover = `/${relative(root, absolute).split(sep).join('/')}`;
}

async function copyAssets(source, destination) {
  await mkdir(destination, {recursive: true});
  for (const entry of await readdir(source, {withFileTypes: true})) {
    if (entry.name.startsWith('.') || entry.name === 'posts.json') continue;
    const from = resolve(source, entry.name);
    const to = resolve(destination, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Links simbólicos não são aceitos nos arquivos do site: ${from}.`);
    if (entry.isDirectory()) await copyAssets(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}

export function renderPostCard(post) {
  const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return `<article class="post-card"><a href="${escapeHTML(post.url)}"><div class="post-image"><img loading="lazy" src="${escapeHTML(post.cover)}" alt="${escapeHTML(post.title)}"><span class="image-arrow">${arrow}</span></div><div class="post-meta"><span>${escapeHTML(post.category)}</span><span>${post.minutes} min de leitura</span></div><h3>${escapeHTML(post.title)}</h3><p>${escapeHTML(post.excerpt)}</p></a></article>`;
}

function replaceMarker(html, name, content) {
  return html.replace(new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`), (_match, start, end) => `${start}${content}${end}`);
}

function renderPage(html, page, posts) {
  if (page === 'index.html') return replaceMarker(html, 'posts', posts.slice(0, 6).map(renderPostCard).join('') || '<p class="empty">Novas histórias em breve. Volte para conferir.</p>');
  if (page === 'blog/index.html') {
    const cards = posts.map(post => `<div data-post-category="${escapeHTML(post.category)}" data-search="${escapeHTML(`${post.title} ${post.excerpt}`.toLocaleLowerCase('pt-BR'))}">${renderPostCard(post)}</div>`).join('');
    return replaceMarker(html, 'blog', `${cards}<p class="empty search-empty" hidden>Nenhum post encontrado. Tente outra palavra.</p>${posts.length ? '' : '<p class="empty">Em breve, novas histórias por aqui.</p>'}`);
  }
  const current = posts.find(post => page === `blog/${post.slug}.html`);
  if (!current) return html;
  const recommendations = posts.filter(post => post.slug !== current.slug).sort((a, b) => Number(b.category === current.category) - Number(a.category === current.category)).slice(0, 3);
  return replaceMarker(html, 'recommendations', recommendations.map(renderPostCard).join(''));
}

/** Build a static Vercel directory. No server, database, secrets or package dependencies. */
export async function buildSite({root = projectRoot, outDir, quiet = false} = {}) {
  root = resolve(root);
  outDir = resolve(outDir ?? resolve(root, 'public'));
  if (outDir === root || isInside(outDir, root) || ['assets', 'blog', 'scripts'].some(name => isInside(resolve(root, name), outDir))) throw new Error('A pasta de saída deve ser exclusiva e diferente das pastas de origem.');
  const pages = ['index.html', 'editor.html', 'blog/index.html'];
  await Promise.all(pages.map(page => assertRegularFile(resolve(root, page))));
  for (const page of ['404.html', 'robots.txt']) {
    try { await assertRegularFile(resolve(root, page)); pages.push(page); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const assetsInfo = await lstat(resolve(root, 'assets'));
  if (!assetsInfo.isDirectory()) throw new Error('A pasta assets precisa ser um diretório comum.');
  const files = (await readdir(resolve(root, 'blog'), {withFileTypes: true})).filter(entry => entry.name !== 'index.html' && entry.name.endsWith('.html'));
  const posts = [];
  const slugs = new Set();
  for (const entry of files) {
    if (!entry.isFile()) throw new Error(`blog/${entry.name}: esperado um arquivo HTML comum.`);
    const post = parsePostHTML(await readFile(resolve(root, 'blog', entry.name), 'utf8'), entry.name);
    if (slugs.has(post.slug)) throw new Error(`Slug duplicado: ${post.slug}.`);
    slugs.add(post.slug);
    await validateCover(root, post, entry.name);
    posts.push(post);
    pages.push(`blog/${entry.name}`);
  }
  posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  const sourcePages = new Map(await Promise.all(pages.map(async page => [page, await readFile(resolve(root, page), 'utf8')])));
  for (const [page, marker] of [['index.html', 'posts'], ['blog/index.html', 'blog']]) {
    if (!sourcePages.get(page).includes(`<!-- ${marker}:start -->`) || !sourcePages.get(page).includes(`<!-- ${marker}:end -->`)) {
      throw new Error(`${page}: mantenha os marcadores ${marker}:start e ${marker}:end para atualizar os posts automaticamente.`);
    }
  }
  await rm(outDir, {recursive: true, force: true});
  await mkdir(resolve(outDir, 'blog'), {recursive: true});
  await copyAssets(resolve(root, 'assets'), resolve(outDir, 'assets'));
  await Promise.all(pages.map(page => writeFile(resolve(outDir, page), renderPage(sourcePages.get(page), page, posts))));
  await writeFile(resolve(outDir, 'assets/posts.json'), `${JSON.stringify(posts, null, 2)}\n`);
  if (!quiet) console.log(`Site estático gerado em ${relative(root, outDir) || outDir}: ${posts.length} post(s) em HTML.`);
  return {root, outDir, posts};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { await buildSite(); }
  catch (error) { console.error(`Não foi possível gerar o site: ${error.message}`); process.exitCode = 1; }
}
