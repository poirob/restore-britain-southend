/* ==========================================================================
   RESTORE BRITAIN — SOUTHEND-ON-SEA BRANCH
   Modular Client Application + Built-in Visual CMS & Backend Sync
   ========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'rb_southend_site_data_v1';
  const SUBS_KEY = 'rb_southend_subscribers_v1';

  // Exact vector SVG path traced from branch_map.jpg (Southend-on-Sea)
  const BRANCH_MAP_PATH =
    'M 248.8 20.0 L 263.0 24.3 L 274.4 41.3 L 290.1 52.7 L 400.9 66.9 L 426.5 68.3 L 440.7 62.6 L 472.0 66.9 L 493.3 59.8 L 507.5 59.8 L 531.7 47.0 L 551.6 49.8 L 548.7 61.2 L 527.4 92.5 L 486.2 139.4 L 415.1 203.4 L 399.5 209.0 L 376.8 236.0 L 356.9 244.6 L 325.6 270.2 L 301.4 300.0 L 277.3 295.7 L 243.1 281.5 L 220.4 282.9 L 200.5 277.3 L 139.4 271.6 L 111.0 263.0 L 75.4 260.2 L 72.6 264.5 L 78.3 270.2 L 66.9 281.5 L 54.1 282.9 L 49.8 274.4 L 52.7 268.7 L 48.4 267.3 L 48.4 244.6 L 52.7 237.5 L 49.8 230.4 L 64.1 214.7 L 62.6 193.4 L 58.4 187.7 L 66.9 174.9 L 74.0 179.2 L 84.0 162.1 L 69.7 156.4 L 68.3 140.8 L 113.8 143.7 L 129.4 139.4 L 139.4 147.9 L 160.7 152.2 L 162.1 145.1 L 155.0 118.1 L 179.2 108.1 L 170.7 78.3 L 160.7 76.9 L 157.9 65.5 L 163.6 58.4 L 163.6 42.7 L 177.8 27.1 L 192.0 25.7 L 201.9 34.2 L 219.0 35.6 L 237.5 32.8 L 247.4 21.4 Z';

  let siteData = null;
  let loadedDefaultData = null;
  let serverAvailable = false;
  let activeTab = 'home';
  let galleryIdx = 0;
  let galleryPaused = false;
  let galleryTimer = null;
  let introTimer = null;
  let selectedHotspotId = 'leigh';
  let activeNewsCategory = 'All';
  let activeAlbionFilter = 'All';
  let selectedTierIndex = 1;
  let activeCmsTab = 'settings';

  /* ---------- Utilities ---------- */
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function normalizeImageUrl(raw) {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (window.EMBEDDED_PHOTOS && window.EMBEDDED_PHOTOS[trimmed]) {
      return window.EMBEDDED_PHOTOS[trimmed];
    }
    // Auto-convert Google Drive share links into embeddable direct image links
    const m = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) {
      return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600`;
    }
    return trimmed;
  }

  function showToast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('is-visible'), 3600);
  }

  function getPhotoLibrary() {
    return [
      { label: 'Branch Group — Priory Park', path: 'assets/photos/DSC08707.jpg' },
      { label: 'Leigh Campaign Team & Rio Holder', path: 'assets/photos/DEX09026.jpg' },
      { label: 'Restore Britain Rosette Close-Up', path: 'assets/photos/DEX09015.jpg' },
      { label: 'Community Clean-Up Volunteers', path: 'assets/photos/DSC08724.jpg' },
      { label: 'High Street Policy Paper Outreach', path: 'assets/photos/DSC08575.jpg' },
      { label: 'Doorstep Leafleting', path: 'assets/photos/DSC08760.jpg' },
      { label: 'Branch Volunteers Smiling', path: 'assets/photos/DSC08811.jpg' },
      { label: 'Leigh Street Canvassing Team', path: 'assets/photos/DEX09008.jpg' },
      { label: 'Branch Strategy Evening', path: 'assets/photos/DEX09010.jpg' },
      { label: 'Rio Holder & Dillon Bliss Together', path: 'assets/photos/DEX09012.jpg' },
      { label: 'Campaign Badge & Placards', path: 'assets/photos/DEX09016.jpg' },
      { label: 'Southend Seafront Outreach', path: 'assets/photos/DSC06755.jpg' },
      { label: 'Community Action Day Team', path: 'assets/photos/DSC08654.jpg' },
      { label: 'Portrait: Dillon Bliss', path: 'assets/photos/dillon-bliss.jpg' },
      { label: 'Portrait: Rio Holder', path: 'assets/photos/rio-holder.jpg' }
    ];
  }

  /* ---------- Data Layer (API + Modular JSON + LocalStorage + Standalone Fallback) ---------- */
  async function loadCanonicalDefaultData() {
    if (window.DEFAULT_SITE_DATA) {
      loadedDefaultData = deepClone(window.DEFAULT_SITE_DATA);
      return deepClone(loadedDefaultData);
    }
    try {
      const resStatic = await fetch('data/site-content.json', { cache: 'no-store' });
      if (resStatic.ok) {
        loadedDefaultData = await resStatic.json();
        return deepClone(loadedDefaultData);
      }
    } catch (_) {}
    return loadedDefaultData ? deepClone(loadedDefaultData) : null;
  }

  async function initData() {
    // 0. Standalone / exported single-file HTML mode: instant 0ms boot
    if (window.EMBEDDED_PHOTOS && window.DEFAULT_SITE_DATA) {
      loadedDefaultData = deepClone(window.DEFAULT_SITE_DATA);
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          siteData = JSON.parse(saved);
          updateBackendBadge();
          return;
        }
      } catch (_) {}
      siteData = deepClone(loadedDefaultData);
      updateBackendBadge();
      return;
    }

    // 1. Try optional Node backend API if served over http(s) (skip on static hosts like GitHub Pages)
    if (window.location.protocol.startsWith('http')) {
      const isStaticHost = /\.github\.io$|\.netlify\.app$|\.pages\.dev$/i.test(window.location.hostname);
      if (!isStaticHost) {
        try {
          const res = await fetch('/api/content', { cache: 'no-store' });
          if (res.ok) {
            siteData = await res.json();
            loadedDefaultData = deepClone(siteData);
            serverAvailable = true;
            updateBackendBadge();
            return;
          }
        } catch (_) {
          // Fallback to modular static JSON mode
        }
      }

      // Load canonical data/site-content.json (always fetch so Reset to Default works cleanly)
      const canonical = await loadCanonicalDefaultData();
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          siteData = JSON.parse(saved);
          updateBackendBadge();
          return;
        }
      } catch (_) {}

      if (canonical) {
        siteData = canonical;
        updateBackendBadge();
        return;
      }
    }

    // 2. Local file fallback: check localStorage edits first, else embedded/canonical default
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        siteData = JSON.parse(saved);
        updateBackendBadge();
        return;
      }
    } catch (_) {}

    const fallback = await loadCanonicalDefaultData();
    if (fallback) {
      siteData = fallback;
    }
    updateBackendBadge();
  }

  async function persistSiteData(quiet) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(siteData));
    } catch (_) {}

    if (serverAvailable) {
      try {
        const res = await fetch('/api/content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(siteData)
        });
        if (res.ok) {
          updateBackendBadge();
          if (!quiet) showToast('Saved permanently to data/site-content.json on server.');
          return true;
        }
      } catch (_) {}
    }
    updateBackendBadge();
    if (!quiet) showToast('Changes saved live in browser. Export JSON or Download index.html to publish.');
    return true;
  }

  function updateBackendBadge() {
    const pill = document.getElementById('cms-backend-status');
    if (!pill) return;
    let hasLocalDraft = false;
    try {
      hasLocalDraft = Boolean(localStorage.getItem(STORAGE_KEY));
    } catch (_) {}

    if (serverAvailable) {
      pill.textContent = 'Connected · Node JSON Backend';
      pill.classList.add('is-server');
    } else if (window.EMBEDDED_PHOTOS) {
      pill.textContent = hasLocalDraft
        ? 'Standalone HTML · Local Edits Active'
        : 'Standalone HTML · Instant Save & Export';
      pill.classList.remove('is-server');
    } else {
      pill.textContent = hasLocalDraft
        ? 'GitHub Pages · Local Draft Active'
        : 'Modular JSON Mode · Live Edit & Export';
      pill.classList.remove('is-server');
    }
  }

  /* ---------- Subscribers / Pledges Storage ---------- */
  async function saveSubmission(record) {
    const entry = Object.assign({ id: 'sub-' + Date.now(), createdAt: new Date().toISOString() }, record);
    let list = getLocalSubmissions();
    list.unshift(entry);
    try {
      localStorage.setItem(SUBS_KEY, JSON.stringify(list));
    } catch (_) {}

    if (serverAvailable) {
      try {
        await fetch('/api/subscribers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
      } catch (_) {}
    }
    return entry;
  }

  function getLocalSubmissions() {
    try {
      return JSON.parse(localStorage.getItem(SUBS_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  async function loadAllSubmissions() {
    if (serverAvailable) {
      try {
        const res = await fetch('/api/subscribers', { cache: 'no-store' });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    return getLocalSubmissions();
  }

  /* ---------- Stage 1: Cinematic Branch Map Entry Animation ---------- */
  function playIntro() {
    const curtain = document.getElementById('intro-curtain');
    if (!curtain) return;
    clearTimeout(introTimer);
    curtain.classList.remove('is-gone', 'is-leaving');
    document.body.classList.add('intro-active');

    // Restart SVG & progress animations cleanly on replay
    const stage = curtain.querySelector('.intro-stage');
    if (stage) {
      const clone = stage.cloneNode(true);
      stage.parentNode.replaceChild(clone, stage);
    }

    introTimer = setTimeout(dismissIntro, 2750);
  }

  function dismissIntro() {
    const curtain = document.getElementById('intro-curtain');
    if (!curtain || curtain.classList.contains('is-leaving')) return;
    clearTimeout(introTimer);
    curtain.classList.add('is-leaving');
    document.body.classList.remove('intro-active');
    setTimeout(() => curtain.classList.add('is-gone'), 880);
  }

  /* ---------- Navigation / Tab Switching ---------- */
  function switchTab(tabId, pushHash = true) {
    const valid = ['home', 'mission', 'news', 'get-involved', 'people', 'albion', 'donate'];
    if (!valid.includes(tabId)) tabId = 'home';
    activeTab = tabId;

    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('is-active', panel.id === 'panel-' + tabId);
    });

    document.querySelectorAll('.nav-tab, .mobile-pill-tab').forEach((btn) => {
      const match = btn.dataset.tab === tabId;
      btn.classList.toggle('is-active', match);
      if (match && btn.classList.contains('mobile-pill-tab')) {
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });

    // Close mobile drawer if open
    const nav = document.getElementById('main-nav');
    if (nav) nav.classList.remove('is-open');

    if (pushHash) {
      try {
        history.replaceState(null, '', '#' + tabId);
      } catch (_) {}
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Countdown Timer ---------- */
  function updateCountdown() {
    const el = document.getElementById('election-countdown');
    if (!el || !siteData?.meta?.byElection?.dateISO) return;
    const target = new Date(siteData.meta.byElection.dateISO).getTime();
    const diff = target - Date.now();
    if (diff <= 0) {
      el.textContent = 'POLLING DAY · VOTE RIO HOLDER';
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `${d}D ${String(h).padStart(2, '0')}H ${String(m).padStart(2, '0')}M ${String(s).padStart(2, '0')}S TO POLLS`;
  }

  /* ---------- Rendering Functions ---------- */
  function renderAll() {
    renderChrome();
    renderHeroGallery();
    renderHomeHighlights();
    renderMission();
    renderNews();
    renderGetInvolved();
    renderPeople();
    renderAlbion();
    renderDonate();
    updateCountdown();
  }

  function renderChrome() {
    const m = siteData.meta;
    document.title = m.fullTitle || 'Restore Britain — Southend-on-Sea Branch';

    const brandBranch = document.getElementById('brand-branch-name');
    if (brandBranch) brandBranch.textContent = `${m.branchName} Branch`;

    const introCoords = document.getElementById('intro-coords-text');
    if (introCoords) introCoords.textContent = `${m.coordinates} · ${m.regionLabel}`;

    const introBranch = document.getElementById('intro-branch-label');
    if (introBranch) introBranch.textContent = `${m.branchName} Local Branch`;

    const bar = document.getElementById('election-bar');
    if (bar) {
      bar.style.display = m.byElection?.enabled ? '' : 'none';
      const tag = document.getElementById('election-bar-badge');
      const txt = document.getElementById('election-bar-text');
      if (tag) tag.textContent = m.byElection.badge || 'LIVE CAMPAIGN';
      if (txt) txt.textContent = `${m.byElection.title}: Back ${m.byElection.candidate} — ${m.byElection.dateLabel}`;
    }

    const imprintEl = document.getElementById('footer-imprint');
    if (imprintEl) imprintEl.textContent = m.imprint;
    const footerEmail = document.getElementById('footer-email');
    if (footerEmail) {
      footerEmail.textContent = m.email;
      footerEmail.href = 'mailto:' + m.email;
    }
    const footerJoin = document.getElementById('footer-join-link');
    if (footerJoin) footerJoin.href = m.nationalJoinUrl;
    const footerPapers = document.getElementById('footer-papers-link');
    if (footerPapers) footerPapers.href = m.nationalPapersUrl;
  }

  /* ----- Hero Cycling Photo Gallery + Interactive Branch Map ----- */
  function renderHeroGallery() {
    const slides = siteData.gallery || [];
    const slidesWrap = document.getElementById('hero-slides');
    const thumbsWrap = document.getElementById('gallery-thumbs');
    if (!slidesWrap || !thumbsWrap) return;

    if (galleryIdx >= slides.length) galleryIdx = 0;

    slidesWrap.innerHTML = slides
      .map(
        (s, i) => `
        <div class="hero-slide ${i === galleryIdx ? 'is-active' : ''}" data-idx="${i}">
          <img src="${esc(normalizeImageUrl(s.image))}" alt="${esc(s.headline)}" style="object-position:${esc(s.focal || 'center center')};" />
        </div>`
      )
      .join('');

    thumbsWrap.innerHTML = slides
      .map(
        (s, i) => `
        <button class="gallery-thumb ${i === galleryIdx ? 'is-active' : ''}" data-slide="${i}" aria-label="Show photo ${i + 1}: ${esc(s.headline)}">
          <img src="${esc(normalizeImageUrl(s.image))}" alt="" />
        </button>`
      )
      .join('');

    thumbsWrap.querySelectorAll('.gallery-thumb').forEach((btn) => {
      btn.addEventListener('click', () => {
        goToSlide(Number(btn.dataset.slide));
      });
    });

    updateSlideCopy();
    renderInteractiveMap();
    startGalleryCycle();
  }

  function updateSlideCopy() {
    const slides = siteData.gallery || [];
    const cur = slides[galleryIdx];
    if (!cur) return;

    const tag = document.getElementById('hero-slide-tag');
    const headline = document.getElementById('hero-headline');
    const caption = document.getElementById('hero-caption');
    const counter = document.getElementById('gallery-counter');

    if (tag) tag.textContent = cur.tag;
    if (headline) headline.textContent = cur.headline;
    if (caption) caption.textContent = cur.caption;
    if (counter) counter.textContent = `${String(galleryIdx + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;

    document.querySelectorAll('.hero-slide').forEach((el, i) => el.classList.toggle('is-active', i === galleryIdx));
    document.querySelectorAll('.gallery-thumb').forEach((el, i) => el.classList.toggle('is-active', i === galleryIdx));
  }

  function goToSlide(idx) {
    const len = (siteData.gallery || []).length;
    if (!len) return;
    galleryIdx = (idx + len) % len;
    updateSlideCopy();
    if (!galleryPaused) startGalleryCycle();
  }

  function startGalleryCycle() {
    clearInterval(galleryTimer);
    if (galleryPaused) return;
    galleryTimer = setInterval(() => {
      goToSlide(galleryIdx + 1);
    }, 5500);
  }

  function renderInteractiveMap() {
    const svg = document.getElementById('hero-branch-svg');
    const coords = document.getElementById('hero-map-coords');
    const readout = document.getElementById('hotspot-readout');
    if (!svg || !readout) return;

    if (coords) {
      coords.textContent = siteData.meta.coordinates;
    }

    const hotspots = siteData.mapHotspots || [];
    if (!hotspots.find((h) => h.id === selectedHotspotId) && hotspots.length) {
      selectedHotspotId = hotspots[0].id;
    }

    const pinsMarkup = hotspots
      .map((h) => {
        const isSel = h.id === selectedHotspotId;
        const shortName = h.shortLabel || h.label.split(' ')[0];
        const labelX = h.id === 'east' ? h.x - 18 : h.x;
        const labelY = h.id === 'central' ? h.y + 42 : h.y - 28;
        return `
          <g class="hotspot-group ${isSel ? 'is-selected' : ''}" data-hotspot="${esc(h.id)}" tabindex="0" role="button" aria-label="${esc(h.label)} — ${esc(h.sub)}" aria-pressed="${isSel ? 'true' : 'false'}">
            <title>${esc(h.label)} (${esc(h.sub)})</title>
            <circle class="hotspot-hit" cx="${h.x}" cy="${h.y}" r="50"></circle>
            ${isSel ? `<circle class="hotspot-pulse" cx="${h.x}" cy="${h.y}" r="24"></circle>` : ''}
            <circle class="hotspot-dot" cx="${h.x}" cy="${h.y}" r="${isSel ? 18 : 14}"></circle>
            <text class="hotspot-svg-label" x="${labelX}" y="${labelY}" text-anchor="middle">${esc(shortName)}</text>
          </g>`;
      })
      .join('');

    svg.innerHTML = `
      <defs>
        <filter id="mapDrop" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#020814" flood-opacity="0.55" />
        </filter>
      </defs>
      <path class="branch-map-fill" d="${BRANCH_MAP_PATH}" filter="url(#mapDrop)"></path>
      ${pinsMarkup}
    `;

    const selectHotspot = (id) => {
      selectedHotspotId = id;
      renderInteractiveMap();
    };

    svg.querySelectorAll('.hotspot-group').forEach((g) => {
      g.addEventListener('click', () => selectHotspot(g.dataset.hotspot));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectHotspot(g.dataset.hotspot);
        }
      });
    });

    const active = hotspots.find((h) => h.id === selectedHotspotId) || hotspots[0];
    if (active) {
      const mobileSummary = document.getElementById('hero-map-active-summary');
      if (mobileSummary) {
        mobileSummary.textContent = `${active.label} · ${active.sub}`;
      }
      const pillsMarkup = hotspots
        .map((h) => {
          const isSel = h.id === active.id;
          const shortName = h.shortLabel || h.label.split(' ')[0];
          return `<button type="button" class="hotspot-pill ${isSel ? 'is-selected' : ''}" data-select-hotspot="${esc(h.id)}" aria-pressed="${isSel ? 'true' : 'false'}" title="${esc(h.label)}">${esc(shortName)}</button>`;
        })
        .join('');

      const ctaName = active.label.length > 18 ? active.shortLabel || active.label : active.label;
      readout.innerHTML = `
        <div class="hotspot-pills" role="group" aria-label="Select Southend ward area">${pillsMarkup}</div>
        <div class="hotspot-readout__title">
          <span>${esc(active.label)}</span>
          <span class="hotspot-readout__sub">${esc(active.sub)}</span>
        </div>
        <p class="hotspot-readout__desc">${esc(active.detail)}</p>
        <button class="hotspot-readout__btn" type="button" data-jump-tab="${esc(active.targetTab)}">Explore ${esc(ctaName)} &rarr;</button>
      `;

      readout.querySelectorAll('[data-select-hotspot]').forEach((btn) => {
        btn.addEventListener('click', () => selectHotspot(btn.dataset.selectHotspot));
      });
      readout.querySelector('[data-jump-tab]')?.addEventListener('click', (e) => {
        switchTab(e.currentTarget.dataset.jumpTab);
      });
    }
  }

  function renderHomeHighlights() {
    const be = siteData.meta.byElection;
    const spot = document.getElementById('home-spotlight-wrap');
    if (spot && be) {
      const featuredNews = (siteData.news || []).find((n) => n.featured) || siteData.news[0];
      spot.innerHTML = `
        <div class="spotlight-photo">
          <img src="${esc(normalizeImageUrl(featuredNews?.image || 'assets/photos/DEX09026.jpg'))}" alt="${esc(be.title)}" />
          <div class="spotlight-photo__badge">
            <span class="rb-ribbon rb-ribbon--red" style="font-size:0.9rem;">POLLING DAY · 10 DEC 2026</span>
          </div>
        </div>
        <div>
          <div class="eyebrow">ACTIVE LOCAL CAMPAIGN</div>
          <h2 class="section-title">${esc(be.title)}: Back ${esc(be.candidate)}</h2>
          <p class="section-lead" style="margin-bottom:1.35rem;">${esc(be.summary)}</p>
          <p style="color:var(--slate-700);font-weight:600;margin:0 0 1.65rem;">${esc(be.dateLabel)}</p>
          <div style="display:flex;flex-wrap:wrap;gap:0.85rem;">
            <button class="btn btn--crimson" data-nav="news">Read Campaign Dispatches</button>
            <button class="btn btn--outline-navy" data-nav="people">Meet Rio Holder &amp; Team</button>
          </div>
        </div>
      `;
      spot.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.nav)));
    }
  }

  /* ----- Our Mission Tab ----- */
  function renderMission() {
    const ms = siteData.mission;
    const head = document.getElementById('mission-headline');
    const lead = document.getElementById('mission-lead');
    const pillarsEl = document.getElementById('mission-pillars-grid');
    const papersEl = document.getElementById('mission-papers-list');
    const papersBtn = document.getElementById('mission-papers-cta');

    if (head) head.textContent = ms.headline;
    if (lead) lead.textContent = ms.lead;
    if (papersBtn) papersBtn.href = siteData.meta.nationalPapersUrl;

    if (pillarsEl) {
      pillarsEl.innerHTML = (ms.pillars || [])
        .map(
          (p) => `
          <article class="pillar-card">
            <div class="pillar-card__cat">${esc(p.category)}</div>
            <h3 class="pillar-card__title">${esc(p.title)}</h3>
            <p class="pillar-card__summary">${esc(p.summary)}</p>
            <div class="pillar-card__paper">
              <span>${esc(p.paperTitle)}</span>
              <span style="color:var(--crimson-600);white-space:nowrap;">${esc(p.paperDate)}</span>
            </div>
          </article>`
        )
        .join('');
    }

    if (papersEl) {
      papersEl.innerHTML = (ms.featuredPapers || [])
        .map(
          (fp) => `
          <a class="paper-chip" href="${esc(siteData.meta.nationalPapersUrl)}" target="_blank" rel="noopener noreferrer">
            <div class="paper-chip__topic">${esc(fp.topic)} · ${esc(fp.date)}</div>
            <div class="paper-chip__title">${esc(fp.title)}</div>
          </a>`
        )
        .join('');
    }
  }

  /* ----- News Tab ----- */
  function renderNews() {
    const articles = siteData.news || [];
    const cats = ['All', ...Array.from(new Set(articles.map((a) => a.category)))];
    const filterBar = document.getElementById('news-filter-bar');
    const featWrap = document.getElementById('news-featured-wrap');
    const gridWrap = document.getElementById('news-grid');

    if (filterBar) {
      filterBar.innerHTML = cats
        .map(
          (c) =>
            `<button class="filter-btn ${c === activeNewsCategory ? 'is-active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`
        )
        .join('');
      filterBar.querySelectorAll('.filter-btn').forEach((b) =>
        b.addEventListener('click', () => {
          activeNewsCategory = b.dataset.cat;
          renderNews();
        })
      );
    }

    const filtered = activeNewsCategory === 'All' ? articles : articles.filter((a) => a.category === activeNewsCategory);
    const featured = filtered.find((a) => a.featured) || filtered[0];
    const rest = filtered.filter((a) => a !== featured);

    if (featWrap) {
      if (!featured) {
        featWrap.innerHTML = '<p>No articles in this category yet.</p>';
      } else {
        featWrap.innerHTML = `
          <article class="news-featured">
            <div class="news-featured__media">
              <img src="${esc(normalizeImageUrl(featured.image))}" alt="${esc(featured.title)}" />
            </div>
            <div class="news-featured__body">
              <div class="news-meta">
                <span class="news-cat-tag">${esc(featured.category)}</span>
                <span>${esc(featured.dateDisplay)}</span>
              </div>
              <h2 class="news-featured__title">${esc(featured.title)}</h2>
              <p class="section-lead" style="font-size:0.98rem;margin-bottom:1.5rem;">${esc(featured.excerpt)}</p>
              <div>
                <button class="btn btn--navy btn--sm" data-open-article="${esc(featured.id)}">Read Full Report &rarr;</button>
              </div>
            </div>
          </article>
        `;
      }
    }

    if (gridWrap) {
      gridWrap.innerHTML = rest
        .map(
          (a) => `
          <article class="news-card">
            <div class="news-card__img">
              <img src="${esc(normalizeImageUrl(a.image))}" alt="${esc(a.title)}" />
            </div>
            <div class="news-card__content">
              <div class="news-meta">
                <span class="news-cat-tag">${esc(a.category)}</span>
                <span>${esc(a.dateDisplay)}</span>
              </div>
              <h3 class="news-card__title">${esc(a.title)}</h3>
              <p class="news-card__excerpt">${esc(a.excerpt)}</p>
              <div>
                <button class="btn btn--outline-navy btn--sm" data-open-article="${esc(a.id)}">Read Article &rarr;</button>
              </div>
            </div>
          </article>`
        )
        .join('');
    }

    document.querySelectorAll('[data-open-article]').forEach((btn) => {
      btn.addEventListener('click', () => openArticleModal(btn.dataset.openArticle));
    });
  }

  function openArticleModal(id) {
    const article = (siteData.news || []).find((a) => a.id === id);
    const backdrop = document.getElementById('article-modal-backdrop');
    const content = document.getElementById('article-modal-content');
    if (!article || !backdrop || !content) return;

    const paragraphs = Array.isArray(article.body) ? article.body : String(article.body || '').split('\n\n');
    content.innerHTML = `
      <div class="article-modal__hero">
        <img src="${esc(normalizeImageUrl(article.image))}" alt="${esc(article.title)}" />
        <button class="modal-close-btn" id="close-article-modal" aria-label="Close article">&times;</button>
      </div>
      <div class="article-modal__body">
        <div class="news-meta">
          <span class="news-cat-tag">${esc(article.category)}</span>
          <span>${esc(article.dateDisplay)}</span>
          <span>· ${esc(article.author || 'Southend-on-Sea Branch')}</span>
        </div>
        <h2 class="section-title" style="font-size:clamp(1.5rem,2.8vw,2.15rem);margin-bottom:1.35rem;">${esc(article.title)}</h2>
        ${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
        <div style="margin-top:2rem;padding-top:1.25rem;border-top:1px solid var(--slate-200);display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:space-between;align-items:center;">
          <button class="btn btn--crimson btn--sm" id="modal-join-action">Volunteer for Action Days &rarr;</button>
          <button class="btn btn--outline-navy btn--sm" id="modal-close-bottom">Back to Newsroom</button>
        </div>
      </div>
    `;

    backdrop.classList.add('is-open');
    document.getElementById('close-article-modal')?.addEventListener('click', closeArticleModal);
    document.getElementById('modal-close-bottom')?.addEventListener('click', closeArticleModal);
    document.getElementById('modal-join-action')?.addEventListener('click', () => {
      closeArticleModal();
      switchTab('get-involved');
    });
  }

  function closeArticleModal() {
    document.getElementById('article-modal-backdrop')?.classList.remove('is-open');
  }

  /* ----- Get Involved Tab ----- */
  function renderGetInvolved() {
    const gi = siteData.getInvolved;
    const head = document.getElementById('involved-headline');
    const lead = document.getElementById('involved-lead');
    const stepsWrap = document.getElementById('involved-steps');
    const eventsWrap = document.getElementById('involved-events');
    const joinBtn = document.getElementById('involved-join-cta');

    if (head) head.textContent = gi.headline;
    if (lead) lead.textContent = gi.lead;
    if (joinBtn) joinBtn.href = siteData.meta.nationalJoinUrl;

    if (stepsWrap) {
      stepsWrap.innerHTML = (gi.steps || [])
        .map(
          (st) => `
          <div class="step-card">
            <div class="step-card__num">${esc(st.number)}</div>
            <div class="step-card__badge">${esc(st.highlight)}</div>
            <h3 class="step-card__title">${esc(st.title)}</h3>
            <p class="step-card__desc">${esc(st.description)}</p>
          </div>`
        )
        .join('');
    }

    if (eventsWrap) {
      eventsWrap.innerHTML = (gi.upcomingEvents || [])
        .map(
          (ev) => `
          <div class="event-item">
            <div class="event-item__top">
              <span class="event-item__date">${esc(ev.date)} · ${esc(ev.time)}</span>
              <span class="event-item__type">${esc(ev.type)}</span>
            </div>
            <h4 class="event-item__title">${esc(ev.title)}</h4>
            <p class="event-item__loc">${esc(ev.location)}</p>
          </div>`
        )
        .join('');
    }
  }

  /* ----- People Tab ----- */
  function renderPeople() {
    const grid = document.getElementById('people-grid');
    if (!grid) return;

    grid.innerHTML = (siteData.people || [])
      .map(
        (p) => `
        <article class="person-card">
          <div class="person-card__poster navy-textured union-backdrop">
            <div class="person-card__poster-top">
              <span>RESTORE BRITAIN · ${esc(siteData.meta.branchName)}</span>
              <span>PROFILE</span>
            </div>
            <div class="person-card__portrait-wrap">
              <img src="${esc(normalizeImageUrl(p.photo))}" alt="${esc(p.name)} — ${esc(p.role)}" />
            </div>
            <div class="person-card__ribbons">
              <span class="rb-ribbon rb-ribbon--red person-card__role-ribbon">${esc(p.role)}</span>
              <span class="rb-ribbon rb-ribbon--white person-card__name-ribbon">${esc(p.name)}</span>
            </div>
          </div>
          <div class="person-card__body">
            <div class="person-card__ward">${esc(p.ward)}</div>
            <blockquote class="person-card__quote">“${esc(p.quote)}”</blockquote>
            <p class="person-card__bio">${esc(p.bio)}</p>
            <div class="focus-tags">
              ${(p.focusAreas || []).map((f) => `<span class="focus-tag">${esc(f)}</span>`).join('')}
            </div>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
              <button class="btn btn--navy btn--sm" data-people-action="get-involved">Campaign With ${esc(p.name.split(' ')[0])} &rarr;</button>
              <a class="btn btn--outline-navy btn--sm" href="${esc(siteData.meta.nationalJoinUrl)}" target="_blank" rel="noopener noreferrer">Join Restore Britain</a>
            </div>
          </div>
        </article>`
      )
      .join('');

    grid.querySelectorAll('[data-people-action]').forEach((b) =>
      b.addEventListener('click', () => switchTab(b.dataset.peopleAction))
    );
  }

  /* ----- Albion Initiative Tab ----- */
  function renderAlbion() {
    const al = siteData.albion;
    const head = document.getElementById('albion-headline');
    const lead = document.getElementById('albion-lead');
    const pillars = document.getElementById('albion-pillars');
    const filterBar = document.getElementById('albion-filter-bar');
    const projects = document.getElementById('albion-projects');

    if (head) head.textContent = al.headline;
    if (lead) lead.textContent = al.lead;

    if (pillars) {
      pillars.innerHTML = (al.pillars || [])
        .map(
          (pl) => `
          <div class="albion-pillar">
            <h3>${esc(pl.title)}</h3>
            <p>${esc(pl.desc)}</p>
          </div>`
        )
        .join('');
    }

    const types = ['All', ...Array.from(new Set((al.projects || []).map((p) => p.type)))];
    if (filterBar) {
      filterBar.innerHTML = types
        .map(
          (t) =>
            `<button class="filter-btn ${t === activeAlbionFilter ? 'is-active' : ''}" data-atype="${esc(t)}">${esc(t)}</button>`
        )
        .join('');
      filterBar.querySelectorAll('.filter-btn').forEach((b) =>
        b.addEventListener('click', () => {
          activeAlbionFilter = b.dataset.atype;
          renderAlbion();
        })
      );
    }

    const filtered = activeAlbionFilter === 'All' ? al.projects : al.projects.filter((p) => p.type === activeAlbionFilter);
    if (projects) {
      projects.innerHTML = (filtered || [])
        .map(
          (pr) => `
          <article class="project-card">
            <div class="project-card__media">
              <img src="${esc(normalizeImageUrl(pr.image))}" alt="${esc(pr.title)}" />
            </div>
            <div class="project-card__body">
              <div class="project-badges">
                <span class="badge-type">${esc(pr.type)}</span>
                <span class="badge-status">${esc(pr.status)}</span>
              </div>
              <h3 class="project-card__title">${esc(pr.title)}</h3>
              <p class="project-card__summary">${esc(pr.summary)}</p>
              <div class="project-card__metric">${esc(pr.metrics)}</div>
            </div>
          </article>`
        )
        .join('');
    }

    updateAlbionCalc();
  }

  function updateAlbionCalc() {
    const vols = Number(document.getElementById('calc-volunteers')?.value || 10);
    const hours = Number(document.getElementById('calc-hours')?.value || 3);
    const sessions = Number(document.getElementById('calc-sessions')?.value || 4);

    const vOut = document.getElementById('calc-volunteers-val');
    const hOut = document.getElementById('calc-hours-val');
    const sOut = document.getElementById('calc-sessions-val');
    if (vOut) vOut.textContent = `${vols} volunteers`;
    if (hOut) hOut.textContent = `${hours} hrs/session`;
    if (sOut) sOut.textContent = `${sessions} action days`;

    // Conservative street delivery benchmark: ~65 doors per volunteer-hour
    const doors = vols * hours * sessions * 65;
    const convos = Math.round(vols * hours * sessions * 9);
    // Average Southend ward ~4,200 households
    const wardPct = Math.min(100, Math.round((doors / 4200) * 100));

    const dEl = document.getElementById('calc-out-doors');
    const cEl = document.getElementById('calc-out-convos');
    const wEl = document.getElementById('calc-out-coverage');
    if (dEl) dEl.textContent = doors.toLocaleString();
    if (cEl) cEl.textContent = convos.toLocaleString();
    if (wEl) wEl.textContent = wardPct + '%';
  }

  /* ----- Donate Placeholder Tab ----- */
  function renderDonate() {
    const dn = siteData.donate;
    const badge = document.getElementById('donate-status-badge');
    const head = document.getElementById('donate-headline');
    const lead = document.getElementById('donate-lead');
    const tiers = document.getElementById('donate-tiers');
    const comp = document.getElementById('donate-compliance');
    const natBtn = document.getElementById('donate-national-cta');

    if (badge) badge.textContent = dn.statusBadge;
    if (head) head.textContent = dn.headline;
    if (lead) lead.textContent = dn.lead;
    if (comp) comp.textContent = dn.complianceNote;
    if (natBtn) natBtn.href = siteData.meta.nationalJoinUrl;

    if (tiers) {
      tiers.innerHTML = (dn.tiers || [])
        .map(
          (t, i) => `
          <button type="button" class="tier-card ${i === selectedTierIndex ? 'is-selected' : ''}" data-tier="${i}">
            <div class="tier-card__amount">${esc(t.amount)}</div>
            <div class="tier-card__label">${esc(t.label)}</div>
            <p class="tier-card__desc">${esc(t.desc)}</p>
          </button>`
        )
        .join('');

      tiers.querySelectorAll('.tier-card').forEach((btn) =>
        btn.addEventListener('click', () => {
          selectedTierIndex = Number(btn.dataset.tier);
          renderDonate();
          const chosen = dn.tiers[selectedTierIndex];
          const amtInput = document.getElementById('pledge-amount');
          if (amtInput && chosen) amtInput.value = chosen.amount;
        })
      );
    }
  }

  /* ==========================================================================
     BUILT-IN BRANCH CMS / CONTENT STUDIO
     ========================================================================== */
  function openCms() {
    document.getElementById('cms-overlay')?.classList.add('is-open');
    renderCmsBody();
  }

  function closeCms() {
    document.getElementById('cms-overlay')?.classList.remove('is-open');
  }

  async function renderCmsBody() {
    const body = document.getElementById('cms-body');
    if (!body) return;

    document.querySelectorAll('.cms-tab-btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.cmsTab === activeCmsTab);
    });

    if (activeCmsTab === 'settings') {
      const m = siteData.meta;
      body.innerHTML = `
        <div class="cms-card">
          <h3 style="margin:0 0 1rem;font-family:var(--font-display);color:var(--navy-900);">Branch Identity &amp; External Links</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Branch Name</label>
              <input class="form-input" id="cms-branchName" value="${esc(m.branchName)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Branch Email</label>
              <input class="form-input" id="cms-email" value="${esc(m.email)}" />
            </div>
            <div class="form-group form-group--full">
              <label class="form-label">Main Policy Papers URL</label>
              <input class="form-input" id="cms-papersUrl" value="${esc(m.nationalPapersUrl)}" />
            </div>
            <div class="form-group form-group--full">
              <label class="form-label">National Join Us URL</label>
              <input class="form-input" id="cms-joinUrl" value="${esc(m.nationalJoinUrl)}" />
            </div>
            <div class="form-group form-group--full">
              <label class="form-label">Footer Imprint Notice</label>
              <textarea class="form-textarea" rows="2" id="cms-imprint">${esc(m.imprint)}</textarea>
            </div>
          </div>
        </div>
        <div class="cms-card">
          <h3 style="margin:0 0 1rem;font-family:var(--font-display);color:var(--navy-900);">By-Election Banner &amp; Countdown</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Campaign Title</label>
              <input class="form-input" id="cms-beTitle" value="${esc(m.byElection.title)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Candidate Name</label>
              <input class="form-input" id="cms-beCandidate" value="${esc(m.byElection.candidate)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Polling Date Label</label>
              <input class="form-input" id="cms-beDateLabel" value="${esc(m.byElection.dateLabel)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Countdown ISO Timestamp</label>
              <input class="form-input" id="cms-beDateISO" value="${esc(m.byElection.dateISO)}" />
            </div>
            <div class="form-group form-group--full">
              <label class="form-label">Campaign Summary</label>
              <textarea class="form-textarea" rows="2" id="cms-beSummary">${esc(m.byElection.summary)}</textarea>
            </div>
          </div>
          <button class="btn btn--crimson btn--sm" id="cms-save-settings">Apply &amp; Save Settings</button>
        </div>
      `;
      document.getElementById('cms-save-settings')?.addEventListener('click', async () => {
        siteData.meta.branchName = document.getElementById('cms-branchName').value.trim();
        siteData.meta.fullTitle = `Restore Britain — ${siteData.meta.branchName} Branch`;
        siteData.meta.email = document.getElementById('cms-email').value.trim();
        siteData.meta.nationalPapersUrl = document.getElementById('cms-papersUrl').value.trim();
        siteData.meta.nationalJoinUrl = document.getElementById('cms-joinUrl').value.trim();
        siteData.meta.imprint = document.getElementById('cms-imprint').value.trim();
        siteData.meta.byElection.title = document.getElementById('cms-beTitle').value.trim();
        siteData.meta.byElection.candidate = document.getElementById('cms-beCandidate').value.trim();
        siteData.meta.byElection.dateLabel = document.getElementById('cms-beDateLabel').value.trim();
        siteData.meta.byElection.dateISO = document.getElementById('cms-beDateISO').value.trim();
        siteData.meta.byElection.summary = document.getElementById('cms-beSummary').value.trim();
        await persistSiteData();
        renderAll();
      });
    } else if (activeCmsTab === 'gallery') {
      const libraryOptions = getPhotoLibrary()
        .map((p) => `<option value="${esc(p.path)}">${esc(p.label)}</option>`)
        .join('');
      body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <p style="margin:0;font-size:0.88rem;color:var(--slate-500);">Edit splash gallery slides, swap photos from the branch library, upload a new file, or paste a Google Drive share link.</p>
          <button class="btn btn--crimson btn--sm" id="cms-add-slide">+ Add Slide</button>
        </div>
        ${siteData.gallery
          .map(
            (s, i) => `
            <div class="cms-card">
              <div class="cms-item-header">
                <strong>Slide #${i + 1}: ${esc(s.headline)}</strong>
                <button class="btn btn--outline-navy btn--sm" data-del-slide="${i}">Delete</button>
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Ribbon Tag</label>
                  <input class="form-input" data-slide-field="tag" data-idx="${i}" value="${esc(s.tag)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Headline</label>
                  <input class="form-input" data-slide-field="headline" data-idx="${i}" value="${esc(s.headline)}" />
                </div>
                <div class="form-group form-group--full">
                  <label class="form-label">Caption</label>
                  <input class="form-input" data-slide-field="caption" data-idx="${i}" value="${esc(s.caption)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Image Path / Google Drive Link</label>
                  <input class="form-input" data-slide-field="image" data-idx="${i}" value="${esc(s.image)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Pick From Branch Library or Upload</label>
                  <div style="display:flex;gap:0.4rem;">
                    <select class="form-select" style="flex:1;" data-slide-pick="${i}">
                      <option value="">Choose photo...</option>
                      ${libraryOptions}
                    </select>
                    <label class="btn btn--outline-navy btn--sm" style="margin:0;">
                      Upload
                      <input type="file" accept="image/*" style="display:none;" data-slide-upload="${i}" />
                    </label>
                  </div>
                </div>
              </div>
            </div>`
          )
          .join('')}
        <button class="btn btn--crimson btn--sm" id="cms-save-gallery">Apply &amp; Save Gallery</button>
      `;

      document.getElementById('cms-add-slide')?.addEventListener('click', () => {
        siteData.gallery.push({
          id: 'slide-' + Date.now(),
          image: 'assets/photos/DSC08707.jpg',
          tag: 'SOUTHEND-ON-SEA BRANCH',
          headline: 'NEW BRANCH PHOTO HEADLINE',
          caption: 'Add a short description of this photo.',
          focal: 'center center'
        });
        renderCmsBody();
      });

      body.querySelectorAll('[data-del-slide]').forEach((b) =>
        b.addEventListener('click', () => {
          siteData.gallery.splice(Number(b.dataset.delSlide), 1);
          renderCmsBody();
        })
      );

      body.querySelectorAll('[data-slide-pick]').forEach((sel) =>
        sel.addEventListener('change', () => {
          if (!sel.value) return;
          const idx = Number(sel.dataset.slidePick);
          siteData.gallery[idx].image = sel.value;
          const inp = body.querySelector(`[data-slide-field="image"][data-idx="${idx}"]`);
          if (inp) inp.value = sel.value;
        })
      );

      body.querySelectorAll('[data-slide-upload]').forEach((inp) =>
        inp.addEventListener('change', (e) => handleImageUpload(e.target.files[0], (url) => {
          const idx = Number(inp.dataset.slideUpload);
          siteData.gallery[idx].image = url;
          const field = body.querySelector(`[data-slide-field="image"][data-idx="${idx}"]`);
          if (field) field.value = url;
          showToast('Photo loaded — click Apply & Save Gallery.');
        }))
      );

      document.getElementById('cms-save-gallery')?.addEventListener('click', async () => {
        body.querySelectorAll('[data-slide-field]').forEach((el) => {
          const idx = Number(el.dataset.idx);
          if (siteData.gallery[idx]) siteData.gallery[idx][el.dataset.slideField] = el.value.trim();
        });
        await persistSiteData();
        renderAll();
      });
    } else if (activeCmsTab === 'news') {
      body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <p style="margin:0;font-size:0.88rem;color:var(--slate-500);">Publish new by-election reports, Action Day write-ups, or branch announcements.</p>
          <button class="btn btn--crimson btn--sm" id="cms-add-news">+ New Article</button>
        </div>
        ${siteData.news
          .map(
            (a, i) => `
            <div class="cms-card">
              <div class="cms-item-header">
                <strong>${esc(a.title)}</strong>
                <button class="btn btn--outline-navy btn--sm" data-del-news="${i}">Delete</button>
              </div>
              <div class="form-grid">
                <div class="form-group form-group--full">
                  <label class="form-label">Headline</label>
                  <input class="form-input" data-news-field="title" data-idx="${i}" value="${esc(a.title)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <input class="form-input" data-news-field="category" data-idx="${i}" value="${esc(a.category)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Display Date</label>
                  <input class="form-input" data-news-field="dateDisplay" data-idx="${i}" value="${esc(a.dateDisplay)}" />
                </div>
                <div class="form-group form-group--full">
                  <label class="form-label">Photo Path / URL</label>
                  <input class="form-input" data-news-field="image" data-idx="${i}" value="${esc(a.image)}" />
                </div>
                <div class="form-group form-group--full">
                  <label class="form-label">Short Excerpt</label>
                  <textarea class="form-textarea" rows="2" data-news-field="excerpt" data-idx="${i}">${esc(a.excerpt)}</textarea>
                </div>
                <div class="form-group form-group--full">
                  <label class="form-label">Full Article Body (separate paragraphs with blank line)</label>
                  <textarea class="form-textarea" rows="4" data-news-body="${i}">${esc(Array.isArray(a.body) ? a.body.join('\n\n') : a.body)}</textarea>
                </div>
              </div>
            </div>`
          )
          .join('')}
        <button class="btn btn--crimson btn--sm" id="cms-save-news">Publish News Updates</button>
      `;

      document.getElementById('cms-add-news')?.addEventListener('click', () => {
        siteData.news.unshift({
          id: 'article-' + Date.now(),
          featured: false,
          category: 'Branch Updates',
          date: new Date().toISOString().slice(0, 10),
          dateDisplay: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
          title: 'New Southend Branch Announcement',
          author: 'Southend-on-Sea Branch',
          image: 'assets/photos/DSC08707.jpg',
          excerpt: 'Write a concise summary that appears on the news card.',
          body: ['Write the full article text here.']
        });
        renderCmsBody();
      });

      body.querySelectorAll('[data-del-news]').forEach((b) =>
        b.addEventListener('click', () => {
          siteData.news.splice(Number(b.dataset.delNews), 1);
          renderCmsBody();
        })
      );

      document.getElementById('cms-save-news')?.addEventListener('click', async () => {
        body.querySelectorAll('[data-news-field]').forEach((el) => {
          const idx = Number(el.dataset.idx);
          if (siteData.news[idx]) siteData.news[idx][el.dataset.newsField] = el.value.trim();
        });
        body.querySelectorAll('[data-news-body]').forEach((el) => {
          const idx = Number(el.dataset.newsBody);
          if (siteData.news[idx]) {
            siteData.news[idx].body = el.value
              .split(/\n\s*\n/)
              .map((p) => p.trim())
              .filter(Boolean);
          }
        });
        await persistSiteData();
        renderAll();
      });
    } else if (activeCmsTab === 'people') {
      body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <p style="margin:0;font-size:0.88rem;color:var(--slate-500);">Edit Dillon Bliss, Rio Holder, or add additional ward captains and candidates.</p>
          <button class="btn btn--crimson btn--sm" id="cms-add-person">+ Add Profile</button>
        </div>
        ${siteData.people
          .map(
            (p, i) => `
            <div class="cms-card">
              <div class="cms-item-header">
                <strong>${esc(p.name)} — ${esc(p.role)}</strong>
                <button class="btn btn--outline-navy btn--sm" data-del-person="${i}">Delete</button>
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Name</label>
                  <input class="form-input" data-person-field="name" data-idx="${i}" value="${esc(p.name)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Role / Title</label>
                  <input class="form-input" data-person-field="role" data-idx="${i}" value="${esc(p.role)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Ward / Area Label</label>
                  <input class="form-input" data-person-field="ward" data-idx="${i}" value="${esc(p.ward)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Portrait Image Path / URL</label>
                  <input class="form-input" data-person-field="photo" data-idx="${i}" value="${esc(p.photo)}" />
                </div>
                <div class="form-group form-group--full">
                  <label class="form-label">Pull Quote</label>
                  <textarea class="form-textarea" rows="2" data-person-field="quote" data-idx="${i}">${esc(p.quote)}</textarea>
                </div>
                <div class="form-group form-group--full">
                  <label class="form-label">Biography</label>
                  <textarea class="form-textarea" rows="3" data-person-field="bio" data-idx="${i}">${esc(p.bio)}</textarea>
                </div>
              </div>
            </div>`
          )
          .join('')}
        <button class="btn btn--crimson btn--sm" id="cms-save-people">Save People Profiles</button>
      `;

      document.getElementById('cms-add-person')?.addEventListener('click', () => {
        siteData.people.push({
          id: 'person-' + Date.now(),
          name: 'New Officer Name',
          role: 'Ward Captain',
          ward: 'Southend-on-Sea',
          photo: 'assets/photos/DSC08575.jpg',
          quote: 'Committed to putting Southend residents first.',
          bio: 'Add a short biography for this branch officer or candidate.',
          focusAreas: ['Local Outreach', 'Doorstep Campaigning']
        });
        renderCmsBody();
      });

      body.querySelectorAll('[data-del-person]').forEach((b) =>
        b.addEventListener('click', () => {
          siteData.people.splice(Number(b.dataset.delPerson), 1);
          renderCmsBody();
        })
      );

      document.getElementById('cms-save-people')?.addEventListener('click', async () => {
        body.querySelectorAll('[data-person-field]').forEach((el) => {
          const idx = Number(el.dataset.idx);
          if (siteData.people[idx]) siteData.people[idx][el.dataset.personField] = el.value.trim();
        });
        await persistSiteData();
        renderAll();
      });
    } else if (activeCmsTab === 'albion') {
      body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <p style="margin:0;font-size:0.88rem;color:var(--slate-500);">Manage Albion Initiative think-tank research briefs and campaign tools.</p>
          <button class="btn btn--crimson btn--sm" id="cms-add-proj">+ Add Project</button>
        </div>
        ${siteData.albion.projects
          .map(
            (pr, i) => `
            <div class="cms-card">
              <div class="cms-item-header">
                <strong>${esc(pr.title)}</strong>
                <button class="btn btn--outline-navy btn--sm" data-del-proj="${i}">Delete</button>
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Type</label>
                  <input class="form-input" data-proj-field="type" data-idx="${i}" value="${esc(pr.type)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Status Badge</label>
                  <input class="form-input" data-proj-field="status" data-idx="${i}" value="${esc(pr.status)}" />
                </div>
                <div class="form-group form-group--full">
                  <label class="form-label">Title</label>
                  <input class="form-input" data-proj-field="title" data-idx="${i}" value="${esc(pr.title)}" />
                </div>
                <div class="form-group form-group--full">
                  <label class="form-label">Summary</label>
                  <textarea class="form-textarea" rows="2" data-proj-field="summary" data-idx="${i}">${esc(pr.summary)}</textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">Status / Metrics Note</label>
                  <input class="form-input" data-proj-field="metrics" data-idx="${i}" value="${esc(pr.metrics)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Image Path</label>
                  <input class="form-input" data-proj-field="image" data-idx="${i}" value="${esc(pr.image)}" />
                </div>
              </div>
            </div>`
          )
          .join('')}
        <button class="btn btn--crimson btn--sm" id="cms-save-albion">Save Albion Projects</button>
      `;

      document.getElementById('cms-add-proj')?.addEventListener('click', () => {
        siteData.albion.projects.push({
          id: 'alb-' + Date.now(),
          type: 'Research Brief',
          status: 'Drafting',
          title: 'New Albion Initiative Brief',
          summary: 'Describe the research objective or campaign tool.',
          image: 'assets/photos/DEX09010.jpg',
          metrics: 'Led by Southend-on-Sea Albion Initiative'
        });
        renderCmsBody();
      });

      body.querySelectorAll('[data-del-proj]').forEach((b) =>
        b.addEventListener('click', () => {
          siteData.albion.projects.splice(Number(b.dataset.delProj), 1);
          renderCmsBody();
        })
      );

      document.getElementById('cms-save-albion')?.addEventListener('click', async () => {
        body.querySelectorAll('[data-proj-field]').forEach((el) => {
          const idx = Number(el.dataset.idx);
          if (siteData.albion.projects[idx]) siteData.albion.projects[idx][el.dataset.projField] = el.value.trim();
        });
        await persistSiteData();
        renderAll();
      });
    } else if (activeCmsTab === 'events') {
      const subs = await loadAllSubmissions();
      body.innerHTML = `
        <div class="cms-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.85rem;">
            <h3 style="margin:0;font-family:var(--font-display);color:var(--navy-900);">Upcoming Branch Meetings &amp; Action Days</h3>
            <button class="btn btn--crimson btn--sm" id="cms-add-event">+ Add Event</button>
          </div>
          ${siteData.getInvolved.upcomingEvents
            .map(
              (ev, i) => `
              <div style="padding:0.9rem;border:1px solid var(--slate-200);border-radius:6px;margin-bottom:0.75rem;background:var(--alabaster);">
                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label">Date</label>
                    <input class="form-input" data-ev-field="date" data-idx="${i}" value="${esc(ev.date)}" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Time</label>
                    <input class="form-input" data-ev-field="time" data-idx="${i}" value="${esc(ev.time)}" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Title</label>
                    <input class="form-input" data-ev-field="title" data-idx="${i}" value="${esc(ev.title)}" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Type</label>
                    <input class="form-input" data-ev-field="type" data-idx="${i}" value="${esc(ev.type)}" />
                  </div>
                  <div class="form-group form-group--full">
                    <label class="form-label">Location Note</label>
                    <input class="form-input" data-ev-field="location" data-idx="${i}" value="${esc(ev.location)}" />
                  </div>
                </div>
                <button class="btn btn--outline-navy btn--sm" data-del-ev="${i}">Remove Event</button>
              </div>`
            )
            .join('')}
          <button class="btn btn--crimson btn--sm" id="cms-save-events">Save Schedule</button>
        </div>

        <div class="cms-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.85rem;">
            <h3 style="margin:0;font-family:var(--font-display);color:var(--navy-900);">Local Sign-Ups &amp; Pledges (${subs.length})</h3>
            <button class="btn btn--navy btn--sm" id="cms-export-subs">Export CSV</button>
          </div>
          ${
            subs.length === 0
              ? '<p style="margin:0;color:var(--slate-500);font-size:0.88rem;">No submissions recorded yet. Test the Get Involved or Donate Pledge form to see entries appear here immediately.</p>'
              : subs
                  .map(
                    (s) => `
                  <div style="padding:0.65rem 0;border-bottom:1px solid var(--stone);font-size:0.86rem;">
                    <strong>${esc(s.name)}</strong> (${esc(s.email)}) · <span style="color:var(--crimson-600);font-weight:700;">${esc(s.kind || 'Volunteer')}</span>
                    <div style="color:var(--slate-500);">${esc(s.ward || '')} ${s.interests ? '· ' + esc(s.interests.join(', ')) : ''} ${s.amount ? '· Pledge ' + esc(s.amount) : ''}</div>
                  </div>`
                  )
                  .join('')
          }
        </div>
      `;

      document.getElementById('cms-add-event')?.addEventListener('click', () => {
        siteData.getInvolved.upcomingEvents.push({
          id: 'ev-' + Date.now(),
          date: 'Sat 12 Dec 2026',
          time: '11:00 AM – 2:00 PM',
          title: 'Southend Ward Action Day',
          location: 'Confirmed via member email',
          type: 'Action Day'
        });
        renderCmsBody();
      });

      body.querySelectorAll('[data-del-ev]').forEach((b) =>
        b.addEventListener('click', () => {
          siteData.getInvolved.upcomingEvents.splice(Number(b.dataset.delEv), 1);
          renderCmsBody();
        })
      );

      document.getElementById('cms-save-events')?.addEventListener('click', async () => {
        body.querySelectorAll('[data-ev-field]').forEach((el) => {
          const idx = Number(el.dataset.idx);
          if (siteData.getInvolved.upcomingEvents[idx]) {
            siteData.getInvolved.upcomingEvents[idx][el.dataset.evField] = el.value.trim();
          }
        });
        await persistSiteData();
        renderAll();
      });

      document.getElementById('cms-export-subs')?.addEventListener('click', () => {
        const headers = ['Date', 'Kind', 'Name', 'Email', 'Ward', 'Interests', 'PledgeAmount'];
        const rows = subs.map((s) =>
          [s.createdAt, s.kind || 'Volunteer', s.name, s.email, s.ward || '', (s.interests || []).join('; '), s.amount || '']
            .map((v) => '"' + String(v || '').replace(/"/g, '""') + '"')
            .join(',')
        );
        downloadFile('southend-branch-signups.csv', [headers.join(','), ...rows].join('\n'), 'text/csv');
      });
    } else if (activeCmsTab === 'architecture') {
      body.innerHTML = `
        <div class="cms-card">
          <h3 style="margin:0 0 0.65rem;font-family:var(--font-display);color:var(--navy-900);">Modular Site Architecture &amp; Publishing</h3>
          <p style="font-size:0.9rem;color:var(--slate-700);margin:0 0 1rem;">
            Every piece of text, photo, article, candidate profile, Albion Initiative project, and event on this website lives in a single structured JSON file (<code>data/site-content.json</code>) alongside modular <code>index.html</code>, <code>styles.css</code>, <code>app.js</code>, and <code>assets/photos/</code> files:
          </p>
          <div style="display:grid;gap:0.85rem;">
            <div style="background:var(--alabaster);padding:0.9rem 1rem;border-left:4px solid var(--navy-900);">
              <strong>Stage 1 · Modular GitHub Pages Publishing (Active Live)</strong><br/>
              <span style="font-size:0.85rem;color:var(--slate-500);">Edit anything live in this CMS drawer, click <em>Export JSON</em> to download <code>site-content.json</code>, and replace <code>data/site-content.json</code> in your GitHub repository to update the live site cleanly.</span>
            </div>
            <div style="background:var(--alabaster);padding:0.9rem 1rem;border-left:4px solid var(--crimson-600);">
              <strong>Stage 2 · Portable Single-File Export (<code>Download index.html</code>)</strong><br/>
              <span style="font-size:0.85rem;color:var(--slate-500);">Need a self-contained offline copy for branch meetings or quick drag-and-drop sharing? Click <em>Download Updated index.html</em> to bundle CSS, JS, live edits, and photography into one portable HTML file.</span>
            </div>
            <div style="background:var(--alabaster);padding:0.9rem 1rem;border-left:4px solid #166534);">
              <strong>Stage 3 · Optional Node.js Backend &amp; Production Webhooks</strong><br/>
              <span style="font-size:0.85rem;color:var(--slate-500);">Connect an optional <code>/api/content</code> Node server or wire the Get Involved and Donate forms to Mailchimp, Brevo, NationBuilder, or Stripe without rewriting the frontend.</span>
            </div>
          </div>
        </div>
        <div class="cms-card">
          <h3 style="margin:0 0 0.75rem;font-family:var(--font-display);color:var(--navy-900);">Download &amp; Publish Site</h3>
          <div style="display:flex;flex-wrap:wrap;gap:0.65rem;">
            <button class="btn btn--crimson btn--sm" id="cms-dl-html">Download Updated index.html</button>
            <button class="btn btn--navy btn--sm" id="cms-dl-json">Download site-content.json</button>
            <label class="btn btn--outline-navy btn--sm" style="margin:0;">
              Import site-content.json
              <input type="file" accept=".json" id="cms-import-json" style="display:none;" />
            </label>
            <button class="btn btn--outline-navy btn--sm" id="cms-reset-default">Reset to Default</button>
          </div>
        </div>
      `;

      document.getElementById('cms-dl-html')?.addEventListener('click', exportStandaloneHtml);
      document.getElementById('cms-dl-json')?.addEventListener('click', () => {
        downloadFile('site-content.json', JSON.stringify(siteData, null, 2), 'application/json');
        showToast('Downloaded site-content.json — commit to data/site-content.json to publish!');
      });

      document.getElementById('cms-import-json')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const parsed = JSON.parse(reader.result);
            if (!parsed.meta || !parsed.gallery) throw new Error('Invalid schema');
            siteData = parsed;
            await persistSiteData();
            renderAll();
            renderCmsBody();
            showToast('Imported site-content.json successfully!');
          } catch (_) {
            showToast('Error: File is not a valid site-content.json');
          }
        };
        reader.readAsText(file);
      });

      document.getElementById('cms-reset-default')?.addEventListener('click', async () => {
        if (!confirm('Reset all local browser edits back to the live Southend branch content?')) return;
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (_) {}
        const fresh = await loadCanonicalDefaultData();
        if (fresh) {
          siteData = fresh;
        }
        if (serverAvailable && siteData) {
          await persistSiteData(true);
        }
        updateBackendBadge();
        renderAll();
        renderCmsBody();
        showToast('Reset to live branch defaults.');
      });
    }
  }

  async function handleImageUpload(file, callback) {
    if (!file) return;
    if (serverAvailable) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, dataUrl: reader.result })
          });
          if (res.ok) {
            const out = await res.json();
            callback(out.url);
            return;
          }
        } catch (_) {}
        callback(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => callback(reader.result);
      reader.readAsDataURL(file);
    }
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function collectLocalPhotoPaths(data) {
    const paths = new Set([
      'assets/photos/restore-britain-logo.png',
      'assets/photos/albion-rescom-banner.jpg'
    ]);
    getPhotoLibrary().forEach((item) => {
      if (item.path && item.path.startsWith('assets/')) paths.add(item.path);
    });
    const scan = (val) => {
      if (!val) return;
      if (typeof val === 'string') {
        const t = val.trim();
        if (t.startsWith('assets/photos/')) paths.add(t);
      } else if (Array.isArray(val)) {
        val.forEach(scan);
      } else if (typeof val === 'object') {
        Object.values(val).forEach(scan);
      }
    };
    scan(data);
    return Array.from(paths);
  }

  async function exportStandaloneHtml() {
    showToast('Packaging portable index.html with live edits & photos...');

    const clone = document.documentElement.cloneNode(true);
    const bodyEl = clone.querySelector('body');
    if (bodyEl) bodyEl.classList.add('intro-active');

    const curtain = clone.querySelector('#intro-curtain');
    if (curtain) {
      curtain.classList.remove('is-leaving', 'is-gone');
      curtain.removeAttribute('style');
    }

    clone.querySelector('#cms-overlay')?.classList.remove('is-open');
    clone.querySelector('#article-modal-backdrop')?.classList.remove('is-open');
    clone.querySelector('#toast')?.classList.remove('is-visible');
    const cmsBody = clone.querySelector('#cms-body');
    if (cmsBody) cmsBody.innerHTML = '';
    const modalBody = clone.querySelector('#article-modal-content');
    if (modalBody) modalBody.innerHTML = '';

    // Reset hero territory map card to clean compact default
    const mapCard = clone.querySelector('#hero-map-card');
    if (mapCard) mapCard.classList.remove('is-expanded');
    const mapToggle = clone.querySelector('#map-toggle-btn');
    if (mapToggle) {
      mapToggle.textContent = 'Details +';
      mapToggle.setAttribute('aria-expanded', 'false');
    }

    // Reset active tab to Home
    clone.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('is-active', panel.id === 'panel-home');
    });
    clone.querySelectorAll('.nav-tab, .mobile-pill-tab').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === 'home');
    });

    // Inline external styles.css when exporting from the modular site
    const cssLink = clone.querySelector('link[rel="stylesheet"][href="styles.css"]');
    if (cssLink) {
      try {
        const resCss = await fetch('styles.css', { cache: 'no-store' });
        if (resCss.ok) {
          const cssText = await resCss.text();
          const styleTag = document.createElement('style');
          styleTag.textContent = '\n' + cssText + '\n';
          cssLink.replaceWith(styleTag);
        }
      } catch (_) {}
    }

    // Bundle local photos & logo as data URIs so the downloaded HTML works completely offline
    const embeddedPhotos = window.EMBEDDED_PHOTOS ? Object.assign({}, window.EMBEDDED_PHOTOS) : {};
    if (window.location.protocol.startsWith('http')) {
      const photoPaths = collectLocalPhotoPaths(siteData);
      await Promise.all(
        photoPaths.map(async (path) => {
          if (embeddedPhotos[path]) return;
          try {
            const res = await fetch(path);
            if (res.ok) {
              const blob = await res.blob();
              embeddedPhotos[path] = await blobToDataUrl(blob);
            }
          } catch (_) {}
        })
      );
    }

    clone.querySelectorAll('img[src^="assets/photos/"]').forEach((img) => {
      const src = img.getAttribute('src');
      if (src && embeddedPhotos[src]) {
        img.setAttribute('src', embeddedPhotos[src]);
      }
    });

    const safeJson = JSON.stringify(siteData, null, 2).replace(/<\/(script)/gi, '<\\/$1');
    const photosPrefix = Object.keys(embeddedPhotos).length
      ? `window.EMBEDDED_PHOTOS = ${JSON.stringify(embeddedPhotos).replace(/<\/(script)/gi, '<\\/$1')};\n`
      : '';
    const dataScriptContent = `\n${photosPrefix}window.DEFAULT_SITE_DATA = ${safeJson};\n`;

    // Case 1: Already a standalone HTML with inline DEFAULT_SITE_DATA
    let replacedInlineData = false;
    for (const sc of clone.querySelectorAll('script')) {
      if (!sc.getAttribute('src') && sc.textContent.includes('window.DEFAULT_SITE_DATA')) {
        sc.textContent = dataScriptContent;
        replacedInlineData = true;
        break;
      }
    }

    // Case 2: Modular HTML linking app.js -> inline data + app.js cleanly
    const appScript = clone.querySelector('script[src="app.js"]');
    if (appScript) {
      const dataTag = document.createElement('script');
      dataTag.textContent = dataScriptContent;
      appScript.parentNode.insertBefore(dataTag, appScript);
      try {
        const resJs = await fetch('app.js', { cache: 'no-store' });
        if (resJs.ok) {
          const jsText = (await resJs.text()).replace(/<\/(script)/gi, '<\\/$1');
          const inlineApp = document.createElement('script');
          inlineApp.textContent = '\n' + jsText + '\n';
          appScript.replaceWith(inlineApp);
        }
      } catch (_) {}
    } else if (!replacedInlineData && bodyEl) {
      const dataTag = document.createElement('script');
      dataTag.textContent = dataScriptContent;
      bodyEl.appendChild(dataTag);
    }

    downloadFile('index.html', '<!DOCTYPE html>\n' + clone.outerHTML, 'text/html; charset=utf-8');
    showToast('Downloaded standalone index.html — works offline & ready to share!');
  }

  /* ---------- Event Wiring ---------- */
  function bindEvents() {
    // Intro controls
    window.__rbDismissIntro = dismissIntro;
    document.getElementById('intro-skip-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissIntro();
    });
    document.getElementById('intro-curtain')?.addEventListener('click', dismissIntro);
    document.getElementById('replay-intro-btn')?.addEventListener('click', playIntro);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dismissIntro();
        closeArticleModal();
        closeCms();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        openCms();
      }
    });

    // Main navigation tabs, mobile 1-tap tab strip & brand home
    document.getElementById('brand-home-btn')?.addEventListener('click', () => switchTab('home'));
    document.querySelectorAll('.nav-tab, .mobile-pill-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    document.querySelectorAll('[data-jump-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.jumpTab));
    });

    // Mobile menu toggle & mobile drawer utility actions
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
      document.getElementById('main-nav')?.classList.toggle('is-open');
    });
    document.getElementById('mobile-replay-intro-btn')?.addEventListener('click', () => {
      document.getElementById('main-nav')?.classList.remove('is-open');
      playIntro();
    });
    document.getElementById('mobile-open-cms-btn')?.addEventListener('click', () => {
      document.getElementById('main-nav')?.classList.remove('is-open');
      openCms();
    });

    // Compact Territory Map expand/collapse toggle
    document.getElementById('map-toggle-btn')?.addEventListener('click', (e) => {
      const card = document.getElementById('hero-map-card');
      if (!card) return;
      const expanded = card.classList.toggle('is-expanded');
      e.currentTarget.textContent = expanded ? 'Compact −' : 'Details +';
      e.currentTarget.setAttribute('aria-expanded', String(expanded));
    });

    // Hero gallery controls + mobile touch swipe
    document.getElementById('gallery-prev')?.addEventListener('click', () => goToSlide(galleryIdx - 1));
    document.getElementById('gallery-next')?.addEventListener('click', () => goToSlide(galleryIdx + 1));
    document.getElementById('gallery-toggle')?.addEventListener('click', (e) => {
      galleryPaused = !galleryPaused;
      e.currentTarget.textContent = galleryPaused ? '▶' : '❚❚';
      e.currentTarget.setAttribute('aria-label', galleryPaused ? 'Play slideshow' : 'Pause slideshow');
      if (galleryPaused) clearInterval(galleryTimer);
      else startGalleryCycle();
    });

    const heroEl = document.querySelector('.hero-splash');
    if (heroEl) {
      let touchStartX = 0;
      let touchStartY = 0;
      heroEl.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
          }
        },
        { passive: true }
      );
      heroEl.addEventListener(
        'touchend',
        (e) => {
          if (!e.changedTouches.length) return;
          const dx = e.changedTouches[0].clientX - touchStartX;
          const dy = e.changedTouches[0].clientY - touchStartY;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            goToSlide(dx < 0 ? galleryIdx + 1 : galleryIdx - 1);
          }
        },
        { passive: true }
      );
    }

    // Article modal backdrop click
    document.getElementById('article-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'article-modal-backdrop') closeArticleModal();
    });

    // Get Involved volunteer / email notification form
    document.getElementById('volunteer-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const name = form.querySelector('#vol-name').value.trim();
      const email = form.querySelector('#vol-email').value.trim();
      const ward = form.querySelector('#vol-ward').value;
      const interests = Array.from(form.querySelectorAll('input[name="vol-interest"]:checked')).map((i) => i.value);
      if (!name || !email) return;

      await saveSubmission({ kind: 'Branch Alerts & Action Days', name, email, ward, interests });
      form.reset();
      const confirmBox = document.getElementById('volunteer-confirm');
      if (confirmBox) {
        confirmBox.style.display = 'block';
        confirmBox.textContent = `Thank you, ${name}. Your Southend-on-Sea email notification preferences have been recorded. Remember to complete your official national membership at restorebritain.org.uk/join_us if you haven't already.`;
      }
      showToast('Registered for Southend Branch email alerts!');
    });

    // Donate placeholder pledge form
    document.getElementById('pledge-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const name = form.querySelector('#pledge-name').value.trim();
      const email = form.querySelector('#pledge-email').value.trim();
      const amount = form.querySelector('#pledge-amount').value.trim();
      if (!name || !email) return;

      await saveSubmission({ kind: 'Fighting Fund Pledge', name, email, amount });
      form.reset();
      const confirmBox = document.getElementById('pledge-confirm');
      if (confirmBox) {
        confirmBox.style.display = 'block';
        confirmBox.textContent = `Thank you, ${name}. Your pledge interest (${amount || 'Custom'}) has been logged. We will email you as soon as the Southend-on-Sea online Fighting Fund goes live.`;
      }
      showToast('Local pledge registered — thank you!');
    });

    // Albion Initiative calculator sliders
    ['calc-volunteers', 'calc-hours', 'calc-sessions'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', updateAlbionCalc);
    });

    // CMS controls
    document.getElementById('open-cms-btn')?.addEventListener('click', openCms);
    document.getElementById('footer-cms-btn')?.addEventListener('click', openCms);
    document.getElementById('close-cms-btn')?.addEventListener('click', closeCms);
    document.getElementById('cms-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'cms-overlay') closeCms();
    });
    document.querySelectorAll('.cms-tab-btn').forEach((b) => {
      b.addEventListener('click', () => {
        activeCmsTab = b.dataset.cmsTab;
        renderCmsBody();
      });
    });
    document.getElementById('cms-quick-export-html')?.addEventListener('click', exportStandaloneHtml);
    document.getElementById('cms-quick-export-json')?.addEventListener('click', () => {
      downloadFile('site-content.json', JSON.stringify(siteData, null, 2), 'application/json');
      showToast('Exported site-content.json — commit to data/site-content.json to publish!');
    });
  }

  /* ---------- Bootstrap ---------- */
  async function boot() {
    bindEvents();
    playIntro();
    await initData();
    if (!siteData) {
      showToast('Could not load data/site-content.json. Serve over HTTP(S) or open a downloaded standalone index.html.');
      return;
    }
    renderAll();

    // Respect initial URL hash if navigated directly to a tab
    const hash = window.location.hash.replace('#', '');
    if (hash) switchTab(hash, false);

    setInterval(updateCountdown, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
