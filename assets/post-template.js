// Shared by the browser editor and the static build. No framework or server required.
export const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" stroke-width="1.5"/></svg>';
export const icons = {
  whatsapp: '<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 3A12.9 12.9 0 0 0 4.8 22.4L3 29l6.8-1.8A13 13 0 1 0 16 3Zm0 23.6a10.5 10.5 0 0 1-5.4-1.5l-.4-.2-4 .9 1.1-3.8-.3-.4A10.6 10.6 0 1 1 16 26.6Zm5.9-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-2-1.8-2.3-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.6-.5-.8-.5h-.7c-.2 0-.6.1-.8.4-.3.3-1.1 1-1.1 2.6s1.2 3 1.4 3.2c.1.2 2.2 3.4 5.3 4.7.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4Z"/></svg>',
};
export const DEFAULT_COVER = 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=1800&q=85';
export function safeImage(value) {
  const image = String(value ?? '').trim();
  if (/^https:\/\//i.test(image) || /^\/(?!\/)[a-zA-Z0-9/_.-]+$/.test(image) || /^data:image\/(?:jpeg|png|webp|gif|avif);base64,[a-zA-Z0-9+/=\s]+$/i.test(image)) return image;
  return DEFAULT_COVER;
}
export const readingMinutes = content => Math.max(1, Math.ceil(String(content ?? '').trim().split(/\s+/).filter(Boolean).length / 200));
export const slugify = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100).replace(/-+$/g, '');
export function paragraphs(content) {
  return String(content ?? '').trim().split(/\n\s*\n/).filter(Boolean).map(block => block.split(/\n(?=## )/).map(part => {
    if (part.startsWith('## ')) {
      const [heading, ...rest] = part.split('\n');
      return `<h2>${esc(heading.slice(3))}</h2>${rest.length ? `<p>${rest.map(esc).join('<br>')}</p>` : ''}`;
    }
    return `<p>${esc(part).replace(/\n/g, '<br>')}</p>`;
  }).join('')).join('\n');
}
export function wordmark() {
  return '<a class="wordmark" href="/" aria-label="Daulinho Lima, início"><span class="brand-symbol">𝄞</span><span>Daulinho<span>Lima<i>ESCOLA DE MÚSICA</i></span></span></a>';
}
export function pageShell(body, options = {}) {
  const {
    title = 'Daulinho Lima — A sua vida tem um som.',
    description = 'Encontre o seu ritmo na Escola de Música Daulinho Lima.',
    path = '/', cover = DEFAULT_COVER, metadata = '', noindex = false,
    scripts = '<script type="module" src="/assets/site.js"></script>', styles = '',
  } = options;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#101010">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${path.startsWith('/blog/') && path !== '/blog/' ? 'article' : 'website'}">
<meta property="og:image" content="${esc(safeImage(cover))}">
${noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}
${metadata}
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=DM+Sans:wght@400;450;500;600;650;700&family=Playfair+Display:ital,wght@1,600;1,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css">
${styles}
${scripts}
</head>
<body>
<a class="skip" href="#main">Pular para o conteúdo</a>
<header class="site-header"><div class="container nav-row">${wordmark()}<button class="menu-toggle" aria-expanded="false" aria-controls="navigation" aria-label="Abrir menu"><span></span><span></span></button><nav id="navigation" aria-label="Menu principal"><a href="/#escola">A escola</a><a href="/#cursos">Nossos cursos</a><a href="/blog/" ${path.startsWith('/blog') ? 'aria-current="page"' : ''}>Blog</a><a href="/#contato">Contato</a><a class="button nav-cta" href="/#contato">Vem fazer música ${arrow}</a></nav></div></header>
<main id="main">${body}</main>
<footer><div class="container footer-main">${wordmark()}<p>Mais música na sua vida.<br>Mais você no mundo.</p><div><a href="/#escola">A escola</a><a href="/#cursos">Cursos</a><a href="/blog/">Blog</a><a href="/#contato">Contato</a></div><a class="back-top" href="#main" aria-label="Voltar ao topo">↑</a></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} Daulinho Lima. Feito para quem sente a música.</span></div></footer>
<button class="whatsapp-float" data-contact aria-label="Conversar pelo WhatsApp">${icons.whatsapp}<span>Vamos conversar?</span></button>
<dialog id="contact-dialog"><button class="dialog-close" data-close aria-label="Fechar">×</button><span class="eyebrow">VAMOS FAZER MÚSICA?</span><h2>Seu primeiro passo<br>começa aqui.</h2><p data-contact-description>Converse com a escola e encontre o melhor horário para você.</p><a class="button dark" href="/#contato" data-contact-link data-close>Ver informações de contato ${arrow}</a></dialog>
<div class="toast" role="status" aria-live="polite"></div>
</body>
</html>`;
}
export function renderArticle(post) {
  const slug = slugify(post.slug || post.title);
  if (!slug) throw new Error('Informe um título ou endereço válido para o post.');
  if (slug === 'index') throw new Error('O endereço “index” é reservado para a lista do blog. Escolha outro endereço para o post.');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(post.date || '') ? post.date : new Date().toISOString().slice(0, 10);
  const formatted = new Intl.DateTimeFormat('pt-BR', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
  const minutes = readingMinutes(post.content);
  const author = String(post.author || 'Daulinho Lima');
  const initials = author.trim().split(/\s+/).slice(0, 2).map(word => word.slice(0, 1)).join('').toLocaleUpperCase('pt-BR');
  const metadata = `<meta name="author" content="${esc(author)}">\n<meta name="post:slug" content="${esc(slug)}">\n<meta name="post:category" content="${esc(post.category || 'Música')}">\n<meta name="post:date" content="${esc(date)}">\n<meta name="post:minutes" content="${minutes}">`;
  const source = JSON.stringify({...post, slug, date, author, cover:safeImage(post.cover), minutes}).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const body = `<article>
<div class="container article-heading"><a class="breadcrumb" href="/blog/">← Voltar para o blog</a><span class="eyebrow">${esc(post.category || 'Música')}</span><h1>${esc(post.title)}</h1><p>${esc(post.excerpt)}</p><div class="author-row"><span class="avatar">${esc(initials)}</span><span><b>${esc(author)}</b><small><time datetime="${esc(date)}">${formatted}</time> · ${minutes} min de leitura</small></span><button class="share-button" data-share>Compartilhar ${arrow}</button></div></div>
<div class="container article-cover"><img src="${esc(safeImage(post.cover))}" alt="${esc(post.title)}"></div>
<div class="article-body">${paragraphs(post.content)}<div class="article-end"><span>Feito para quem sente a música.</span><span>✳</span></div></div>
</article>
<section class="section recommended"><div class="container"><div class="section-heading"><div><span class="eyebrow">MAIS UMA BOA LEITURA</span><h2>Continue no <em>ritmo.</em></h2></div><a class="text-link" href="/blog/">Todos os posts ${arrow}</a></div><div class="blog-strip" data-recommended data-current-post="${esc(slug)}"><!-- recommendations:start --><!-- recommendations:end --></div></div></section>
<script type="application/json" id="post-source">${source}</script>`;
  return pageShell(body, {title:`${post.title} — Daulinho Lima`, description:post.excerpt, path:`/blog/${slug}.html`, cover:post.cover, metadata});
}
