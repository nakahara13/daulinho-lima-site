import {createServer} from 'node:http';
import {watch} from 'node:fs';
import {readFile, realpath, stat} from 'node:fs/promises';
import {extname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {buildSite} from './build.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2'};

function isInside(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

/** A local static preview only; production consists of the generated files. */
export function createStaticServer({directory = resolve(projectRoot, 'public')} = {}) {
  directory = resolve(directory);
  return createServer(async (request, response) => {
    const respond = (status, body, headers = {}) => {
      const content = Buffer.isBuffer(body) ? body : Buffer.from(body);
      response.writeHead(status, {'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': content.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers});
      response.end(request.method === 'HEAD' ? undefined : content);
    };
    if (!['GET', 'HEAD'].includes(request.method)) return respond(405, 'Método não permitido.', {Allow: 'GET, HEAD'});
    let pathname;
    try { pathname = decodeURIComponent((request.url ?? '/').split(/[?#]/, 1)[0]); }
    catch { return respond(400, 'Endereço inválido.'); }
    if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part === '..' || part.startsWith('.'))) return respond(403, 'Acesso não permitido.');
    let file = resolve(directory, `.${pathname}`);
    if (!isInside(directory, file)) return respond(403, 'Acesso não permitido.');
    try {
      let info;
      try { info = await stat(file); }
      catch (error) {
        if (error.code !== 'ENOENT' || extname(file)) throw error;
        file += '.html';
        info = await stat(file);
      }
      if (info.isDirectory()) { file = resolve(file, 'index.html'); info = await stat(file); }
      if (!info.isFile() || !isInside(await realpath(directory), await realpath(file))) return respond(403, 'Acesso não permitido.');
      return respond(200, await readFile(file), {'Content-Type': types[extname(file).toLowerCase()] ?? 'application/octet-stream'});
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return respond(404, 'Página não encontrada.');
      console.error(error);
      return respond(500, 'Não foi possível abrir a página.');
    }
  });
}

async function start() {
  const {outDir} = await buildSite();
  const port = Number(process.env.PORT ?? 4180);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT precisa estar entre 1 e 65535.');
  const server = createStaticServer({directory: outDir});
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', accept); });
  console.log(`Daulinho Lima: http://localhost:${port} · Editor: http://localhost:${port}/editor.html · Ctrl+C para encerrar`);
  let rebuilding = false;
  let pending = false;
  let timer;
  const rebuild = async () => {
    if (rebuilding) { pending = true; return; }
    rebuilding = true;
    try { await buildSite(); }
    catch (error) { console.error(`Erro ao atualizar o site: ${error.message}`); }
    finally {
      rebuilding = false;
      if (pending) { pending = false; void rebuild(); }
    }
  };
  const watcher = watch(projectRoot, {recursive: true}, (_event, filename) => {
    const changed = String(filename ?? '').split(sep).join('/');
    if (!['index.html', 'editor.html', '404.html', 'robots.txt'].includes(changed) && !changed.startsWith('assets/') && !changed.startsWith('blog/')) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 120);
  });
  const stop = () => { clearTimeout(timer); watcher.close(); server.close(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) start().catch(error => { console.error(`Não foi possível abrir o site: ${error.message}`); process.exitCode = 1; });
