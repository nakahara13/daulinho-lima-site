import assert from 'node:assert/strict';
import {request} from 'node:http';
import {mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {buildSite, parsePostHTML} from './build.mjs';
import {createStaticServer} from './dev.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const inlineImage = 'data:image/png;base64,iVBORw0KGgo=';

function article({slug = 'primeiro-acorde', title = 'Música &amp; inspiração', category = 'Aprendizado', date = '2026-11-06', cover = '/assets/cover.svg'} = {}) {
  return `<!doctype html><html lang="pt-BR"><head><title>${title} — Daulinho Lima</title><meta name="description" content="Aprenda a ouvir &amp; tocar."><meta name="author" content="Daulinho Lima"><meta name="post:slug" content="${slug}"><meta name="post:category" content="${category}"><meta name="post:date" content="${date}"><meta name="post:minutes" content="3"><meta property="og:image" content="${cover}"></head><body><article><h1>${title}</h1><p>O conteúdo continua sendo HTML.</p><img src="${cover}" alt="Capa"></article><div class="blog-strip" data-recommended data-current-post="${slug}"><!-- recommendations:start --><!-- recommendations:end --></div></body></html>`;
}

async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'daulinho-static-test-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  await Promise.all(['assets', 'blog'].map(path => mkdir(resolve(root, path))));
  await Promise.all([
    writeFile(resolve(root, 'index.html'), '<!doctype html><html><div class="blog-strip"><!-- posts:start --><!-- posts:end --></div></html>'),
    writeFile(resolve(root, 'editor.html'), '<!doctype html><html><h1>Editor</h1></html>'),
    writeFile(resolve(root, 'blog/index.html'), '<!doctype html><html><section class="blog-all"><!-- blog:start --><!-- blog:end --></section></html>'),
    writeFile(resolve(root, 'assets/cover.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'),
    writeFile(resolve(root, 'assets/site.css'), 'body{color:#000;background:#fff}'),
    writeFile(resolve(root, 'blog/primeiro-acorde.html'), article()),
  ]);
  return root;
}

test('build produces only static files and decodes metadata without losing the HTML article', async t => {
  const root = await fixture(t);
  const {outDir, posts} = await buildSite({root, quiet: true});
  assert.deepEqual((await readdir(outDir)).sort(), ['assets', 'blog', 'editor.html', 'index.html']);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].title, 'Música & inspiração');
  assert.equal(posts[0].excerpt, 'Aprenda a ouvir & tocar.');
  assert.equal(posts[0].url, '/blog/primeiro-acorde.html');
  assert.equal(posts[0].cover, '/assets/cover.svg');
  assert.equal(posts[0].minutes, 3);
  assert.deepEqual(JSON.parse(await readFile(resolve(outDir, 'assets/posts.json'), 'utf8')), posts);
  assert.match(await readFile(resolve(outDir, 'blog/primeiro-acorde.html'), 'utf8'), /O conteúdo continua sendo HTML\./);
  assert.match(await readFile(resolve(outDir, 'index.html'), 'utf8'), /href="\/blog\/primeiro-acorde\.html"/);
  assert.match(await readFile(resolve(outDir, 'index.html'), 'utf8'), /Música &amp; inspiração/);
});

test('adding one HTML file updates home, index and recommendations sorted by date', async t => {
  const root = await fixture(t);
  await writeFile(resolve(root, 'blog/segundo-acorde.html'), article({slug: 'segundo-acorde', title: 'Um novo ritmo', date: '2026-11-07', cover: inlineImage}));
  const {outDir, posts} = await buildSite({root, quiet: true});
  assert.deepEqual(posts.map(post => post.slug), ['segundo-acorde', 'primeiro-acorde']);
  assert.equal(posts[0].cover, inlineImage);
  const home = await readFile(resolve(outDir, 'index.html'), 'utf8');
  assert.ok(home.indexOf('/blog/segundo-acorde.html') < home.indexOf('/blog/primeiro-acorde.html'));
  const blog = await readFile(resolve(outDir, 'blog/index.html'), 'utf8');
  assert.match(blog, /data-post-category="Aprendizado"/);
  assert.match(blog, /href="\/blog\/segundo-acorde\.html"/);
  assert.match(blog, /class="empty search-empty" hidden/);
  const post = await readFile(resolve(outDir, 'blog/primeiro-acorde.html'), 'utf8');
  const recommended = post.split('<!-- recommendations:start -->')[1].split('<!-- recommendations:end -->')[0];
  assert.match(recommended, /segundo-acorde\.html/);
  assert.doesNotMatch(recommended, /primeiro-acorde\.html/);
  assert.match(await readFile(resolve(outDir, 'blog/segundo-acorde.html'), 'utf8'), /data:image\/png;base64,/);
});

test('bad slugs, filenames, dates and duplicate metadata fail clearly', () => {
  assert.throws(() => parsePostHTML(article({slug: '../fora'}), '../fora.html'), /slug inválido/);
  assert.throws(() => parsePostHTML(article({slug: 'index'}), 'index.html'), /reservado/);
  assert.throws(() => parsePostHTML(article(), 'outro.html'), /deve se chamar primeiro-acorde\.html/);
  assert.throws(() => parsePostHTML(article({date: '2026-02-30'}), 'primeiro-acorde.html'), /data inválida/);
  assert.throws(() => parsePostHTML(article().replace('</head>', '<meta name="post:slug" content="duplicado"></head>'), 'primeiro-acorde.html'), /metadado duplicado/);
});

test('missing local cover and paths outside the project fail before replacing an existing build', async t => {
  const root = await fixture(t);
  const {outDir} = await buildSite({root, quiet: true});
  await writeFile(resolve(root, 'blog/primeiro-acorde.html'), article({cover: '/assets/nao-existe.jpg'}));
  await assert.rejects(buildSite({root, quiet: true}), /capa local não encontrada/);
  assert.match(await readFile(resolve(outDir, 'index.html'), 'utf8'), /primeiro-acorde/);
  await writeFile(resolve(root, 'blog/primeiro-acorde.html'), article({cover: 'javascript:alert(1)'}));
  await assert.rejects(buildSite({root, quiet: true}), /precisa ser uma imagem local/);
  await writeFile(resolve(root, 'foto.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await writeFile(resolve(root, 'blog/primeiro-acorde.html'), article({cover: '/foto.svg'}));
  await assert.rejects(buildSite({root, quiet: true}), /pasta assets/);
  await writeFile(resolve(root, 'assets/.foto.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await writeFile(resolve(root, 'blog/primeiro-acorde.html'), article({cover: '/assets/.foto.svg'}));
  await assert.rejects(buildSite({root, quiet: true}), /arquivos ou pastas ocultas/);
  await assert.rejects(buildSite({root, outDir: root, quiet: true}), /pasta de saída/);
  await writeFile(resolve(root, 'blog/primeiro-acorde.html'), article());
  await writeFile(resolve(root, 'blog/index.html'), article({slug: 'index'}));
  await assert.rejects(buildSite({root, quiet: true}), /mantenha os marcadores blog:start/);
});

function fetchRaw(port, path, method = 'GET') {
  return new Promise((accept, reject) => {
    const req = request({hostname: '127.0.0.1', port, path, method}, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => accept({status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString()}));
    });
    req.on('error', reject);
    req.end();
  });
}

test('local preview serves static routes and HEAD, and blocks traversal and hidden files', async t => {
  const root = await fixture(t);
  const {outDir} = await buildSite({root, quiet: true});
  await writeFile(resolve(root, 'secret.txt'), 'PRIVATE');
  await symlink(resolve(root, 'secret.txt'), resolve(outDir, 'escape.txt'));
  const server = createStaticServer({directory: outDir});
  t.after(() => new Promise(accept => server.close(accept)));
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  const port = server.address().port;
  assert.equal((await fetchRaw(port, '/')).status, 200);
  assert.equal((await fetchRaw(port, '/blog')).status, 200);
  assert.equal((await fetchRaw(port, '/blog/primeiro-acorde')).status, 200);
  assert.equal((await fetchRaw(port, '/editor.html?preview=1')).status, 200);
  const head = await fetchRaw(port, '/assets/posts.json', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.match(head.headers['content-type'], /application\/json/);
  assert.equal((await fetchRaw(port, '/inexistente.html')).status, 404);
  assert.equal((await fetchRaw(port, '/%2e%2e/secret.txt')).status, 403);
  assert.equal((await fetchRaw(port, '/assets/%2e%2e/%2e%2e/secret.txt')).status, 403);
  assert.equal((await fetchRaw(port, '/.env')).status, 403);
  assert.equal((await fetchRaw(port, '/escape.txt')).status, 403);
  assert.equal((await fetchRaw(port, '/%E0%A4%A')).status, 400);
  assert.equal((await fetchRaw(port, '/', 'POST')).status, 405);
});

test('the real project contains independently readable posts and no runtime dependencies', async () => {
  const packageJSON = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'));
  assert.equal(Object.keys(packageJSON.dependencies ?? {}).length, 0);
  const filenames = (await readdir(resolve(projectRoot, 'blog'))).filter(name => name.endsWith('.html') && name !== 'index.html');
  assert.ok(filenames.length > 0, 'O blog precisa ter ao menos um post em HTML.');
  for (const filename of filenames) {
    const html = await readFile(resolve(projectRoot, 'blog', filename), 'utf8');
    const post = parsePostHTML(html, filename);
    assert.match(html, /<article[\s>]/);
    assert.ok(post.title.length > 0);
    assert.doesNotMatch(html, /\/api\/|\/uploads\//);
  }
});
