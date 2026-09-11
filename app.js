/* Вітамінка Олени — вітрина добавок з iHerb.
   Каталог живе у Google Таблиці Олени: вона міняє ціну й наявність там, сайт підхоплює сам.
   Якщо таблиця не задана або тимчасово недоступна — показуємо вбудований список,
   щоб вітрина ніколи не була порожньою. */

/** ID опублікованої таблиці — частина адреси між /d/ та /edit.
    Порожньо = працює лише вбудований список нижче. */
const SHEET_ID = '';
/** Назва аркуша з каталогом. */
const SHEET_TAB = 'Каталог';

/** Резервний каталог. Ціни звірено з оголошеннями продавця 11.09.2026. */
const FALLBACK = [
  {name: 'Вітамін D3', brand: 'NOW Foods', category: 'Вітаміни', detail: '120 капсул · 2000 МО', price: 215, oldPrice: 0, stock: true, image: 'products/d3.jpg', url: 'https://www.kidstaff.com.ua/tema-30954663.html'},
  {name: 'Таурат магнію+', brand: 'KAL', category: 'Мінерали', detail: '180 таблеток', price: 1160, oldPrice: 0, stock: true, image: 'products/magnesium.jpg', url: 'https://www.kidstaff.com.ua/tema-32556516.html'},
  {name: 'Омега-3', brand: 'NOW Foods', category: 'Омега', detail: '100 капсул · риб’ячий жир 1000 мг', price: 335, oldPrice: 0, stock: true, image: 'products/omega-now.jpg', url: 'https://www.kidstaff.com.ua/tema-32628562.html'},
  {name: 'Омега-800', brand: 'California Gold Nutrition', category: 'Омега', detail: '30 капсул · омега-3 800 мг', price: 345, oldPrice: 0, stock: true, image: 'products/omega-cgn.jpg', url: 'https://www.kidstaff.com.ua/tema-32628562.html'},
  {name: 'Цитрат цинку', brand: '21st Century', category: 'Мінерали', detail: '60 таблеток · 50 мг', price: 110, oldPrice: 0, stock: true, image: 'products/zinc.jpg', url: 'https://www.kidstaff.com.ua/tema-32355256.html'},
  {name: 'Комплекс вітамінів B', brand: 'Life Extension', category: 'Комплекси', detail: '60 вегетаріанських капсул', price: 405, oldPrice: 0, stock: true, image: 'products/b-complex.jpg', url: 'https://www.kidstaff.com.ua/tema-30954663.html'},
  {name: 'Hema-Plex', brand: 'NaturesPlus', category: 'Комплекси', detail: '30 таблеток · тривале вивільнення', price: 425, oldPrice: 0, stock: true, image: 'products/hema-plex.jpg', url: 'https://www.kidstaff.com.ua/tema-30756832.html'},
  {name: 'Жувальний вітамін D3', brand: 'California Gold Nutrition', category: 'Вітаміни', detail: '90 мармеладок · 1000 МО в 1 шт.', price: 370, oldPrice: 0, stock: true, image: 'products/d3-gummies.jpg', url: 'https://www.kidstaff.com.ua/tema-32556474.html'},
];

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23eef4ef'/%3E%3Cpath d='M44 40h32v46a8 8 0 0 1-8 8H52a8 8 0 0 1-8-8z' fill='none' stroke='%2398b3a2' stroke-width='4'/%3E%3Crect x='50' y='28' width='20' height='12' rx='3' fill='none' stroke='%2398b3a2' stroke-width='4'/%3E%3C/svg%3E";

/* ── Читання таблиці ───────────────────────────────────────────────── */

/** Розбір CSV з підтримкою лапок, ком і переносів усередині клітинок. */
function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

/** Заголовки приймаємо українською, російською та англійською — щоб Олені не довелось підганяти таблицю. */
const FIELDS = {
  name:     ['назва', 'название', 'товар', 'name'],
  brand:    ['бренд', 'виробник', 'производитель', 'brand'],
  category: ['категорія', 'категория', 'розділ', 'раздел', 'category'],
  detail:   ['фасування', 'фасовка', 'дозування', 'дозировка', 'опис', 'описание', 'detail'],
  price:    ['ціна', 'цена', 'price'],
  oldPrice: ['стара ціна', 'старая цена', 'ціна до знижки', 'old price'],
  stock:    ['наявність', 'наличие', 'є в наявності', 'stock', 'availability'],
  image:    ['фото', 'зображення', 'изображение', 'картинка', 'image'],
  url:      ['посилання', 'ссылка', 'оголошення', 'объявление', 'link', 'url'],
};

const norm = s => s.trim().toLowerCase().replace(/[.:]+$/, '').replace(/\s+/g, ' ');

function mapHeaders(header) {
  const cells = header.map(norm), idx = {};
  for (const [field, names] of Object.entries(FIELDS)) {
    for (const want of names) { const i = cells.indexOf(want); if (i >= 0) { idx[field] = i; break; } }
    if (idx[field] === undefined)
      for (const want of names) { const i = cells.findIndex(h => h.includes(want)); if (i >= 0) { idx[field] = i; break; } }
  }
  return idx;
}

const TRUTHY = ['так', 'да', 'yes', 'true', '1', '+', 'є', 'есть', 'в наявності', 'в наличии'];
const money = n => new Intl.NumberFormat('uk-UA').format(n) + ' ₴';
const num = v => Math.round(Number(String(v).replace(/[^\d.,]/g, '').replace(',', '.')));

/** Стабільний id з назви — щоб кошик переживав перестановку рядків у таблиці. */
function hashId(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'p' + (h >>> 0).toString(36);
}

/** Пряме посилання на фото з Google Диска. */
function directImage(url) {
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
  return drive ? `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w800` : url;
}

function rowsToProducts(rows) {
  if (!rows.length) return [];
  const idx = mapHeaders(rows[0]);
  if (idx.name === undefined || idx.price === undefined) return [];
  const get = (r, f) => (idx[f] === undefined ? '' : (r[idx[f]] ?? '').trim());
  const out = [], seen = new Set();

  for (const r of rows.slice(1)) {
    const name = get(r, 'name'), price = num(get(r, 'price'));
    if (name.length < 2 || !Number.isFinite(price) || price <= 0) continue;
    const id = hashId(name + get(r, 'brand'));
    if (seen.has(id)) continue;
    seen.add(id);

    const raw = get(r, 'stock').toLowerCase();
    const oldPrice = num(get(r, 'oldPrice'));
    const image = get(r, 'image');
    out.push({
      id, name,
      brand: get(r, 'brand'),
      category: get(r, 'category') || 'Інше',
      detail: get(r, 'detail'),
      price,
      oldPrice: Number.isFinite(oldPrice) && oldPrice > price ? oldPrice : 0,
      // Порожня клітинка означає «є»: так Олені не треба заповнювати колонку для звичайних товарів.
      stock: raw === '' || TRUTHY.includes(raw),
      image: image ? directImage(image) : PLACEHOLDER,
      url: get(r, 'url'),
    });
  }
  return out;
}

async function loadCatalog() {
  if (!SHEET_ID) return FALLBACK.map(p => ({...p, id: hashId(p.name + p.brand)}));
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
  try {
    const res = await fetch(url, {signal: AbortSignal.timeout(8000)});
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = rowsToProducts(parseCsv(await res.text()));
    if (!data.length) throw new Error('Таблиця порожня');
    return data;
  } catch {
    return FALLBACK.map(p => ({...p, id: hashId(p.name + p.brand)}));
  }
}

/* ── Вітрина ───────────────────────────────────────────────────────── */

let products = [], category = 'Усі', inStockOnly = false, timer;
const cart = {};
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

function renderChips() {
  const cats = ['Усі', ...new Set(products.map(p => p.category).filter(Boolean))];
  if (!cats.includes(category)) category = 'Усі';
  $('#chips').innerHTML = cats.map(c =>
    `<button data-cat="${esc(c)}"${c === category ? ' class="active"' : ''}>${esc(c)}</button>`).join('');
}

function render() {
  const query = $('#search').value.trim().toLowerCase();
  const mode = $('#sort').value;
  let list = products.filter(p =>
    (category === 'Усі' || p.category === category) &&
    (!inStockOnly || p.stock) &&
    (p.name + ' ' + p.brand + ' ' + p.category + ' ' + p.detail).toLowerCase().includes(query));

  // Наявні — завжди попереду; далі вже обраний порядок (сортування стабільне).
  list.sort((a, b) => (b.stock - a.stock) ||
    (mode === 'asc' ? a.price - b.price : mode === 'desc' ? b.price - a.price : 0));

  $('#products').innerHTML = list.length ? list.map(p => {
    const off = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    const link = (inner, cls) => p.url
      ? `<a class="${cls}" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
      : `<span class="${cls}">${inner}</span>`;
    return `<article class="product${p.stock ? '' : ' out'}">
      <div class="product-art">
        ${off ? `<span class="tag sale">−${off}%</span>` : `<span class="tag">${esc(p.category)}</span>`}
        ${link(`<img src="${esc(p.image)}" alt="${esc(p.brand + ' ' + p.name + ', ' + p.detail)}" loading="lazy" width="300" height="300">`, 'art-link')}
      </div>
      <div class="product-info">
        <span class="brand">${esc(p.brand)}</span>
        <h3>${link(esc(p.name), 'name-link')}</h3>
        <p class="meta">${esc(p.detail)}</p>
        <p class="stock ${p.stock ? 'yes' : 'no'}">${p.stock ? 'В наявності' : 'Немає в наявності'}</p>
        <div class="buy">
          <span class="price">${money(p.price)}${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ''}</span>
          ${p.stock
            ? `<button data-add="${p.id}" aria-label="Додати ${esc(p.name)} до кошика">До кошика +</button>`
            : `<button disabled aria-label="${esc(p.name)} немає в наявності">Немає</button>`}
        </div>
        ${p.url ? `<a class="listing-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Деталі на Kidstaff ↗</a>` : ''}
      </div>
    </article>`;
  }).join('') : '<p class="empty">Нічого не знайдено. Спробуйте іншу назву або категорію.</p>';
}

function renderCart() {
  const items = products.filter(p => cart[p.id]);
  $('#count').textContent = Object.values(cart).reduce((a, b) => a + b, 0);
  $('#cart-items').innerHTML = items.length ? items.map(p => `<div class="cart-row">
    <div><b>${esc(p.name)}</b><p>${esc(p.brand)} · ${esc(p.detail)}</p>
    ${p.url ? `<a class="listing-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Уточнити та замовити ↗</a>` : ''}
    <p>${money(p.price)}</p></div>
    <div class="quantity"><button data-minus="${p.id}" aria-label="Зменшити кількість ${esc(p.name)}">−</button><span>${cart[p.id]}</span><button data-plus="${p.id}" aria-label="Збільшити кількість ${esc(p.name)}">+</button></div>
  </div>`).join('') : '<p>Тут поки порожньо. Оберіть щось у каталозі.</p>';
  $('#total').textContent = items.length ? 'Разом: ' + money(items.reduce((s, p) => s + p.price * cart[p.id], 0)) : '';
}

function add(id) {
  const p = products.find(p => p.id === id);
  if (!p) throw new Error('Товар не знайдено');
  if (!p.stock) throw new Error('Товару немає в наявності');
  cart[id] = (cart[id] || 0) + 1;
  renderCart();
  $('#toast').textContent = 'Додано до кошика';
  $('#toast').classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => $('#toast').classList.remove('show'), 1800);
  return {productId: id, quantity: cart[id]};
}

document.addEventListener('click', e => {
  const button = e.target.closest('button');
  if (!button) return;
  if (button.dataset.cat) {
    category = button.dataset.cat;
    document.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('active', b.dataset.cat === category));
    render();
  }
  if (button.dataset.add) add(button.dataset.add);
  if (button.dataset.plus) add(button.dataset.plus);
  if (button.dataset.minus) { const id = button.dataset.minus; cart[id] = Math.max(0, (cart[id] || 0) - 1); renderCart(); }
});

$('#search').addEventListener('input', render);
$('#sort').addEventListener('change', render);
$('#in-stock').addEventListener('change', e => { inStockOnly = e.target.checked; render(); });
$('#open-cart').onclick = () => { $('#cart').showModal(); renderCart(); };
$('#close-cart').onclick = $('#continue').onclick = () => $('#cart').close();
$('#cart').addEventListener('click', e => {
  if (e.target !== $('#cart')) return;
  const r = e.target.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
});

loadCatalog().then(data => { products = data; renderChips(); render(); renderCart(); });

if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'add_product_to_cart',
      description: 'Додати товар до локального списку покупок. Не надсилає замовлення продавцю.',
      inputSchema: {type: 'object', properties: {productId: {type: 'string'}}, required: ['productId'], additionalProperties: false},
      annotations: {readOnlyHint: false},
      execute(input) {
        if (!input || typeof input.productId !== 'string') throw new Error('Потрібен productId');
        return add(input.productId);
      },
    }, {signal: lifecycle.signal})).catch(() => {});
    addEventListener('pagehide', () => lifecycle.abort(), {once: true});
  } catch {}
}
