import { createWithBase } from '../utils/format';

const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);
const indexUrl = withBase('gallery/index.json');

const searchForm = document.querySelector<HTMLFormElement>('[data-gallery-search-form]');
const searchInput = document.querySelector<HTMLInputElement>('#gallery-search');
const searchBtn = document.querySelector<HTMLButtonElement>('#gallery-search-btn');
const browsePanel = document.querySelector<HTMLElement>('[data-gallery-browse]');
const resultsPanel = document.querySelector<HTMLElement>('#gallery-search-results-panel');
const resultsSummary = document.querySelector<HTMLElement>('[data-gallery-search-results-summary]');
const resultsList = document.querySelector<HTMLElement>('[data-gallery-search-results-list]');
const resultsClearBtn = document.querySelector<HTMLElement>('[data-gallery-search-clear]');
const searchStatus = document.getElementById('gallery-search-status');
const searchLive = document.getElementById('gallery-search-live');
const yearItems = document.querySelectorAll<HTMLButtonElement>('[data-gallery-year-item]');
const yearMoreTrigger = document.querySelector<HTMLButtonElement>('[data-gallery-year-more-trigger]');
const yearMoreWrap = document.querySelector<HTMLElement>('[data-gallery-year-more]');
const yearMenu = document.querySelector<HTMLElement>('[data-gallery-year-menu]');
const yearMenuItems = document.querySelectorAll<HTMLButtonElement>('[data-gallery-year-menu-item]');
const yearSelect = document.querySelector<HTMLSelectElement>('[data-gallery-year-select]');

let searchIndex: any[] | null = null;
let activeYear: number | null = null;
let searchQuery = '';
let isSearchMode = false;

async function loadSearchIndex() {
  if (!searchIndex) {
    const response = await fetch(indexUrl);
    if (!response.ok) throw new Error('Failed to load search index');
    searchIndex = await response.json();
  }
  return searchIndex;
}

function hasSearchOrFilter() {
  return Boolean(searchQuery) || activeYear !== null;
}

function normalizeText(text: string) {
  return text.toLowerCase().trim();
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function getResultCardHTML(item: any) {
  const hasMedia = Boolean(item.thumbnail);
  const tagsHTML = (item.tags || [])
    .map((tag: string) => {
      const isPlace = tag.toLowerCase().startsWith('loc:');
      const text = isPlace ? tag.slice(4) : `#${tag}`;
      return `<span class="gallery-search-result__tag ${isPlace ? 'gallery-search-result__tag--place' : ''}">${escapeHtml(text)}</span>`;
    })
    .join('');

  const thumbHTML = hasMedia
    ? `<div class="gallery-search-result__thumb"><img src="${escapeHtml(item.thumbnail.src)}" alt="${escapeHtml(item.thumbnail.alt)}" width="${item.thumbnail.width}" height="${item.thumbnail.height}" loading="lazy" decoding="async" /></div>`
    : '';

  const contentHTML = `
    <div class="gallery-search-result__content">
      ${item.excerpt ? `<p class="gallery-search-result__excerpt">${escapeHtml(item.excerpt)}</p>` : ''}
      ${tagsHTML ? `<div class="gallery-search-result__tags">${tagsHTML}</div>` : ''}
      <div class="gallery-search-result__footer">
        <div></div>
        <div class="gallery-search-result__meta-line">
          <span class="gallery-search-result__date">${escapeHtml(item.dateLabel || '')}</span>
          ${item.page > 1 ? `<span class="gallery-search-result__sep">·</span><a class="gallery-search-result__page" href="${escapeHtml(item.href)}">Page ${item.page}</a>` : ''}
        </div>
      </div>
    </div>
  `;

  return `
    <article class="gallery-card gallery-card--search-result">
      <a class="gallery-search-result__link ${hasMedia ? 'gallery-search-result__layout--media' : 'gallery-search-result__layout'}" href="${escapeHtml(item.href)}">
        ${thumbHTML}
        ${contentHTML}
      </a>
    </article>
  `;
}

function getEmptyHTML() {
  return `<p class="gallery-search-results__empty">No results found.</p>`;
}

function updateResultsView() {
  if (!resultsList) return;

  if (!isSearchMode) {
    resultsPanel?.setAttribute('hidden', '');
    browsePanel?.removeAttribute('hidden');
    resultsList.innerHTML = '';
    if (searchStatus) searchStatus.textContent = '';
    return;
  }

  browsePanel?.setAttribute('hidden', '');
  resultsPanel?.removeAttribute('hidden');

  if (!searchIndex) {
    resultsList.innerHTML = getEmptyHTML();
    return;
  }

  let results = [...searchIndex];
  if (activeYear !== null) {
    results = results.filter((item) => item.year === activeYear);
  }

  if (searchQuery) {
    const q = normalizeText(searchQuery);
    results = results.filter((item) =>
      normalizeText(item.title || '').includes(q) ||
      normalizeText(item.text || '').includes(q) ||
      normalizeText(item.excerpt || '').includes(q) ||
      (item.tags || []).some((tag: string) => normalizeText(tag).includes(q))
    );
  }

  if (resultsSummary) {
    const countText = `${results.length} result${results.length === 1 ? '' : 's'}`;
    const yearText = activeYear !== null ? ` in ${activeYear}` : '';
    const queryText = searchQuery ? ` for "${escapeHtml(searchQuery)}"` : '';
    resultsSummary.textContent = `${countText}${yearText}${queryText}`;
  }

  if (searchStatus) searchStatus.textContent = '';
  if (results.length === 0) resultsList.innerHTML = getEmptyHTML();
  else resultsList.innerHTML = results.map((item) => getResultCardHTML(item)).join('');
}

async function runSearch() {
  if (searchLive) searchLive.textContent = 'Searching...';
  try {
    await loadSearchIndex();
    isSearchMode = hasSearchOrFilter();
    updateResultsView();
  } catch (err) {
    if (searchStatus) searchStatus.textContent = 'Search failed. Please try again.';
  }
  if (searchLive) searchLive.textContent = '';
}

function clearSearch() {
  searchQuery = '';
  if (searchInput) searchInput.value = '';
  if (activeYear !== null) {
    activeYear = null;
    updateYearFilterUI();
  }
  runSearch();
}

function setYearFilter(year: number | null) {
  activeYear = year;
  updateYearFilterUI();
  runSearch();
}

function updateYearFilterUI() {
  yearItems.forEach((btn) => {
    const year = btn.dataset.galleryYear === '' ? null : Number(btn.dataset.galleryYear);
    const isActive = year === activeYear || (year === null && activeYear === null);
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  yearMenuItems.forEach((btn) => {
    const year = Number(btn.dataset.galleryYear);
    const isActive = year === activeYear;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  if (yearSelect) {
    yearSelect.value = activeYear === null ? '' : String(activeYear);
  }
}

searchForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  searchQuery = searchInput?.value.trim() || '';
  runSearch();
});

searchBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  searchQuery = searchInput?.value.trim() || '';
  runSearch();
});

if (searchInput) {
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    runSearch();
  });
}

resultsClearBtn?.addEventListener('click', clearSearch);

yearItems.forEach((btn) => {
  btn.addEventListener('click', () => {
    const year = btn.dataset.galleryYear === '' ? null : Number(btn.dataset.galleryYear);
    setYearFilter(year);
  });
});

yearMenuItems.forEach((btn) => {
  btn.addEventListener('click', () => {
    const year = Number(btn.dataset.galleryYear);
    setYearFilter(year);
    if (yearMoreWrap) yearMoreWrap.dataset.open = 'false';
    if (yearMenu) yearMenu.setAttribute('hidden', '');
    if (yearMoreTrigger) yearMoreTrigger.setAttribute('aria-expanded', 'false');
  });
});

yearMoreTrigger?.addEventListener('click', () => {
  const isOpen = yearMoreWrap?.dataset.open === 'true';
  if (yearMoreWrap) yearMoreWrap.dataset.open = String(!isOpen);
  if (yearMenu) {
    if (isOpen) yearMenu.setAttribute('hidden', '');
    else yearMenu.removeAttribute('hidden');
  }
  yearMoreTrigger?.setAttribute('aria-expanded', String(!isOpen));
});

document.addEventListener('click', (e) => {
  const target = e.target as Node;
  if (yearMoreWrap && !yearMoreWrap.contains(target) && yearMoreWrap.dataset.open === 'true') {
    yearMoreWrap.dataset.open = 'false';
    yearMenu?.setAttribute('hidden', '');
    yearMoreTrigger?.setAttribute('aria-expanded', 'false');
  }
});

yearSelect?.addEventListener('change', () => {
  const year = yearSelect.value === '' ? null : Number(yearSelect.value);
  setYearFilter(year);
});

document.addEventListener('astro:page-load', () => {
  searchQuery = searchInput?.value.trim() || '';
});