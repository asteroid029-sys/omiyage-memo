const DB_NAME = 'omiyage-memo-db';
const STORE_NAME = 'souvenirs';
const DB_VERSION = 1;

let db;
let items = [];
let currentFilter = 'all';
let currentTag = 'all';
let editingId = null;
let pendingDeleteId = null;
let currentPhotoData = '';
let currentEditorTags = [];

const $ = (id) => document.getElementById(id);
const listEl = $('list');
const emptyState = $('emptyState');
const filterEmptyState = $('filterEmptyState');
const dialog = $('editorDialog');
const form = $('souvenirForm');
const confirmDialog = $('confirmDialog');

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(mode = 'readonly') {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function getAllItems() {
  return new Promise((resolve, reject) => {
    const request = tx().getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function saveItem(item) {
  return new Promise((resolve, reject) => {
    const request = tx('readwrite').put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deleteItem(id) {
  return new Promise((resolve, reject) => {
    const request = tx('readwrite').delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function formatYen(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n);
}

function formatLocal(value, currency = 'EUR') {
  const n = Number(value || 0);
  if (!n) return '';
  try {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`;
  }
}

function sanitizeMapUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch { return ''; }
}

function makeMapSearchUrl(place) {
  if (!place) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

function getItemTags(item) {
  return Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
}

function getAllTags() {
  return [...new Set(items.flatMap(getItemTags))].sort((a, b) => a.localeCompare(b, 'ja'));
}

function renderTagFilters() {
  const tags = getAllTags();
  const section = $('tagFilterSection');
  const wrap = $('tagFilters');
  section.hidden = tags.length === 0;
  wrap.innerHTML = '';

  if (!tags.includes(currentTag) && currentTag !== 'all') currentTag = 'all';

  const choices = ['all', ...tags];
  choices.forEach(tag => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tag-filter-chip';
    button.classList.toggle('active', tag === currentTag);
    button.textContent = tag === 'all' ? 'すべて' : `#${tag}`;
    button.addEventListener('click', () => {
      currentTag = tag;
      render();
    });
    wrap.appendChild(button);
  });
}

function render() {
  renderTagFilters();

  const visible = items
    .filter(item => currentFilter === 'all' || (currentFilter === 'done' ? item.done : !item.done))
    .filter(item => currentTag === 'all' || getItemTags(item).includes(currentTag))
    .sort((a, b) => Number(a.done) - Number(b.done) || b.updatedAt - a.updatedAt);

  listEl.innerHTML = '';
  visible.forEach(item => listEl.appendChild(renderItem(item)));

  emptyState.hidden = items.length !== 0;
  const noFilteredItems = items.length > 0 && visible.length === 0;
  filterEmptyState.hidden = !noFilteredItems;
  listEl.hidden = items.length === 0 || noFilteredItems;

  const doneCount = items.filter(i => i.done).length;
  $('progressText').textContent = `${doneCount} / ${items.length}`;
  $('progressBar').style.width = items.length ? `${(doneCount / items.length) * 100}%` : '0%';
  $('totalPrice').textContent = formatYen(items.reduce((sum, item) => sum + Number(item.price || 0), 0));

  const currencyTotals = new Map();
  items.forEach(item => {
    const amount = Number(item.localPrice || 0);
    if (!amount) return;
    const currency = item.currency || 'EUR';
    currencyTotals.set(currency, (currencyTotals.get(currency) || 0) + amount);
  });

  const localTotals = $('localTotals');
  localTotals.innerHTML = '';
  if (currencyTotals.size) {
    localTotals.hidden = false;
    [...currencyTotals.entries()].forEach(([currency, total]) => {
      const pill = document.createElement('span');
      pill.className = 'currency-total';
      pill.textContent = `${currency}合計 ${formatLocal(total, currency)}`;
      localTotals.appendChild(pill);
    });
  } else {
    localTotals.hidden = true;
  }
}

function renderItem(item) {
  const node = $('itemTemplate').content.firstElementChild.cloneNode(true);
  node.dataset.id = item.id;
  node.classList.toggle('done', item.done);

  const img = node.querySelector('.thumb');
  if (item.photoData) {
    img.src = item.photoData;
    img.hidden = false;
  } else {
    img.hidden = true;
  }

  node.querySelector('.item-name').textContent = item.name;
  node.querySelector('.item-place').textContent = item.place || '買える場所 未登録';
  node.querySelector('.item-price').textContent = item.price ? formatYen(item.price) : '';
  node.querySelector('.item-local-price').textContent = item.localPrice ? formatLocal(item.localPrice, item.currency || 'EUR') : '';
  node.querySelector('.item-memo').textContent = item.memo || '';

  const tagWrap = node.querySelector('.item-tags');
  getItemTags(item).forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'item-tag';
    chip.textContent = `#${tag}`;
    tagWrap.appendChild(chip);
  });

  const map = node.querySelector('.map-button');
  const mapUrl = sanitizeMapUrl(item.mapUrl) || makeMapSearchUrl(item.place);
  if (mapUrl) {
    map.href = mapUrl;
    map.hidden = false;
  } else {
    map.hidden = true;
  }

  node.querySelector('.check-button').addEventListener('click', async () => {
    item.done = !item.done;
    item.updatedAt = Date.now();
    await saveItem(item);
    render();
  });

  node.querySelector('.card-main').addEventListener('click', () => openEditor(item));
  node.querySelector('.delete-button').addEventListener('click', () => askDelete(item.id));
  return node;
}

function openEditor(item = null) {
  editingId = item?.id || null;
  currentPhotoData = item?.photoData || '';
  currentEditorTags = [...getItemTags(item || {})];
  $('sheetTitle').textContent = item ? 'お土産を編集' : 'お土産を追加';
  $('nameInput').value = item?.name || '';
  $('placeInput').value = item?.place || '';
  $('priceInput').value = item?.price || '';
  $('localPriceInput').value = item?.localPrice || '';
  $('currencyInput').value = item?.currency || 'EUR';
  $('memoInput').value = item?.memo || '';
  $('tagInput').value = '';
  updatePhotoPreview();
  renderEditorTags();
  dialog.showModal();
  setTimeout(() => $('nameInput').focus(), 100);
}

function closeEditor() {
  dialog.close();
  form.reset();
  editingId = null;
  currentPhotoData = '';
  currentEditorTags = [];
}

function updatePhotoPreview() {
  const preview = $('photoPreview');
  const placeholder = $('photoPlaceholder');
  const remove = $('removePhotoButton');
  if (currentPhotoData) {
    preview.src = currentPhotoData;
    preview.hidden = false;
    placeholder.hidden = true;
    remove.hidden = false;
  } else {
    preview.removeAttribute('src');
    preview.hidden = true;
    placeholder.hidden = false;
    remove.hidden = true;
  }
}

function renderEditorTags() {
  const wrap = $('editorTags');
  wrap.innerHTML = '';
  currentEditorTags.forEach(tag => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'editor-tag';
    chip.innerHTML = `<span>#${escapeHtml(tag)}</span><span aria-hidden="true">×</span>`;
    chip.setAttribute('aria-label', `${tag} タグを削除`);
    chip.addEventListener('click', () => {
      currentEditorTags = currentEditorTags.filter(t => t !== tag);
      renderEditorTags();
    });
    wrap.appendChild(chip);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function addTagFromInput() {
  const input = $('tagInput');
  const tag = input.value.trim().replace(/^#/, '').replace(/[,、]/g, '');
  if (!tag) return;
  if (!currentEditorTags.includes(tag)) currentEditorTags.push(tag);
  input.value = '';
  renderEditorTags();
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function refresh() {
  items = await getAllItems();
  render();
}

function askDelete(id) {
  pendingDeleteId = id;
  confirmDialog.showModal();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  addTagFromInput();

  const existing = items.find(i => i.id === editingId);
  const priceRaw = $('priceInput').value.replace(/[^0-9]/g, '');
  const localPriceRaw = $('localPriceInput').value.replace(',', '.').replace(/[^0-9.]/g, '');
  const now = Date.now();
  const item = {
    id: editingId || crypto.randomUUID(),
    name: $('nameInput').value.trim(),
    place: $('placeInput').value.trim(),
    // 旧バージョンのURLは編集後も保持し、既存データを壊さない
    mapUrl: existing?.mapUrl || '',
    photoData: currentPhotoData,
    price: priceRaw ? Number(priceRaw) : 0,
    localPrice: localPriceRaw ? Number(localPriceRaw) : 0,
    currency: $('currencyInput').value || 'EUR',
    tags: [...currentEditorTags],
    memo: $('memoInput').value.trim(),
    done: existing?.done || false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  await saveItem(item);
  closeEditor();
  await refresh();
});

$('photoInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  currentPhotoData = await compressImage(file);
  updatePhotoPreview();
});

$('removePhotoButton').addEventListener('click', () => {
  currentPhotoData = '';
  $('photoInput').value = '';
  updatePhotoPreview();
});

$('openMapSearchButton').addEventListener('click', () => {
  const place = $('placeInput').value.trim();
  if (!place) {
    $('placeInput').focus();
    $('placeInput').setCustomValidity('先に場所名を入力してください');
    $('placeInput').reportValidity();
    $('placeInput').setCustomValidity('');
    return;
  }
  window.open(makeMapSearchUrl(place), '_blank', 'noopener');
});

$('addTagButton').addEventListener('click', addTagFromInput);
$('tagInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    addTagFromInput();
  }
});

$('cancelButton').addEventListener('click', closeEditor);
$('addButton').addEventListener('click', () => openEditor());
$('fab').addEventListener('click', () => openEditor());
$('emptyAddButton').addEventListener('click', () => openEditor());

confirmDialog.addEventListener('close', async () => {
  if (confirmDialog.returnValue === 'delete' && pendingDeleteId) {
    await deleteItem(pendingDeleteId);
    await refresh();
  }
  pendingDeleteId = null;
});

document.querySelectorAll('.filter-tab').forEach(button => {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.toggle('active', b === button));
    render();
  });
});

window.addEventListener('DOMContentLoaded', async () => {
  db = await openDb();
  await refresh();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }
});
