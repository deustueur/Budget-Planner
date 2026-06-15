// ═══════════════════════════════════════════════════════════════════
// BUDGET PLANNER — PATCH v5 (Final)
// God mode (all tabs), cash flow calendar, history bank delete
// ═══════════════════════════════════════════════════════════════════
(function () {
'use strict';

// ─── CONFIG ─────────────────────────────────────────────────────
const GRID_COLS  = 24;
const GRID_ROW_H = 80;
const LS_LAYOUT  = 'bp_layout_v5';

// ── Island definitions using REAL element IDs from index.html ──
const TAB_ISLANDS = {
  dashboard: [
    { id:'dash-metrics',       label:'Metrics',         col:1,  row:1,  w:24, h:2 },
    { id:'dash-bar',           label:'Budget bar',      col:1,  row:3,  w:24, h:1 },
    { id:'dash-savings-panel', label:'Tagged savings',  col:1,  row:4,  w:24, h:3 },
    { id:'income-card',        label:'Income',          col:1,  row:7,  w:12, h:7 },
    { id:'expense-card',       label:'Expenses',        col:13, row:7,  w:12, h:7 },
    { id:'dash-cat-chart',     label:'Category chart',  col:1,  row:14, w:12, h:4 },
    { id:'dash-global',        label:'All items',       col:13, row:14, w:12, h:4 },
  ],
  cashflow: [
    { id:'cf-calendar-card',   label:'Calendar',        col:1,  row:1,  w:24, h:8 },
    { id:'cf-timeline-card',   label:'Timeline',        col:1,  row:9,  w:24, h:4 },
    { id:'cf-due-card',        label:'Due soon',        col:1,  row:13, w:12, h:4 },
    { id:'cf-tax-card',        label:'Tax estimator',   col:13, row:13, w:12, h:4 },
  ],
  tracker: [
    { id:'tracker-card',       label:'Tracker',         col:1,  row:1,  w:24, h:12 },
  ],
  events: [
    { id:'events-card',        label:'Events',          col:1,  row:1,  w:24, h:10 },
  ],
  savings: [
    { id:'sav-met-total',      label:'Total Saved',     col:1,  row:1,  w:6,  h:2 },
    { id:'sav-met-trevin',     label:'Trevin',          col:7,  row:1,  w:6,  h:2 },
    { id:'sav-met-dulini',     label:'Dulini',          col:13, row:1,  w:6,  h:2 },
    { id:'sav-met-active',     label:'Active Streams',  col:19, row:1,  w:6,  h:2 },
    { id:'settlement-panel',   label:'Settlement',      col:1,  row:3,  w:12, h:3 },
    { id:'savings-projections',label:'Projections',     col:13, row:3,  w:12, h:3 },
    { id:'savings-grid',       label:'Streams',         col:1,  row:6,  w:24, h:6 },
  ],
  instruments: [
    { id:'ins-met-total',      label:'Total Instr.',    col:1,  row:1,  w:8,  h:2 },
    { id:'ins-met-debt',       label:'Total Debt',      col:9,  row:1,  w:8,  h:2 },
    { id:'ins-met-invest',     label:'Invested/Saved',  col:17, row:1,  w:8,  h:2 },
    { id:'instruments-grid',   label:'Instruments',     col:1,  row:3,  w:24, h:9 },
  ],
  insights: [
    { id:'ins-networth',       label:'Net worth',       col:1,  row:1,  w:24, h:3 },
    { id:'ins-history',        label:'History',         col:1,  row:4,  w:14, h:5 },
    { id:'ins-bank',           label:'History bank',    col:15, row:4,  w:10, h:5 },
    { id:'ins-import',         label:'Import',          col:1,  row:9,  w:14, h:6 },
    { id:'ins-suggestions',    label:'Suggestions',     col:15, row:9,  w:10, h:3 },
    { id:'ins-velocity',       label:'Velocity',        col:15, row:12, w:10, h:3 },
    { id:'ins-chart-trevin-w', label:'Trevin Trend',    col:1,  row:15, w:12, h:5 },
    { id:'ins-chart-dulini',   label:'Dulini Trend',    col:13, row:15, w:12, h:5 },
    { id:'ins-chart-combined', label:'Combined Trend',  col:1,  row:20, w:24, h:5 },
    { id:'ins-templates',      label:'Templates',       col:1,  row:25, w:24, h:3 },
  ],
};

let godMode      = false;
let layoutConfig = {};
let dragState    = null;
let resizeState  = null;

// ═══════════════════════════════════════════════════════════════
// 1. STYLES
// ═══════════════════════════════════════════════════════════════
function injectStyles() {
  if (document.getElementById('gm-styles')) return;
  const s = document.createElement('style');
  s.id = 'gm-styles';
  s.textContent = `
.god-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;
  border-radius:var(--radius);font-size:12px;cursor:pointer;
  border:1px solid var(--border);background:var(--surface);color:var(--text);
  transition:all .2s;font-family:inherit;white-space:nowrap;}
.god-btn.active{background:linear-gradient(135deg,#7F77DD,#D4537E);
  color:#fff;border-color:transparent;
  box-shadow:0 0 0 3px rgba(127,119,221,0.22);}

#gm-bar{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);
  background:var(--surface);border:1px solid rgba(127,119,221,0.5);
  border-radius:99px;padding:9px 18px;
  display:flex;align-items:center;gap:12px;
  box-shadow:0 8px 28px rgba(0,0,0,0.22);z-index:900;
  font-size:12px;color:var(--text2);
  opacity:0;pointer-events:none;transition:opacity .25s;white-space:nowrap;}
#gm-bar.on{opacity:1;pointer-events:all;}
.gm-pulse{width:8px;height:8px;border-radius:99px;flex-shrink:0;
  background:linear-gradient(135deg,#7F77DD,#D4537E);
  animation:gmpulse 1.4s infinite;}
@keyframes gmpulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(1.4);}}

#gm-dot-canvas{position:fixed;inset:0;pointer-events:none;z-index:1;
  opacity:0;transition:opacity .3s;}
body.gm-on #gm-dot-canvas{opacity:1;}

.gm-grid{display:grid;grid-template-columns:repeat(24,1fr);
  gap:14px;align-items:start;grid-auto-flow:dense;}

.gm-wrap{position:relative;border-radius:var(--radius-lg);}
body.gm-on .gm-wrap{
  outline:1.5px dashed transparent;transition:outline .15s,box-shadow .15s;}
body.gm-on .gm-wrap:hover{
  outline-color:rgba(127,119,221,0.55);
  box-shadow:0 0 0 4px rgba(127,119,221,0.09);z-index:10;}
body.gm-on .gm-wrap.dragging{opacity:.85;}

.gm-handle{display:none;position:absolute;top:7px;left:7px;z-index:30;
  width:24px;height:24px;border-radius:7px;
  background:#7F77DD;color:#fff;cursor:grab;
  align-items:center;justify-content:center;font-size:12px;
  box-shadow:0 2px 8px rgba(0,0,0,0.22);user-select:none;}
.gm-handle:active{cursor:grabbing;}
body.gm-on .gm-wrap:hover .gm-handle{display:flex;}

.gm-grip{display:none;position:absolute;bottom:5px;right:5px;z-index:30;
  width:14px;height:14px;cursor:se-resize;
  border-right:3px solid #7F77DD;border-bottom:3px solid #7F77DD;
  border-radius:0 0 3px 0;opacity:.8;}
body.gm-on .gm-wrap:hover .gm-grip{display:block;}

.gm-lbl{display:none;position:absolute;top:7px;right:7px;z-index:30;
  font-size:9px;padding:2px 8px;border-radius:99px;
  background:rgba(127,119,221,0.18);color:#7F77DD;
  font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  pointer-events:none;}
body.gm-on .gm-wrap:hover .gm-lbl{display:block;}

/* ── Cash flow calendar ── */
.cf-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
.cf-dh{text-align:center;font-size:9px;font-weight:700;color:var(--text3);
  text-transform:uppercase;letter-spacing:.06em;padding:3px 0 5px;}
.cf-day{min-height:62px;border-radius:7px;border:1px solid var(--border2);
  background:var(--surface2);padding:5px 5px 4px;cursor:pointer;
  transition:all .15s;position:relative;overflow:hidden;}
.cf-day:hover{border-color:var(--accent);background:var(--accent-light);}
.cf-day.cf-today{border-color:var(--accent);background:var(--accent-light);
  box-shadow:0 0 0 2px rgba(29,158,117,.18);}
.cf-day.cf-sel{outline:2px solid var(--accent);}
.cf-day.cf-inc{border-left:3px solid var(--accent);}
.cf-day.cf-exp{border-left:3px solid var(--danger);}
.cf-day.cf-both{border-left:3px solid #7F77DD;}
.cf-dn{font-size:10px;font-weight:700;color:var(--text2);margin-bottom:3px;}
.cf-today .cf-dn{color:var(--accent);font-size:11px;}
.cf-pill{font-size:8px;padding:1px 4px;border-radius:3px;margin-bottom:1px;
  display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  font-weight:600;line-height:1.4;}
.cf-pill.pi{background:var(--accent-light);color:var(--accent-dark);}
.cf-pill.pe{background:var(--danger-light);color:var(--danger);}
.cf-more{font-size:8px;color:var(--text3);margin-top:1px;}
.cf-det{background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-lg);padding:14px;margin-top:12px;display:none;}
.cf-det.open{display:block;}
.cf-di{display:flex;align-items:center;gap:8px;padding:8px 10px;
  border-radius:var(--radius);background:var(--surface2);
  margin-bottom:6px;font-size:12px;}
.cf-mp{margin-left:auto;font-size:10px;padding:2px 8px;border-radius:99px;
  border:1px solid var(--border);background:none;color:var(--text2);
  cursor:pointer;font-family:inherit;transition:all .15s;flex-shrink:0;}
.cf-mp:hover,.cf-mp.paid{background:var(--accent-light);
  color:var(--accent);border-color:var(--accent);}
.cf-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:var(--text2);
  padding-top:10px;border-top:1px solid var(--border2);margin-top:10px;}
.cf-ld{display:inline-block;width:10px;height:10px;border-radius:2px;
  margin-right:4px;vertical-align:middle;}

/* ── History bank delete ── */
.bx{width:20px;height:20px;border-radius:99px;border:none;
  background:var(--danger-light);color:var(--danger);
  cursor:pointer;display:inline-flex;align-items:center;
  justify-content:center;font-size:10px;flex-shrink:0;
  transition:all .15s;margin-left:4px;font-family:inherit;line-height:1;}
.bx:hover{background:var(--danger);color:#fff;}

@media(max-width:900px){
  .god-btn{display:none!important;}
  .gm-grid{display:block!important;}
}`;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
// 2. ADD STATIC IDs TO ELEMENTS THAT NEED THEM
// ═══════════════════════════════════════════════════════════════
function addStaticIds() {
  // ── Dashboard ──
  const bbar = document.querySelector('#tab-dashboard .bbar-card');
  if (bbar && !bbar.id) bbar.id = 'dash-bar';
  const catChart = document.querySelector('#tab-dashboard .chart-card');
  if (catChart && !catChart.id) catChart.id = 'dash-cat-chart';
  const twoColCards = document.querySelectorAll('#tab-dashboard .two-col .card');
  twoColCards.forEach(c => {
    if (!c.id && c.querySelector('#global-tbody')) c.id = 'dash-global';
  });

  // ── Tracker & Events ──
  const tCard = document.querySelector('#tab-tracker > .card');
  if (tCard && !tCard.id) tCard.id = 'tracker-card';
  const eCard = document.querySelector('#tab-events > .card');
  if (eCard && !eCard.id) eCard.id = 'events-card';

  // ── Cashflow ──
  // Hunt down the original timeline card using its inner track element
  const timelineTrack = document.getElementById('cf-track');
  if (timelineTrack) {
    const timelineCard = timelineTrack.closest('.card');
    if (timelineCard && !timelineCard.id) timelineCard.id = 'cf-timeline-card';
  }
  
  const cfTwoCols = document.querySelectorAll('#tab-cashflow .two-col .card');
  if (cfTwoCols[0]) cfTwoCols[0].id = 'cf-due-card';
  if (cfTwoCols[1]) cfTwoCols[1].id = 'cf-tax-card';
  const oldBottomRow = document.getElementById('cf-bottom-row');
  if (oldBottomRow) oldBottomRow.id = ''; // Disband the chunk wrapper

  // ── Savings Metrics ──
  const savCards = document.querySelectorAll('#savings-metrics .metric-card');
  if (savCards[0]) savCards[0].id = 'sav-met-total';
  if (savCards[1]) savCards[1].id = 'sav-met-trevin';
  if (savCards[2]) savCards[2].id = 'sav-met-dulini';
  if (savCards[3]) savCards[3].id = 'sav-met-active';

  // ── Instruments Metrics ──
  const insCards = document.querySelectorAll('#instr-metrics .metric-card');
  if (insCards[0]) insCards[0].id = 'ins-met-total';
  if (insCards[1]) insCards[1].id = 'ins-met-debt';
  if (insCards[2]) insCards[2].id = 'ins-met-invest';

  // ── Insights ──
  wrapEl('ins-networth',    document.querySelector('#tab-insights .networth-card'));
  wrapEl('ins-history',     buildInsBlock([nthInsTitle(0), document.getElementById('history-grid'), document.getElementById('history-detail')]));
  wrapEl('ins-bank',        buildInsBlock([nthInsTitle(1), document.getElementById('history-bank-list')]));
  wrapEl('ins-import',      buildInsBlock([nthInsTitle(2), document.querySelector('#tab-insights [style*="display:flex"][style*="gap:8px"]'), document.getElementById('import-panel-local'), document.getElementById('import-panel-drive')]));
  wrapEl('ins-suggestions', buildInsBlock([nthInsTitle(3), document.getElementById('suggestions-list')]));
  wrapEl('ins-velocity',    buildInsBlock([nthInsTitle(4), document.getElementById('savings-velocity')]));

  // Split Charts
  const tc = document.querySelector('#tab-insights .two-col');
  if (tc) {
    const cc = tc.querySelectorAll('.chart-card');
    if (cc[0]) { cc[0].id = 'ins-chart-trevin'; wrapEl('ins-chart-trevin-w', buildInsBlock([nthInsTitle(5), cc[0]])); }
    if (cc[1]) { cc[1].id = 'ins-chart-dulini'; }
  }
  const comb = document.querySelector('#tab-insights .chart-card:not(#ins-chart-trevin):not(#ins-chart-dulini)');
  if (comb) comb.id = 'ins-chart-combined';

  wrapEl('ins-templates',   buildInsBlock([nthInsTitle(6), document.getElementById('templates-list'), document.querySelector('#tab-insights button[onclick*="saveTemplate"]')]));
}

function wrapEl(id, el) { if (!el || document.getElementById(id)) return; el.id = id; }
function buildInsBlock(els) {
  const valid = els.filter(Boolean);
  if (!valid.length) return null;
  const wrap = document.createElement('div');
  const parent = valid[0].parentNode;
  parent.insertBefore(wrap, valid[0]);
  valid.forEach(el => wrap.appendChild(el));
  return wrap;
}
function nthInsTitle(n) { return document.querySelectorAll('#tab-insights .insight-section-title')[n] || null; }

// ═══════════════════════════════════════════════════════════════
// 2.5. SAFE RENDER PATCHES (Protects God Mode wrappers on redraw)
// ═══════════════════════════════════════════════════════════════
function patchMetricsRender() {
  if (window._gmMetricsPatched) return;
  window._gmMetricsPatched = true;

  function restoreIsland(wrapId, rawCard, tabId) {
    let wrap = document.querySelector(`.gm-wrap[data-id="${wrapId}"]`);
    if (!wrap) {
      // Rebuild the missing God Mode wrapper safely
      wrap = document.createElement('div');
      wrap.className = 'gm-wrap';
      wrap.dataset.id = wrapId;
      wrap.dataset.tab = tabId;
      
      const handle = document.createElement('div');
      handle.className = 'gm-handle';
      handle.innerHTML = '<i class="ti ti-grip-vertical"></i>';
      handle.title = 'Drag to move';
      
      const grip = document.createElement('div');
      grip.className = 'gm-grip';
      grip.title = 'Drag to resize';
      
      const lbl = document.createElement('div');
      lbl.className = 'gm-lbl';
      
      const defs = TAB_ISLANDS[tabId] || [];
      const def = defs.find(d => d.id === wrapId);
      lbl.textContent = def ? def.label : wrapId;
      
      wrap.appendChild(handle);
      wrap.appendChild(grip);
      wrap.appendChild(lbl);
      
      const grid = document.getElementById('gm-grid-' + tabId);
      if (grid) grid.appendChild(wrap);
      
      const saved = (layoutConfig[tabId] || {})[wrapId];
      const p = saved || def || {col:1, row:1, w:6, h:2};
      wrap.style.gridColumn = `${p.col} / span ${p.w}`;
      wrap.style.gridRow    = `${p.row} / span ${p.h}`;
      if (p.h > 1) wrap.style.minHeight = (p.h * GRID_ROW_H) + 'px';
    } else {
      Array.from(wrap.children).forEach(c => {
        if (!c.classList.contains('gm-handle') && !c.classList.contains('gm-grip') && !c.classList.contains('gm-lbl')) c.remove();
      });
    }
    wrap.appendChild(rawCard);
  }

  const origRS = window.renderSavings;
  window.renderSavings = function() {
    if(origRS) origRS();
    const cards = document.querySelectorAll('#savings-metrics .metric-card');
    const ids = ['sav-met-total', 'sav-met-trevin', 'sav-met-dulini', 'sav-met-active'];
    cards.forEach((c, i) => { if (ids[i]) { c.id = ids[i]; restoreIsland(ids[i], c, 'savings'); } });
    const metricContainer = document.getElementById('savings-metrics');
    if (metricContainer) metricContainer.style.display = 'none'; // hide original wrapper
  };

  const origRI = window.renderInstruments;
  window.renderInstruments = function() {
    if(origRI) origRI();
    const cards = document.querySelectorAll('#instr-metrics .metric-card');
    const ids = ['ins-met-total', 'ins-met-debt', 'ins-met-invest'];
    cards.forEach((c, i) => { if (ids[i]) { c.id = ids[i]; restoreIsland(ids[i], c, 'instruments'); } });
    const metricContainer = document.getElementById('instr-metrics');
    if (metricContainer) metricContainer.style.display = 'none'; // hide original wrapper
  };
}

// ═══════════════════════════════════════════════════════════════
// 3. BUILD GRID PER TAB (wrap islands, set grid positions)
// ═══════════════════════════════════════════════════════════════
function buildTabGrids() {
  Object.entries(TAB_ISLANDS).forEach(([tabId, defs]) => {
    const tabEl = document.getElementById('tab-' + tabId);
    if (!tabEl) return;

    let grid = document.getElementById('gm-grid-' + tabId);
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'gm-grid';
      grid.id = 'gm-grid-' + tabId;
      Array.from(tabEl.children).forEach(c => grid.appendChild(c));
      tabEl.appendChild(grid);
    }

    defs.forEach(def => {
      const el = document.getElementById(def.id);
      if (!el) return;

      let wrap = el.closest('.gm-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'gm-wrap';
        wrap.dataset.id  = def.id;
        wrap.dataset.tab = tabId;
        el.parentNode.insertBefore(wrap, el);
        wrap.appendChild(el);

        const handle = document.createElement('div');
        handle.className = 'gm-handle';
        handle.innerHTML = '<i class="ti ti-grip-vertical"></i>';
        handle.title = 'Drag to move';

        const grip = document.createElement('div');
        grip.className = 'gm-grip';
        grip.title = 'Drag to resize';

        const lbl = document.createElement('div');
        lbl.className = 'gm-lbl';
        lbl.textContent = def.label;

        wrap.appendChild(handle);
        wrap.appendChild(grip);
        wrap.appendChild(lbl);
      }

      if (wrap.parentElement !== grid) grid.appendChild(wrap);

      const saved = (layoutConfig[tabId] || {})[def.id];
      const p = saved || def;
      wrap.style.gridColumn = `${p.col} / span ${p.w}`;
      wrap.style.gridRow    = `${p.row} / span ${p.h}`;
      if (p.h > 1) wrap.style.minHeight = (p.h * GRID_ROW_H) + 'px';
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// 4. GOD MODE
// ═══════════════════════════════════════════════════════════════
function toggleGodMode() {
  godMode = !godMode;
  document.body.classList.toggle('gm-on', godMode);

  const btn = document.getElementById('gm-btn');
  if (btn) {
    btn.classList.toggle('active', godMode);
    btn.innerHTML = godMode
      ? '<i class="ti ti-lock-open"></i> God mode'
      : '<i class="ti ti-adjustments"></i> Configure';
  }
  const bar = document.getElementById('gm-bar');
  if (bar) bar.classList.toggle('on', godMode);

  if (godMode) { drawDots(); bindDrag(); }
  else         { hideDots(); unbindDrag(); saveLayout(); }
}
window.toggleGodMode = toggleGodMode;

function drawDots() {
  let cv = document.getElementById('gm-dot-canvas');
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'gm-dot-canvas'; document.body.appendChild(cv); }
  cv.width  = window.innerWidth;
  cv.height = Math.max(document.body.scrollHeight, window.innerHeight * 2);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const cw = cv.width / GRID_COLS;
  ctx.fillStyle = 'rgba(127,119,221,0.16)';
  for (let c = 0; c <= GRID_COLS; c++)
    for (let r = 0; r * GRID_ROW_H <= cv.height; r++) {
      ctx.beginPath(); ctx.arc(c * cw, r * GRID_ROW_H, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  cv.style.opacity = '1';
}
function hideDots() {
  const cv = document.getElementById('gm-dot-canvas');
  if (cv) cv.style.opacity = '0';
}

// ═══════════════════════════════════════════════════════════════
// 5. DRAG
// ═══════════════════════════════════════════════════════════════
function bindDrag() {
  document.querySelectorAll('.gm-handle').forEach(h => {
    h.addEventListener('mousedown', startDrag);
    h.addEventListener('touchstart', startDrag, { passive: false });
  });
  document.querySelectorAll('.gm-grip').forEach(g =>
    g.addEventListener('mousedown', startResize));
}
function unbindDrag() {
  document.querySelectorAll('.gm-handle').forEach(h => {
    h.removeEventListener('mousedown', startDrag);
    h.removeEventListener('touchstart', startDrag);
  });
  document.querySelectorAll('.gm-grip').forEach(g =>
    g.removeEventListener('mousedown', startResize));
}

function startDrag(e) {
  if (!godMode) return;
  e.preventDefault();
  const wrap = e.currentTarget.closest('.gm-wrap');
  const grid = wrap && wrap.closest('.gm-grid');
  if (!wrap || !grid) return;
  
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  
  wrap.classList.add('dragging');
  wrap.style.zIndex = '999'; // Bring to front while dragging
  
  dragState = {
    wrap, grid,
    startX: cx,
    startY: cy,
    w: pSpan(wrap.style.gridColumn),
    h: pSpan(wrap.style.gridRow),
    sc: pStart(wrap.style.gridColumn),
    sr: pStart(wrap.style.gridRow)
  };
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup',   endDrag);
  document.addEventListener('touchmove', onDrag,  { passive: false });
  document.addEventListener('touchend',  endDrag);
}

function onDrag(e) {
  if (!dragState) return;
  e.preventDefault();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  
  const dx = cx - dragState.startX;
  const dy = cy - dragState.startY;
  
  // Smooth CSS transform glide instead of fighting CSS Grid reflow
  dragState.wrap.style.transform = `translate(${dx}px, ${dy}px)`;
}

function endDrag(e) {
  if (!dragState) return;
  const { wrap, grid, startX, startY, w, h, sc, sr } = dragState;
  
  const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
  const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
  
  const dx = cx - startX;
  const dy = cy - startY;
  const cw = grid.getBoundingClientRect().width / GRID_COLS;
  
  // Snap to final grid position
  const colOffset = Math.round(dx / cw);
  const rowOffset = Math.round(dy / GRID_ROW_H);
  const newCol = Math.max(1, Math.min(GRID_COLS - w + 1, sc + colOffset));
  const newRow = Math.max(1, sr + rowOffset);
  
  wrap.style.transform = '';
  wrap.style.zIndex = '';
  wrap.classList.remove('dragging');
  
  wrap.style.gridColumn = `${newCol} / span ${w}`;
  wrap.style.gridRow    = `${newRow} / span ${h}`;
  
  recordPos(wrap);
  
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup',   endDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend',  endDrag);
  dragState = null;
}

function startResize(e) {
  if (!godMode) return;
  e.preventDefault();
  const wrap = e.currentTarget.closest('.gm-wrap');
  const grid = wrap && wrap.closest('.gm-grid');
  if (!wrap || !grid) return;
  const gr = grid.getBoundingClientRect();
  resizeState = {
    wrap, gr,
    sx: e.clientX, sy: e.clientY,
    sw: pSpan(wrap.style.gridColumn),
    sh: pSpan(wrap.style.gridRow),
    sc: pStart(wrap.style.gridColumn),
    sr: pStart(wrap.style.gridRow),
  };
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup',   endResize);
}

function onResize(e) {
  if (!resizeState) return;
  const { wrap, gr, sx, sy, sw, sh, sc, sr } = resizeState;
  const cw  = gr.width / GRID_COLS;
  const newW = Math.max(3, Math.min(GRID_COLS - sc + 1, sw + Math.round((e.clientX - sx) / cw)));
  const newH = Math.max(1, sh + Math.round((e.clientY - sy) / GRID_ROW_H));
  wrap.style.gridColumn = `${sc} / span ${newW}`;
  wrap.style.gridRow    = `${sr} / span ${newH}`;
  wrap.style.minHeight  = (newH * GRID_ROW_H) + 'px';
}

function endResize() {
  if (!resizeState) return;
  recordPos(resizeState.wrap);
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup',   endResize);
  resizeState = null;
}

function recordPos(wrap) {
  const id  = wrap.dataset.id;
  const tab = wrap.dataset.tab;
  if (!id || !tab) return;
  if (!layoutConfig[tab]) layoutConfig[tab] = {};
  layoutConfig[tab][id] = {
    col: pStart(wrap.style.gridColumn),
    row: pStart(wrap.style.gridRow),
    w:   pSpan(wrap.style.gridColumn),
    h:   pSpan(wrap.style.gridRow),
  };
}

function pStart(v) { const m = (v||'').match(/^(\d+)/);       return m ? +m[1] : 1; }
function pSpan(v)  { const m = (v||'').match(/span\s+(\d+)/); return m ? +m[1] : 1; }

// ═══════════════════════════════════════════════════════════════
// 6. SAVE / LOAD LAYOUT
// ═══════════════════════════════════════════════════════════════
function saveLayout() {
  try { localStorage.setItem(LS_LAYOUT, JSON.stringify(layoutConfig)); } catch(e) {}
  if (typeof window.markDirty === 'function') window.markDirty();
}

function loadLayout() {
  if (window.__BP_STATE__?.layoutConfig) {
    layoutConfig = window.__BP_STATE__.layoutConfig; return;
  }
  try {
    const r = localStorage.getItem(LS_LAYOUT);
    if (r) { layoutConfig = JSON.parse(r); return; }
  } catch(e) {}
  layoutConfig = {};
}

function resetLayout() {
  if (!confirm('Reset all layouts to defaults for all tabs?')) return;
  layoutConfig = {};
  try { localStorage.removeItem(LS_LAYOUT); } catch(e) {}
  // Re-apply defaults
  document.querySelectorAll('.gm-wrap').forEach(w => {
    const id  = w.dataset.id;
    const tab = w.dataset.tab;
    const def = (TAB_ISLANDS[tab] || []).find(d => d.id === id);
    if (def) {
      w.style.gridColumn = `${def.col} / span ${def.w}`;
      w.style.gridRow    = `${def.row} / span ${def.h}`;
      w.style.minHeight  = (def.h * GRID_ROW_H) + 'px';
    }
  });
  saveLayout();
}
window.resetLayout = resetLayout;

// ═══════════════════════════════════════════════════════════════
// 7. GOD BAR + BUTTON
// ═══════════════════════════════════════════════════════════════
function injectGodUI() {
  if (document.getElementById('gm-btn')) return;
  const navRight = document.querySelector('.nav-right');
  if (!navRight) {
    setTimeout(injectGodUI, 500); // Retry until nav is ready
    return;
  }

  const btn = document.createElement('button');
  btn.id = 'gm-btn';
  btn.className = 'god-btn';
  btn.innerHTML = '<i class="ti ti-adjustments"></i> Configure';
  btn.onclick = toggleGodMode;
  navRight.insertBefore(btn, navRight.firstChild);

  const bar = document.createElement('div');
  bar.id = 'gm-bar';
  bar.innerHTML = `
    <div class="gm-pulse"></div>
    <span style="font-weight:700;color:#7F77DD;">God mode</span>
    <span style="color:var(--text3);">
      <i class="ti ti-grip-vertical" style="font-size:10px;"></i> drag to move &nbsp;·&nbsp; corner grip to resize
    </span>
    <button class="btn btn-sm" style="border-radius:99px;flex-shrink:0;" onclick="resetLayout()">
      <i class="ti ti-refresh"></i> Reset
    </button>
    <button class="btn btn-sm btn-accent" style="border-radius:99px;flex-shrink:0;" onclick="toggleGodMode()">
      <i class="ti ti-check"></i> Save &amp; exit
    </button>`;
  document.body.appendChild(bar);
}

// ═══════════════════════════════════════════════════════════════
// 8. CASH FLOW CALENDAR
// ═══════════════════════════════════════════════════════════════
function buildCalendarCard() {
  const cfTab = document.getElementById('tab-cashflow');
  if (!cfTab) return;

  if (!document.getElementById('cf-calendar-card')) {
    const card = document.createElement('div');
    card.id = 'cf-calendar-card';
    card.className = 'card';
    card.style.marginBottom = '14px';
    cfTab.insertBefore(card, cfTab.firstChild);
  }

  if (!document.getElementById('cf-bottom-row')) {
    const row = document.createElement('div');
    row.id = 'cf-bottom-row';
    row.className = 'two-col';
    const existing = cfTab.querySelector('.two-col:not(#cf-bottom-row)');
    if (existing) {
      cfTab.insertBefore(row, existing);
      row.appendChild(existing);
    }
  }

  renderCalendar();
}

function renderCalendar() {
  const card = document.getElementById('cf-calendar-card');
  if (!card) return;

  const now   = new Date();
  const mo    = now.getMonth();
  const yr    = now.getFullYear();
  const dim   = new Date(yr, mo + 1, 0).getDate();
  const first = new Date(yr, mo, 1).getDay();
  const today = now.getDate();
  const MN    = (window.MONTHS || ['January','February','March','April','May','June','July','August','September','October','November','December'])[mo];
  const fmtC  = window.fmtC  || (n => String(n));
  const toM   = window.toMonthly || (v => v);
  const getTk = window.getTkey || ((m,y) => `${y}-${m}`);
  const tkey  = getTk(mo, yr);

  const dm = {};
  (window.items || []).filter(i => i.on && i.dueDay > 0).forEach(it => {
    const d = it.dueDay;
    if (d < 1 || d > dim) return;
    if (!dm[d]) dm[d] = [];
    dm[d].push(it);
  });

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const hdrs = DAYS.map(d => `<div class="cf-dh">${d}</div>`).join('');
  const empty = Array(first).fill('<div></div>').join('');
  const cells = Array.from({ length: dim }, (_, i) => {
    const day = i + 1;
    const its = dm[day] || [];
    const hi  = its.some(x => x.type === 'income');
    const he  = its.some(x => x.type === 'expense');
    const cls = ['cf-day', day===today?'cf-today':'',
      hi&&he?'cf-both':hi?'cf-inc':he?'cf-exp':''].filter(Boolean).join(' ');
    const pills = its.slice(0,2).map(it =>
      `<span class="cf-pill ${it.type==='income'?'pi':'pe'}">
        ${it.type==='income'?'↑':'↓'} ${it.name}</span>`).join('');
    const more = its.length>2 ? `<div class="cf-more">+${its.length-2}</div>` : '';
    return `<div class="${cls}" data-d="${day}" onclick="cfClick(${day})">${
      `<div class="cf-dn">${day}</div>${pills}${more}`}</div>`;
  }).join('');

  card.innerHTML = `
    <div class="card-head">
      <span class="card-title">
        <i class="ti ti-calendar-month" style="color:var(--accent);margin-right:4px;"></i>${MN} ${yr}
      </span>
      <span id="cf-sel-lbl" style="font-size:11px;color:var(--text2);"></span>
    </div>
    <div class="cf-cal-grid">${hdrs}${empty}${cells}</div>
    <div class="cf-det" id="cf-det"></div>
    <div class="cf-leg">
      <span><span class="cf-ld" style="background:var(--accent);"></span>Income due</span>
      <span><span class="cf-ld" style="background:var(--danger);"></span>Expense due</span>
      <span><span class="cf-ld" style="background:#7F77DD;"></span>Both</span>
    </div>`;

  window.cfClick = function(day) {
    const its = dm[day] || [];
    const det = document.getElementById('cf-det');
    const lbl = document.getElementById('cf-sel-lbl');
    document.querySelectorAll('.cf-day.cf-sel').forEach(x => x.classList.remove('cf-sel'));
    const dayEl = document.querySelector(`.cf-day[data-d="${day}"]`);
    if (dayEl) dayEl.classList.add('cf-sel');
    if (!its.length || !det) return;
    if (lbl) lbl.textContent = `Day ${day} — ${its.length} item${its.length>1?'s':''}`;
    const td  = (window.trackerData&&window.trackerData[tkey]) || {};
    const gdu = window.getDaysUntil || (() => null);
    det.classList.add('open');
    det.innerHTML = `
      <div class="card-head" style="margin-bottom:10px;">
        <span class="card-title">Day ${day}</span>
        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('cf-det').classList.remove('open');document.getElementById('cf-sel-lbl').textContent=''">✕</button>
      </div>
      ${its.map(it => {
        const mv  = Math.round(toM(it.val, it.freq));
        const key = (it.type==='income'?'inc_':'exp_') + it.id;
        const paid = td[key] !== undefined && td[key] !== '';
        const d   = gdu(it.dueDay);
        const uc  = d===0?'var(--danger)':d!==null&&d<=3?'var(--warning)':'var(--text3)';
        const ut  = d===null?'':d===0?'TODAY':d+'d';
        return `<div class="cf-di">
          <div class="owner-dot ${it.owner||'shared'}"></div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:500;">${it.name}</div>
            <div style="font-size:10px;color:var(--text2);">${it.type} · ${it.owner||'shared'} · ${it.tag||''}</div>
          </div>
          <span style="font-size:14px;font-weight:700;color:${it.type==='income'?'var(--accent)':'var(--danger)'};">${fmtC(mv)}</span>
          ${ut?`<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--surface3);color:${uc};">${ut}</span>`:''}
          <button class="cf-mp ${paid?'paid':''}" onclick="cfPay('${it.id}','${it.type}','${tkey}',this,${mv})">
            ${paid?'✓ Paid':'Mark paid'}
          </button>
        </div>`;
      }).join('')}`;
  };

  window.cfPay = function(id, type, tk, btn, val) {
    if (!window.trackerData) window.trackerData = {};
    if (!window.trackerData[tk]) window.trackerData[tk] = {};
    const key = (type==='income'?'inc_':'exp_') + id;
    if (btn.classList.contains('paid')) {
      delete window.trackerData[tk][key];
      btn.classList.remove('paid'); btn.textContent = 'Mark paid';
    } else {
      window.trackerData[tk][key] = val;
      btn.classList.add('paid'); btn.textContent = '✓ Paid';
    }
    if (typeof window.markDirty === 'function') window.markDirty();
  };
}

function patchShowTab() {
  if (window._gmShowTab) return;
  const orig = window.showTab;
  if (!orig) return;
  window._gmShowTab = true;
  window.showTab = function(t) {
    orig(t);
    if (t === 'cashflow') setTimeout(renderCalendar, 60);
    if (godMode) setTimeout(bindDrag, 120);
  };
}

// ═══════════════════════════════════════════════════════════════
// 9. HISTORY BANK DELETE
// ═══════════════════════════════════════════════════════════════
function patchBank() {
  if (window._gmBank) return;
  const origRHB = window.renderHistoryBank;
  const origRI  = window.renderInsights;
  if (!origRHB) return;
  window._gmBank = true;

  function addX() {
    const list = document.getElementById('history-bank-list');
    if (!list) return;
    list.querySelectorAll('.history-bank-item').forEach(item => {
      if (item.querySelector('.bx')) return;
      let key = null;
      const resolveBtn = item.querySelector('button[onclick*="openConflictModal"]');
      if (resolveBtn) {
        const m = resolveBtn.getAttribute('onclick').match(/openConflictModal\('([^']+)'\)/);
        if (m) key = m[1];
      }
      if (!key && window.insightHistory) {
        const span = item.querySelector('span[style*="font-weight"]');
        if (span) {
          const txt = span.textContent.trim();
          const MS  = window.MS || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          key = Object.keys(window.insightHistory).find(k => {
            const [y,mi] = k.split('-');
            return (MS[+mi] + ' ' + y) === txt;
          });
        }
      }
      if (!key) return;
      const btn = document.createElement('button');
      btn.className = 'bx';
      btn.title = 'Delete this month';
      btn.innerHTML = '✕';
      btn.onclick = ev => { ev.stopPropagation(); delBank(key); };
      item.appendChild(btn);
    });
  }

  window.renderHistoryBank = function() { origRHB(); setTimeout(addX, 40); };
  if (origRI) window.renderInsights = function() { origRI(); setTimeout(addX, 80); };
}

function delBank(key) {
  const [y,mi] = key.split('-');
  const MS = window.MS || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (!confirm(`Delete ${MS[+mi]} ${y} from History Bank?\n\nRemoves tracker actuals, history snapshot and bank entry. Cannot be undone.`)) return;
  if (window.insightHistory)   delete window.insightHistory[key];
  if (window.pendingConflicts) delete window.pendingConflicts[key];
  if (window.trackerData)      delete window.trackerData[key];
  if (window.monthHistory)     delete window.monthHistory[key];
  if (window.monthNotes)       delete window.monthNotes[key];
  if (typeof window.markDirty === 'function') window.markDirty();
  if (typeof window.renderInsights === 'function') window.renderInsights();
  if (typeof window.buildNotifications === 'function') window.buildNotifications();
}

// ═══════════════════════════════════════════════════════════════
// 10. PATCH captureState TO INCLUDE LAYOUT
// ═══════════════════════════════════════════════════════════════
function patchState() {
  const origC = window.captureState;
  const origA = window.applyState;
  if (origC && !window._gmCapture) {
    window._gmCapture = true;
    window.captureState = function() {
      const s = origC(); s.layoutConfig = layoutConfig; return s;
    };
  }
  if (origA && !window._gmApply) {
    window._gmApply = true;
    window.applyState = function(s) {
      origA(s);
      if (s?.layoutConfig) { layoutConfig = s.layoutConfig; buildTabGrids(); }
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// INIT — runs after main site init() has completed
// ═══════════════════════════════════════════════════════════════
function patchInit() {
  injectStyles();
  loadLayout();
  buildCalendarCard(); // Build calendar BEFORE tagging IDs
  addStaticIds();      // Tag the split islands
  patchMetricsRender();// Lock the metric wrappers from being nuked
  buildTabGrids();     // Wrap everything in God Mode logic
  injectGodUI();
  patchBank();
  patchShowTab();
  patchState();
  
  if (document.querySelector('#tab-savings.active') && typeof window.renderSavings === 'function') window.renderSavings();
  if (document.querySelector('#tab-instruments.active') && typeof window.renderInstruments === 'function') window.renderInstruments();
  
  console.log('[patch v5] ✓ loaded with precise dragging and metric protection');
}

// Wait for main site DOMContentLoaded to finish, then run
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(patchInit, 200));
} else {
  setTimeout(patchInit, 200);
}

})();
