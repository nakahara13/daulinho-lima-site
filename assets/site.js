import {school} from './config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let toastTimer;
function toast(text) {
  const element = $('.toast');
  if (!element) return;
  element.textContent = text;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 3500);
}

// Navegação mobile.
const menu = $('.menu-toggle');
const navigation = $('#navigation');
function closeMenu() {
  menu?.setAttribute('aria-expanded', 'false');
  menu?.setAttribute('aria-label', 'Abrir menu');
  navigation?.classList.remove('open');
}
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  navigation.classList.toggle('open', open);
});
$$('#navigation a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menu.focus();
  }
});

// Contato e localização usam apenas as informações públicas de config.js.
for (const field of ['address', 'city', 'hours', 'email']) {
  $$('[data-school-' + field + ']').forEach(element => {
    element.textContent = school[field];
    if (field === 'email' && !school.demo) {
      const link = document.createElement('a');
      link.href = 'mailto:' + school.email;
      link.textContent = school.email;
      element.replaceChildren(link);
    }
  });
}
$$('[data-example-note]').forEach(element => element.hidden = !school.demo);
if (!school.demo) {
  const location = $('[data-location]');
  const map = $('.map-art', location || document);
  if (location && map) {
    const query = encodeURIComponent(school.address + ', ' + school.city);
    const frame = document.createElement('iframe');
    frame.title = 'Localização da escola no mapa';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.src = 'https://maps.google.com/maps?q=' + query + '&output=embed';
    map.replaceWith(frame);
    const placeholder = $('.location-placeholder', location);
    if (placeholder) {
      const link = document.createElement('a');
      link.href = 'https://www.google.com/maps/search/?api=1&query=' + query;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', 'Abrir localização no Google Maps');
      link.textContent = '↗';
      placeholder.replaceWith(link);
    }
  }
}

const contactDialog = $('#contact-dialog');
const contactLink = $('[data-contact-link]', contactDialog || document);
const whatsapp = String(school.whatsapp).replace(/\D/g, '');
if (contactLink && /^\d{10,15}$/.test(whatsapp)) {
  contactLink.href = 'https://wa.me/' + whatsapp;
  contactLink.target = '_blank';
  contactLink.rel = 'noopener';
  contactLink.textContent = 'Abrir WhatsApp ↗';
} else {
  const description = $('[data-contact-description]');
  if (description) description.textContent = 'O WhatsApp da escola ainda não foi informado. Consulte as informações de contato.';
}
document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if (close) close.closest('dialog')?.close();
  const contact = event.target.closest('[data-contact], [data-course]');
  if (!contact || !contactDialog) return;
  if (/^\d{10,15}$/.test(whatsapp)) {
    const text = contact.dataset.course
      ? 'Olá! Quero conhecer o curso de ' + contact.dataset.course + '.'
      : 'Olá! Quero conhecer os cursos da escola.';
    contactLink.href = 'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent(text);
  }
  contactDialog.showModal();
});
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rectangle = dialog.getBoundingClientRect();
  if (event.clientX < rectangle.left || event.clientX > rectangle.right || event.clientY < rectangle.top || event.clientY > rectangle.bottom) dialog.close();
}));

// O conteúdo e os cards já estão no HTML. O JavaScript só filtra a listagem.
const cards = $$('[data-post-category]');
const filters = $('.filters');
let activeCategory = 'all';
if (filters && cards.length) {
  const categories = [...new Set(cards.map(card => card.dataset.postCategory))];
  filters.replaceChildren();
  for (const [value, label] of [['all', 'Todos os posts'], ...categories.map(category => [category, category])]) {
    const button = document.createElement('button');
    button.className = 'filter' + (value === 'all' ? ' active' : '');
    button.dataset.filter = value;
    button.setAttribute('aria-pressed', String(value === 'all'));
    button.textContent = label;
    filters.append(button);
  }
}
const normalize = value => String(value).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function filterPosts() {
  const query = normalize($('#post-search')?.value || '');
  let visible = 0;
  cards.forEach(card => {
    card.hidden = (activeCategory !== 'all' && card.dataset.postCategory !== activeCategory)
      || !normalize(card.dataset.search || card.textContent).includes(query);
    if (!card.hidden) visible++;
  });
  const empty = $('.search-empty');
  if (empty) empty.hidden = visible > 0;
}
filters?.addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  activeCategory = button.dataset.filter;
  $$('[data-filter]', filters).forEach(filter => {
    const active = filter === button;
    filter.classList.toggle('active', active);
    filter.setAttribute('aria-pressed', String(active));
  });
  filterPosts();
});
$('#post-search')?.addEventListener('input', filterPosts);

$('[data-share]')?.addEventListener('click', async () => {
  try {
    if (navigator.share) await navigator.share({title: document.title, url: location.href});
    else {
      await navigator.clipboard.writeText(location.href);
      toast('Link copiado. Compartilhe essa história!');
    }
  } catch (error) {
    if (error.name !== 'AbortError') toast('Copie o endereço da página para compartilhar.');
  }
});
