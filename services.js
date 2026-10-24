/**
 * Work Satthi — Services page logic (services.js)
 * Handles: service search, category filtering, card rendering.
 * Does NOT write inline styles or inject CSS rules.
 */

(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Static service data — mirrors the backend's services array
  ----------------------------------------------------------------------- */
  const SERVICES = [
    {
      id: 'plumbing',
      name: 'Plumbing',
      category: 'repairs',
      description: 'Leaks, taps, fittings, and common water-related repairs.',
      illustration: 'assets/services/plumbing.jpeg',
      illustrationAlt: 'Cartoon plumber repairing a sink',
      illustrationClass: 'service-card__illustration--plumbing',
      linkLabel: 'Find plumbing help',
    },
    {
      id: 'electrical',
      name: 'Electrical Work',
      category: 'home',
      description: 'Household electrical repairs and installation by skilled workers.',
      illustration: 'assets/services/electrical.jpeg',
      illustrationAlt: 'Illustrated electrician with tools',
      illustrationClass: 'service-card__illustration--electrical',
      linkLabel: 'Find electrical help',
    },
    {
      id: 'cleaning',
      name: 'Home Cleaning',
      category: 'cleaning',
      description: 'One-time cleaning or scheduled help to keep spaces fresh.',
      illustration: 'assets/services/cleaning.jpeg',
      illustrationAlt: 'Illustrated cleaner sweeping with a broom',
      illustrationClass: 'service-card__illustration--cleaning',
      linkLabel: 'Find cleaning help',
    },
    {
      id: 'cooking',
      name: 'Cooking & Daily Help',
      category: 'daily-help',
      description: 'Local cooks and people with a range of everyday skills.',
      illustration: 'assets/services/cooking.jpeg',
      illustrationAlt: 'Cook preparing food in a home kitchen',
      illustrationClass: 'service-card__illustration--cooking',
      linkLabel: 'Find cooking help',
    },
    {
      id: 'carpentry',
      name: 'Carpentry',
      category: 'repairs',
      description: 'Furniture repairs, fittings, and small woodwork jobs.',
      illustration: 'assets/illustrations/plumbing.svg',
      illustrationAlt: 'Illustration of carpentry tools',
      illustrationClass: 'service-card__illustration--plumbing',
      linkLabel: 'Find carpentry help',
    },
    {
      id: 'painting',
      name: 'Painting',
      category: 'home',
      description: 'Room painting, touch-up work, and surface preparation.',
      illustration: 'assets/illustrations/electrical.svg',
      illustrationAlt: 'Illustration of painting tools',
      illustrationClass: 'service-card__illustration--electrical',
      linkLabel: 'Find painting help',
    },
  ];

  /* -----------------------------------------------------------------------
     Elements
  ----------------------------------------------------------------------- */
  const grid         = document.getElementById('services-grid');
  const countEl      = document.getElementById('services-count');
  const titleEl      = document.getElementById('services-grid-title');
  const searchInput  = document.getElementById('services-search-input');
  const searchBtn    = document.getElementById('services-search-btn');
  const filterBtns   = document.querySelectorAll('.filter-btn');

  let currentCategory = 'all';
  let currentQuery    = '';

  /* -----------------------------------------------------------------------
     Render
  ----------------------------------------------------------------------- */
  function buildCardHTML(service) {
    return [
      '<article class="service-card">',
      '  <div class="service-card__illustration ' + service.illustrationClass + '">',
      '    <img src="' + service.illustration + '" alt="' + service.illustrationAlt + '" loading="lazy" decoding="async">',
      '  </div>',
      '  <p class="service-card__label">' + service.category.toUpperCase().replace(/-/g, ' ') + '</p>',
      '  <h3>' + service.name + '</h3>',
      '  <p class="service-card__desc">' + service.description + '</p>',
      '  <a class="service-card__link" href="login.html?mode=signup" aria-label="' + service.linkLabel + '">',
      '    ' + service.linkLabel,
      '    <span aria-hidden="true">→</span>',
      '  </a>',
      '</article>',
    ].join('\n');
  }

  function buildEmptyHTML(query, category) {
    const term = query || category;
    return [
      '<div class="services-empty">',
      '  <div class="services-empty-icon" aria-hidden="true">',
      '    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#68766E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">',
      '      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
      '    </svg>',
      '  </div>',
      '  <h3>No services found</h3>',
      '  <p>No services matched "' + escapeHtml(term) + '". Try a different term or clear your search.</p>',
      '</div>',
    ].join('\n');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderServices() {
    if (!grid) return;

    const q = currentQuery.toLowerCase().trim();
    const cat = currentCategory;

    const filtered = SERVICES.filter(function (s) {
      const matchesQuery = !q ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q);
      const matchesCat = cat === 'all' || s.category === cat;
      return matchesQuery && matchesCat;
    });

    if (filtered.length === 0) {
      grid.innerHTML = buildEmptyHTML(q || cat, '');
    } else {
      grid.innerHTML = filtered.map(buildCardHTML).join('');
    }

    // Update count
    if (countEl) {
      countEl.textContent = filtered.length + (filtered.length === 1 ? ' service' : ' services');
    }

    // Update heading
    if (titleEl) {
      if (cat !== 'all') {
        const catLabel = cat.replace(/-/g, ' ');
        titleEl.textContent = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);
      } else if (q) {
        titleEl.textContent = 'Results for "' + q + '"';
      } else {
        titleEl.textContent = 'All services';
      }
    }
  }

  /* -----------------------------------------------------------------------
     Search
  ----------------------------------------------------------------------- */
  function runSearch() {
    currentQuery = searchInput ? searchInput.value : '';
    renderServices();
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', runSearch);
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') runSearch();
    });

    // Live search with debounce
    let debounceTimer;
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, 280);
    });
  }

  /* -----------------------------------------------------------------------
     Category filters
  ----------------------------------------------------------------------- */
  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      currentCategory = btn.getAttribute('data-category') || 'all';
      renderServices();
    });
  });

  /* -----------------------------------------------------------------------
     URL parameter: ?category=cleaning
  ----------------------------------------------------------------------- */
  const params = new URLSearchParams(window.location.search);
  const catParam = params.get('category');
  if (catParam) {
    currentCategory = catParam;
    filterBtns.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-category') === catParam);
    });
  }

  /* -----------------------------------------------------------------------
     Initial render
  ----------------------------------------------------------------------- */
  renderServices();

}());
