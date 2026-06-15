// ═══════════════════════════════════════════════════════════════════
// BUDGET PLANNER — PATCH v3
// Fixes: God mode (all tabs), cash flow calendar, history bank delete
// ═══════════════════════════════════════════════════════════════════
(function () {
'use strict';

// ─── CONFIG ─────────────────────────────────────────────────────
const GRID_COLS    = 24;
const GRID_ROW_H   = 80;   // px per row unit
const LS_LAYOUT    = 'bp_layout_v3';

// Map of real element IDs that exist in the HTML per tab
// These are the actual draggable islands
const TAB_ISLANDS = {
  dashboard: [
    { id:'dash-metrics',        label:'Metrics',         col:1,  row:1,  w:24, h:2 },
    { id:'dash-bar',            label:'Budget bar',      col:1,  row:3,  w:24, h:1 },
    { id:'dash-savings-panel',  label:'Tagged savings',  col:1,  row:4,  w:24, h:3 },
    { id:'income-card',         label:'Income',          col:1,  row:7,  w:12, h:7 },
    { id:'expense-card',        label:'Expenses',        col:13, row:7,  w:12, h:7 },
    { id:'dash-cat-chart',      label:'Category chart',  col:1,  row:14, w:12, h:4 },
    { id:'dash-global',         label:'All items',       col:13, row:14, w:12, h:4 },
  ],
  cashflow: [
    { id:'cf-main-card',        label:'Cash flow calendar', col:1, row:1, w:24, h:8 },
    { id:'cf-due-card',         label:'Due soon',           col:1, row:9, w:12, h:4 },
    { id:'cf-tax-card',         label:'Tax estimator',      col:13,row:9, w:12, h:4 },
  ],
  tracker: [
    { id:'tracker-main-card',   label:'Tracker',         col:1,  row:1,  w:24, h:12 },
  ],
  events: [
    { id:'events-main-card',    label:'Events',          col:1,  row:1,  w:24, h:10 },
  ],
  savings: [
    { id:'savings-metrics',     label:'Metrics',         col:1,  row:1,  w:24, h:2 },
    { id:'settlement-panel',    label:'Settlement',      col:1,  row:3,  w:12, h:3 },
    { id:'savings-projections', label:'Goal projections',col:13, row:3,  w:12, h:3 },
    { id:'savings-grid',        label:'Streams',         col:1,  row:6,  w:24, h:6 },
  ],
  instruments: [
    { id:'instr-metrics',       label:'Metrics',         col:1,  row:1,  w:24, h:2 },
    { id:'instruments-grid',    label:'Instruments',     col:1,  row:3,  w:24, h:9 },
  ],
  insights: [
    { id:'insights-nw',         label:'Net worth',       col:1,  row:1,  w:24, h:3 },
    { id:'insights-history',    label:'History',         col:1,  row:4,  w:14, h:5 },
    { id:'insights-bank',       label:'History bank',    col:15, row:4,  w:10, h:5 },
    { id:'insights-import',     label:'Import data',     col:1,  row:9,  w:14, h:6 },
    { id:'insights-suggestions',label:'AI suggestions',  col:15, row:9,  w:10, h:3 },
    { id:'insights-velocity',   label:'Savings velocity',col:15, row:12, w:10, h:3 },
    { id:'insights-charts',     label:'Person trends',   col:1,  row:15, w:24, h:5 },
    { id:'insights-templates',  label:'Templates',       col:1,  row:20, w:24, h:3 },
  ],
};

// ─── STATE ──────────────────────────────────────────────────────
let godMode      = false;
let layoutConfig = {};   // { tabId: { islandId: {col,row,w,h} } }
let dragState    = null;
let resizeState  = null;

// ═══════════════════════════════════════════════════════════════
// STEP 1 — ADD IDs TO EXISTING ELEMENTS THAT LACK THEM
// ═══════════════════════════════════════════════════════════════
function addMissingIds() {
  // Tracker tab — wrap the single card
  const trackerCard = document.querySelector('#tab-tracker > .card');
  if (trackerCard && !trackerCard.id) trackerCard.id = 'tracker-main-card';

  // Events tab
  const eventsCard = document.querySelector('#tab-events > .card');
  if (eventsCard && !eventsCard.id) eventsCard.id = 'events-main-card';

  // Cashflow tab — the cards inside
  const cfCards = document.querySelectorAll('#tab-cashflow > .card');
  if (cfCards[0] && !cfCards[0].id) cfCards[0].id = 'cf-main-card';
  if (cfCards[1] && !cfCards[1].id) cfCards[1].id = 'cf-due-card';
  const cfTwoCol = document.querySelector('#tab-cashflow .two-col');
  if (cfTwoCol) {
    const cols = cfTwoCol.querySelectorAll(':scope > .card');
    if (cols[0] && !cols[0].id) cols[0].id = 'cf-due-card';
    if (cols[1] && !cols[1].id) cols[1].id = 'cf-tax-card';
    // Unwrap from two-col so islands can be positioned independently
    if (!cfTwoCol.dataset.unwrapped) {
      cols.forEach(c => cfTwoCol.parentNode.insertBefore(c, cfTwoCol));
      cfTwoCol.remove();
      cfTwoCol.dataset.unwrapped = '1';
    }
  }

  // Insights — wrap logical sections with IDs
  const insightsTab = document.getElementById('tab-insights');
  if (!insightsTab) return;

  wrapInsightSection('insights-nw',          '.networth-card',          insightsTab);
  wrapInsightSectionByRange('insights-history',   '#history-grid',     '#history-detail',  insightsTab);
  wrapInsightSectionById('insights-bank',         '#history-bank-list',                    insightsTab);
  wrapInsightImport(insightsTab);
  wrapInsightSectionById('insights-suggestions',  '#suggestions-list',                     insightsTab);
  wrapInsightSectionById('insights-velocity',     '#savings-velocity',                     insightsTab);
  wrapInsightCharts(insightsTab);
  wrapInsightTemplates(insightsTab);

  // Savings — unwrap two-col from projections/settlement
  const savTwoCol = document.querySelector('#tab-savings .two-col');
  if (savTwoCol && !savTwoCol.dataset.unwrapped) {
    const cols = savTwoCol.querySelectorAll(':scope > *');
    cols.forEach(c => savTwoCol.parentNode.insertBefore(c, savTwoCol));
    savTwoCol.remove();
  }
}

function wrapInsightSection(newId, selector, parent) {
  if (document.getElementById(newId)) return;
  const el = parent.querySelector(selector);
  if (!el) return;
  el.id = newId;
}

function wrapInsightSectionById(newId, selector, parent) {
  if (document.getElementById(newId)) return;
  const el = parent.querySelector(selector);
  if (!el || el.id === newId) return;
  // wrap el plus preceding section title in a div
  const wrap = document.createElement('div');
  wrap.id = newId;
  el.parentNode.insertBefore(wrap, el);
  // grab preceding insight-section-title if present
  const prev = wrap.previousElementSibling;
  if (prev && prev.classList.contains('insight-section-title')) wrap.appendChild(prev);
  wrap.appendChild(el);
}

function wrapInsightSectionByRange(newId, startSel, endSel, parent) {
  if (document.getElementById(newId)) return;
  const start = parent.querySelector(startSel);
  const end   = parent.querySelector(endSel);
  if (!start) return;
  const wrap = document.createElement('div');
  wrap.id = newId;
  start.parentNode.insertBefore(wrap, start);
  const prev = wrap.previousElementSibling;
  if (prev && prev.classList.contains('insight-section-title')) wrap.appendChild(prev);
  wrap.appendChild(start);
  if (end) wrap.appendChild(end);
}

function wrapInsightImport(parent) {
  if (document.getElementById('insights-import')) return;
  const tabBtns = parent.querySelector('[id="import-tab-local"]');
  if (!tabBtns) return;
  const wrap = document.createElement('div');
  wrap.id = 'insights-import';
  tabBtns.parentNode.insertBefore(wrap, tabBtns.parentElement.previousElementSibling || tabBtns);
  // Find the section title before the import tabs
  let node = tabBtns.closest('[style]') || tabBtns.parentElement;
  // simpler: just wrap from the flex div containing the import tabs down through both panels
  const flexRow = parent.querySelector('div[style*="display:flex;gap:8px;margin-bottom:12px"]');
  if (!flexRow) return;
  const title = flexRow.previousElementSibling;
  if (title && title.classList.contains('insight-section-title')) wrap.appendChild(title);
  wrap.appendChild(flexRow);
  const localPanel = document.getElementById('import-panel-local');
  const drivePanel = document.getElementById('import-panel-drive');
  if (localPanel) wrap.appendChild(localPanel);
  if (drivePanel) wrap.appendChild(drivePanel);
  const confirmBtn = document.getElementById('import-confirm-btn');
  if (confirmBtn && confirmBtn.parentNode !== localPanel) wrap.appendChild(confirmBtn);
  parent.insertBefore(wrap, parent.querySelector('.insight-section-title[style]') || parent.firstChild);
}

function wrapInsightCharts(parent) {
  if (document.getElementById('insights-charts')) return;
  const twoCol = parent.querySelector('.two-col');
  if (!twoCol) return;
  const wrap = document.createElement('div');
  wrap.id = 'insights-charts';
  const title = twoCol.previousElementSibling;
  twoCol.parentNode.insertBefore(wrap, twoCol);
  if (title && title.classList.contains('insight-section-title')) wrap.appendChild(title);
  wrap.appendChild(twoCol);
  const balChart = parent.querySelector('#balanceTrendChart')?.closest('.chart-card');
  if (balChart) wrap.appendChild(balChart);
}

function wrapInsightTemplates(parent) {
  if (document.getElementById('insights-templates')) return;
  const templatesList = document.getElementById('templates-list');
  if (!templatesList) return;
  const wrap = document.createElement('div');
  wrap.id = 'insights-templates';
  const title = templatesList.previousElementSibling;
  templatesList.parentNode.insertBefore(wrap, templatesList);
  if (title && title.classList.contains('insight-section-title')) wrap.appendChild(title);
  wrap.appendChild(templatesList);
  // Save template button
  const saveBtn = parent.querySelector('button[onclick*="saveTemplate"]');
  if (saveBtn) wrap.appendChild(saveBtn);
}

// ═══════════════════════════════════════════════════════════════
// STEP 2 — STYLES
// ═══════════════════════════════════════════════════════════════
function injectStyles() {
  if (document.getElementById('patch-v3-styles')) return;
  const s = document.createElement('style');
  s.id = 'patch-v3-styles';
  s.textContent = `
/* God mode button */
.god-btn {
  display:inline-flex;align-items:center;gap:5px;padding:5px 11px;
  border-radius:var(--radius);font-size:12px;cursor:pointer;
  border:1px solid var(--border);background:var(--surface);color:var(--text);
  transition:all .2s;font-family:inherit;white-space:nowrap;
}
.god-btn.active {
  background:linear-gradient(135deg,#7F77DD,#D4537E);
  color:#fff;border-color:transparent;
  box-shadow:0 0 0 3px rgba(127,119,221,0.2);
}

/* Floating god bar */
.god-bar {
  position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
  background:var(--surface);border:1px solid rgba(127,119,221,0.4);
  border-radius:99px;padding:9px 18px;
  display:flex;align-items:center;gap:12px;
  box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:900;
  font-size:12px;color:var(--text2);
  opacity:0;pointer-events:none;transition:opacity .25s;
  white-space:nowrap;
}
.god-bar.visible { opacity:1;pointer-events:all; }
.god-pulse {
  width:8px;height:8px;border-radius:99px;flex-shrink:0;
  background:linear-gradient(135deg,#7F77DD,#D4537E);
  animation:godpulse 1.4s infinite;
}
@keyframes godpulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.5;transform:scale(1.3);}}

/* Grid dot canvas */
#god-dot-canvas {
  position:fixed;inset:0;pointer-events:none;
  z-index:1;opacity:0;transition:opacity .3s;
}
body.god-active #god-dot-canvas { opacity:1; }

/* Island wrapper — always present, effects only in god mode */
.gm-island {
  position:relative;
  border-radius:var(--radius-lg);
  transition:outline .15s, box-shadow .15s;
}
body.god-active .gm-island {
  outline:1.5px dashed transparent;
  cursor:default;
}
body.god-active .gm-island:hover {
  outline-color:rgba(127,119,221,0.5);
  box-shadow:0 0 0 4px rgba(127,119,221,0.08);
  z-index:10;
}
body.god-active .gm-island.is-dragging { opacity:0.4; }
body.god-active .gm-island.drop-target {
  outline-color:var(--accent);
  background:var(--accent-light);
  box-shadow:0 0 0 4px rgba(29,158,117,0.12);
}

/* Drag handle */
.gm-handle {
  display:none;position:absolute;top:7px;left:7px;z-index:20;
  width:24px;height:24px;border-radius:7px;
  background:var(--purple);color:#fff;
  cursor:grab;align-items:center;justify-content:center;
  font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.2);
  user-select:none;
}
.gm-handle:active { cursor:grabbing; }
body.god-active .gm-island:hover .gm-handle { display:flex; }

/* Resize grip */
.gm-resize {
  display:none;position:absolute;bottom:5px;right:5px;z-index:20;
  width:14px;height:14px;cursor:se-resize;
  border-right:3px solid var(--purple);border-bottom:3px solid var(--purple);
  border-radius:0 0 3px 0;opacity:.8;
}
body.god-active .gm-island:hover .gm-resize { display:block; }

/* Island label */
.gm-label {
  display:none;position:absolute;top:7px;right:7px;z-index:20;
  font-size:9px;padding:2px 8px;border-radius:99px;
  background:rgba(127,119,221,0.18);color:var(--purple);
  font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  pointer-events:none;
}
body.god-active .gm-island:hover .gm-label { display:block; }

/* Tab grid layout */
.gm-grid {
  display:grid;
  grid-template-columns:repeat(24,1fr);
  gap:14px;
  align-items:start;
  grid-auto-flow:dense;
}

/* Cash flow calendar */
.cf-cal-outer { margin-bottom:0; }
.cf-cal-grid {
  display:grid;
  grid-template-columns:repeat(7,1fr);
  gap:3px;
}
.cf-day-hdr {
  text-align:center;font-size:9px;font-weight:700;
  color:var(--text3);text-transform:uppercase;
  letter-spacing:.06em;padding:3px 0 5px;
}
.cf-day {
  min-height:62px;border-radius:7px;
  border:1px solid var(--border2);background:var(--surface2);
  padding:5px 5px 4px;cursor:pointer;transition:all .15s;
  position:relative;overflow:hidden;
}
.cf-day:hover { border-color:var(--accent);background:var(--accent-light); }
.cf-day.today {
  border-color:var(--accent);background:var(--accent-light);
  box-shadow:0 0 0 2px rgba(29,158,117,0.18);
}
.cf-day.active-day { outline:2px solid var(--accent); }
.cf-day.has-inc  { border-left:3px solid var(--accent); }
.cf-day.has-exp  { border-left:3px solid var(--danger); }
.cf-day.has-both { border-left:3px solid var(--purple); }
.cf-day-num {
  font-size:10px;font-weight:700;color:var(--text2);margin-bottom:3px;
}
.cf-day.today .cf-day-num { color:var(--accent);font-size:11px; }
.cf-pill {
  font-size:8px;padding:1px 4px;border-radius:3px;
  margin-bottom:1px;display:block;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  font-weight:600;line-height:1.4;
}
.cf-pill.inc { background:var(--accent-light);color:var(--accent-dark); }
.cf-pill.exp { background:var(--danger-light);color:var(--danger); }
.cf-more { font-size:8px;color:var(--text3);margin-top:1px; }
.cf-detail {
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-lg);padding:14px;
  margin-top:12px;display:none;
}
.cf-detail.open { display:block; }
.cf-detail-item {
  display:flex;align-items:center;gap:8px;padding:8px 10px;
  border-radius:var(--radius);background:var(--surface2);
  margin-bottom:6px;font-size:12px;
}
.cf-mark {
  margin-left:auto;font-size:10px;padding:2px 8px;
  border-radius:99px;border:1px solid var(--border);
  background:none;color:var(--text2);cursor:pointer;font-family:inherit;
  transition:all .15s;flex-shrink:0;
}
.cf-mark:hover,.cf-mark.paid {
  background:var(--accent-light);color:var(--accent);border-color:var(--accent);
}
.cf-legend {
  display:flex;gap:14px;flex-wrap:wrap;font-size:10px;
  color:var(--text2);padding-top:10px;border-top:1px solid var(--border2);
  margin-top:10px;
}
.cf-legend-dot {
  display:inline-block;width:10px;height:10px;
  border-radius:2px;margin-right:4px;vertical-align:middle;
}

/* History bank delete button */
.bank-x {
  width:20px;height:20px;border-radius:99px;border:none;
  background:var(--danger-light);color:var(--danger);
  cursor:pointer;display:inline-flex;align-items:center;
  justify-content:center;font-size:10px;flex-shrink:0;
  transition:all .15s;margin-left:4px;font-family:inherit;
}
.bank-x:hover { background:var(--danger);color:#fff; }

/* Mobile: disable god mode */
@media(max-width:900px){
  .god-btn { display:none !important; }
  .gm-grid { display:block !important; }
  .gm-handle,.gm-resize { display:none !important; }
}
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
// STEP 3 — WRAP ISLANDS & BUILD GRIDS
// ═══════════════════════════════════════════════════════════════
function buildTabGrids() {
  Object.entries(TAB_ISLANDS).forEach(([tabId, islands]) => {
    const tabEl = document.getElementById('tab-' + tabId);
    if (!tabEl) return;

    // Create or find the grid container
    let grid = document.getElementById('gm-grid-' + tabId);
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'gm-grid';
      grid.id = 'gm-grid-' + tabId;
      // Move all direct children of tab into grid
      Array.from(tabEl.children).forEach(c => grid.appendChild(c));
      tabEl.appendChild(grid);
    }

    islands.forEach(def => {
      const el = document.getElementById(def.id);
      if (!el) return;

      // Wrap in island div if not already
      let wrapper = el.closest('.gm-island');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'gm-island';
        wrapper.dataset.islandId  = def.id;
        wrapper.dataset.islandTab = tabId;
        el.parentNode.insertBefore(wrapper, el);
        wrapper.appendChild(el);
        // Controls
        const handle = document.createElement('div');
        handle.className = 'gm-handle';
        handle.innerHTML = '<i class="ti ti-grip-vertical"></i>';
        handle.title = 'Drag to move';
        const grip = document.createElement('div');
        grip.className = 'gm-resize';
        grip.title = 'Drag corner to resize';
        const label = document.createElement('div');
        label.className = 'gm-label';
        label.textContent = def.label;
        wrapper.appendChild(handle);
        wrapper.appendChild(grip);
        wrapper.appendChild(label);
      }

      // Move wrapper into grid if not there
      if (wrapper.parentElement !== grid) grid.appendChild(wrapper);

      // Apply grid position
      applyPos(wrapper, tabId, def);
    });
  });
}

function applyPos(wrapper, tabId, def) {
  const saved = (layoutConfig[tabId] || {})[def.id];
  const p = saved || def;
  wrapper.style.gridColumn = `${p.col} / span ${p.w}`;
  wrapper.style.gridRow    = `${p.row} / span ${p.h}`;
  if (p.h > 1) wrapper.style.minHeight = (p.h * GRID_ROW_H) + 'px';
}

// ═══════════════════════════════════════════════════════════════
// STEP 4 — GOD MODE TOGGLE
// ═══════════════════════════════════════════════════════════════
function toggleGodMode() {
  godMode = !godMode;
  document.body.classList.toggle('god-active', godMode);
  const btn = document.getElementById('god-btn');
  if (btn) {
    btn.classList.toggle('active', godMode);
    btn.innerHTML = godMode
      ? '<i class="ti ti-lock-open"></i> God mode'
      : '<i class="ti ti-adjustments"></i> Configure';
  }
  const bar = document.getElementById('god-bar');
  if (bar) bar.classList.toggle('visible', godMode);

  if (godMode) {
    drawDotGrid();
    bindDrag();
  } else {
    const c = document.getElementById('god-dot-canvas');
    if (c) c.style.opacity = '0';
    unbindDrag();
    persistLayout();
  }
}
window.toggleGodMode = toggleGodMode;

function drawDotGrid() {
  let cv = document.getElementById('god-dot-canvas');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'god-dot-canvas';
    document.body.appendChild(cv);
  }
  cv.width  = window.innerWidth;
  cv.height = Math.max(document.body.scrollHeight, window.innerHeight);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const cw = cv.width / GRID_COLS;
  ctx.fillStyle = 'rgba(127,119,221,0.15)';
  for (let c = 0; c <= GRID_COLS; c++) {
    for (let r = 0; r * GRID_ROW_H < cv.height + GRID_ROW_H; r++) {
      ctx.beginPath();
      ctx.arc(c * cw, r * GRID_ROW_H, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  cv.style.opacity = '1';
}

// ═══════════════════════════════════════════════════════════════
// STEP 5 — DRAG (absolute positioning during drag, snap on drop)
// ═══════════════════════════════════════════════════════════════
function bindDrag() {
  document.querySelectorAll('.gm-handle').forEach(h => {
    h.addEventListener('mousedown', startDrag);
    h.addEventListener('touchstart', startDrag, { passive: false });
  });
  document.querySelectorAll('.gm-resize').forEach(g => {
    g.addEventListener('mousedown', startResize);
  });
}
function unbindDrag() {
  document.querySelectorAll('.gm-handle').forEach(h => {
    h.removeEventListener('mousedown', startDrag);
    h.removeEventListener('touchstart', startDrag);
  });
  document.querySelectorAll('.gm-resize').forEach(g => {
    g.removeEventListener('mousedown', startResize);
  });
}

function startDrag(e) {
  if (!godMode) return;
  e.preventDefault();
  const wrapper = e.currentTarget.closest('.gm-island');
  if (!wrapper) return;
  const grid = wrapper.closest('.gm-grid');
  if (!grid) return;
  const gridRect = grid.getBoundingClientRect();
  const wRect    = wrapper.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;

  wrapper.classList.add('is-dragging');
  dragState = {
    wrapper, grid, gridRect,
    offsetX: cx - wRect.left,
    offsetY: cy - wRect.top,
    origCol: parseStart(wrapper.style.gridColumn),
    origRow: parseStart(wrapper.style.gridRow),
    origW:   parseSpan(wrapper.style.gridColumn),
    origH:   parseSpan(wrapper.style.gridRow),
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
  const { wrapper, grid, offsetX, offsetY, origW, origH } = dragState;
  const gridRect = grid.getBoundingClientRect();
  const cw = gridRect.width / GRID_COLS;
  // Where the top-left of the island would land
  const relX = cx - offsetX - gridRect.left + grid.scrollLeft;
  const relY = cy - offsetY - gridRect.top  + window.scrollY;
  let newCol = Math.max(1, Math.min(GRID_COLS - origW + 1, Math.round(relX / cw) + 1));
  let newRow = Math.max(1, Math.round(relY / GRID_ROW_H) + 1);
  wrapper.style.gridColumn = `${newCol} / span ${origW}`;
  wrapper.style.gridRow    = `${newRow} / span ${origH}`;
}

function endDrag(e) {
  if (!dragState) return;
  const { wrapper } = dragState;
  wrapper.classList.remove('is-dragging');
  saveIslandPos(wrapper);
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup',   endDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend',  endDrag);
  dragState = null;
}

function startResize(e) {
  if (!godMode) return;
  e.preventDefault();
  const wrapper = e.currentTarget.closest('.gm-island');
  if (!wrapper) return;
  const grid = wrapper.closest('.gm-grid');
  if (!grid) return;
  resizeState = {
    wrapper, grid,
    startX: e.clientX, startY: e.clientY,
    startW: parseSpan(wrapper.style.gridColumn),
    startH: parseSpan(wrapper.style.gridRow),
    startCol: parseStart(wrapper.style.gridColumn),
    startRow: parseStart(wrapper.style.gridRow),
  };
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup',   endResize);
}

function onResize(e) {
  if (!resizeState) return;
  const { wrapper, grid, startX, startY, startW, startH, startCol, startRow } = resizeState;
  const gridRect = grid.getBoundingClientRect();
  const cw = gridRect.width / GRID_COLS;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  const newW = Math.max(3, Math.min(GRID_COLS - startCol + 1, startW + Math.round(dx / cw)));
  const newH = Math.max(1, startH + Math.round(dy / GRID_ROW_H));
  wrapper.style.gridColumn = `${startCol} / span ${newW}`;
  wrapper.style.gridRow    = `${startRow} / span ${newH}`;
  wrapper.style.minHeight  = (newH * GRID_ROW_H) + 'px';
}

function endResize(e) {
  if (!resizeState) return;
  saveIslandPos(resizeState.wrapper);
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup',   endResize);
  resizeState = null;
}

function saveIslandPos(wrapper) {
  const id  = wrapper.dataset.islandId;
  const tab = wrapper.dataset.islandTab;
  if (!id || !tab) return;
  if (!layoutConfig[tab]) layoutConfig[tab] = {};
  layoutConfig[tab][id] = {
    col: parseStart(wrapper.style.gridColumn),
    row: parseStart(wrapper.style.gridRow),
    w:   parseSpan(wrapper.style.gridColumn),
    h:   parseSpan(wrapper.style.gridRow),
  };
}

// ─── helpers ────────────────────────────────────────────────────
function parseStart(v) { const m = (v||'').match(/^(\d+)/);   return m ? +m[1] : 1; }
function parseSpan(v)  { const m = (v||'').match(/span\s+(\d+)/); return m ? +m[1] : 1; }

// ═══════════════════════════════════════════════════════════════
// STEP 6 — PERSIST & LOAD LAYOUT
// ═══════════════════════════════════════════════════════════════
function persistLayout() {
  try { localStorage.setItem(LS_LAYOUT, JSON.stringify(layoutConfig)); } catch(e) {}
  if (window.__LAYOUT_CONFIG__ !== undefined) window.__LAYOUT_CONFIG__ = layoutConfig;
  // Inject into main captureState if available
  if (typeof window.markDirty === 'function') window.markDirty();
}

function loadLayout() {
  // 1. From baked __BP_STATE__
  if (window.__BP_STATE__?.layoutConfig) {
    layoutConfig = window.__BP_STATE__.layoutConfig; return;
  }
  // 2. From localStorage
  try {
    const raw = localStorage.getItem(LS_LAYOUT);
    if (raw) { layoutConfig = JSON.parse(raw); return; }
  } catch(e) {}
  layoutConfig = {};
}

function resetLayout() {
  if (!confirm('Reset all layouts to defaults?')) return;
  layoutConfig = {};
  try { localStorage.removeItem(LS_LAYOUT); } catch(e) {}
  buildTabGrids();
  alert('Layout reset.');
}
window.resetLayout = resetLayout;

// ═══════════════════════════════════════════════════════════════
// STEP 7 — INJECT GOD BUTTON + BAR
// ═══════════════════════════════════════════════════════════════
function injectGodUI() {
  if (document.getElementById('god-btn')) return;
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;
  const btn = document.createElement('button');
  btn.id = 'god-btn';
  btn.className = 'god-btn';
  btn.innerHTML = '<i class="ti ti-adjustments"></i> Configure';
  btn.onclick = toggleGodMode;
  navRight.insertBefore(btn, navRight.firstChild);

  const bar = document.createElement('div');
  bar.id = 'god-bar';
  bar.className = 'god-bar';
  bar.innerHTML = `
    <div class="god-pulse"></div>
    <span style="font-weight:700;color:var(--purple);">God mode</span>
    <span>Drag <i class="ti ti-grip-vertical" style="font-size:10px;"></i> to move &nbsp;·&nbsp; Corner grip to resize</span>
    <button class="btn btn-sm" style="border-radius:99px;" onclick="resetLayout()">
      <i class="ti ti-refresh"></i> Reset
    </button>
    <button class="btn btn-sm btn-accent" style="border-radius:99px;" onclick="toggleGodMode()">
      <i class="ti ti-check"></i> Save &amp; exit
    </button>`;
  document.body.appendChild(bar);
}

// ═══════════════════════════════════════════════════════════════
// STEP 8 — CASH FLOW CALENDAR (replaces old timeline)
// ═══════════════════════════════════════════════════════════════
function buildCashFlowCalendar() {
  const cfTab = document.getElementById('tab-cashflow');
  if (!cfTab || cfTab.dataset.calBuilt) return;
  cfTab.dataset.calBuilt = '1';

  const now         = new Date();
  const month       = now.getMonth();
  const year        = now.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const today       = now.getDate();
  const MONTHS      = window.MONTHS || ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS        = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const fmtC        = window.fmtC  || (n => n);
  const toM         = window.toMonthly || (v => v);
  const fmt         = window.fmt   || (n => n);
  const getTkey     = window.getTkey || ((m,y) => `${y}-${m}`);
  const tkey        = getTkey(month, year);

  // Build day → items map
  const dayMap = {};
  (window.items || []).filter(i => i.on && i.dueDay > 0).forEach(item => {
    const d = item.dueDay;
    if (d < 1 || d > daysInMonth) return;
    if (!dayMap[d]) dayMap[d] = [];
    dayMap[d].push(item);
  });

  // ── Calendar grid HTML ──
  const dayHeaders = DAYS.map(d => `<div class="cf-day-hdr">${d}</div>`).join('');
  const emptyCells = Array(firstDay).fill('<div></div>').join('');
  const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const its = dayMap[day] || [];
    const hasInc = its.some(x => x.type === 'income');
    const hasExp = its.some(x => x.type === 'expense');
    const cls = ['cf-day',
      day === today ? 'today' : '',
      hasInc && hasExp ? 'has-both' : hasInc ? 'has-inc' : hasExp ? 'has-exp' : ''
    ].filter(Boolean).join(' ');
    const pills = its.slice(0, 2).map(it =>
      `<span class="cf-pill ${it.type === 'income' ? 'inc' : 'exp'}">
        ${it.type === 'income' ? '↑' : '↓'} ${it.name}
      </span>`).join('');
    const more = its.length > 2 ? `<div class="cf-more">+${its.length - 2} more</div>` : '';
    return `<div class="${cls}" data-day="${day}" onclick="cfDayClick(${day})">${
      `<div class="cf-day-num">${day}</div>${pills}${more}`}</div>`;
  }).join('');

  // ── Replace old timeline card ──
  let mainCard = document.getElementById('cf-main-card');
  if (!mainCard) {
    mainCard = cfTab.querySelector('.card');
    if (mainCard) mainCard.id = 'cf-main-card';
  }
  if (mainCard) {
    mainCard.innerHTML = `
      <div class="card-head">
        <span class="card-title">
          <i class="ti ti-calendar-month" style="color:var(--accent);margin-right:5px;"></i>
          ${MONTHS[month]} ${year}
        </span>
        <span id="cf-sel-label" style="font-size:11px;color:var(--text2);"></span>
      </div>
      <div class="cf-cal-grid" id="cf-cal-grid">
        ${dayHeaders}${emptyCells}${dayCells}
      </div>
      <div class="cf-detail" id="cf-detail"></div>
      <div class="cf-legend">
        <span><span class="cf-legend-dot" style="background:var(--accent);"></span>Income due</span>
        <span><span class="cf-legend-dot" style="background:var(--danger);"></span>Expense due</span>
        <span><span class="cf-legend-dot" style="background:var(--purple);"></span>Both</span>
      </div>`;
  }

  // ── Day click handler ──
  window.cfDayClick = function(day) {
    const its = dayMap[day] || [];
    const lbl = document.getElementById('cf-sel-label');
    const det = document.getElementById('cf-detail');
    if (!det) return;
    // Deselect old
    document.querySelectorAll('.cf-day.active-day').forEach(d => d.classList.remove('active-day'));
    const dayEl = document.querySelector(`.cf-day[data-day="${day}"]`);
    if (dayEl) dayEl.classList.add('active-day');
    if (!its.length) { det.classList.remove('open'); if(lbl) lbl.textContent=''; return; }
    if (lbl) lbl.textContent = `Day ${day} — ${its.length} item${its.length > 1 ? 's' : ''}`;
    const td = (window.trackerData && window.trackerData[tkey]) || {};
    const getDays = window.getDaysUntil || (() => null);
    det.classList.add('open');
    det.innerHTML = `
      <div class="card-head" style="margin-bottom:10px;">
        <span class="card-title">Day ${day}</span>
        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('cf-detail').classList.remove('open');document.getElementById('cf-sel-label').textContent=''">✕</button>
      </div>
      ${its.map(item => {
        const mv  = Math.round(toM(item.val, item.freq));
        const key = (item.type === 'income' ? 'inc_' : 'exp_') + item.id;
        const paid = td[key] !== undefined && td[key] !== '';
        const d   = getDays(item.dueDay);
        const urgCls = d === 0 ? 'color:var(--danger)' : d !== null && d <= 3 ? 'color:var(--warning)' : 'color:var(--text3)';
        const urgTxt = d === null ? '' : d === 0 ? 'TODAY' : d + 'd';
        return `<div class="cf-detail-item">
          <div class="owner-dot ${item.owner||'shared'}"></div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:500;">${item.name}</div>
            <div style="font-size:10px;color:var(--text2);">${item.type} · ${item.owner||'shared'} · ${item.tag||''}</div>
          </div>
          <span style="font-size:14px;font-weight:700;color:${item.type==='income'?'var(--accent)':'var(--danger)'};">${fmtC(mv)}</span>
          ${urgTxt ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--surface3);${urgCls}">${urgTxt}</span>` : ''}
          <button class="cf-mark ${paid?'paid':''}" onclick="cfMarkPaid('${item.id}','${item.type}','${tkey}',this,${mv})">
            ${paid ? '✓ Paid' : 'Mark paid'}
          </button>
        </div>`;
      }).join('')}`;
  };

  window.cfMarkPaid = function(itemId, type, tkey, btn, val) {
    if (!window.trackerData) window.trackerData = {};
    if (!window.trackerData[tkey]) window.trackerData[tkey] = {};
    const key = (type === 'income' ? 'inc_' : 'exp_') + itemId;
    const wasPaid = btn.classList.contains('paid');
    if (wasPaid) { delete window.trackerData[tkey][key]; btn.classList.remove('paid'); btn.textContent = 'Mark paid'; }
    else { window.trackerData[tkey][key] = val; btn.classList.add('paid'); btn.textContent = '✓ Paid'; }
    if (typeof window.markDirty === 'function') window.markDirty();
  };
}

// Re-render calendar when switching to cashflow (items may have changed)
function patchShowTab() {
  const orig = window.showTab;
  if (!orig || window._patchedShowTab) return;
  window._patchedShowTab = true;
  window.showTab = function(t) {
    orig(t);
    if (t === 'cashflow') {
      // Allow time for tab to become visible
      setTimeout(() => {
        const cfTab = document.getElementById('tab-cashflow');
        if (cfTab) delete cfTab.dataset.calBuilt; // force rebuild with latest items
        buildCashFlowCalendar();
        // Re-apply grid positions for this tab
        buildTabGrids();
      }, 60);
    } else {
      setTimeout(() => buildTabGrids(), 60);
    }
    // If god mode is on, rebind drag handles for newly visible tab
    if (godMode) setTimeout(bindDrag, 120);
  };
}

// ═══════════════════════════════════════════════════════════════
// STEP 9 — HISTORY BANK DELETE (inject after each render)
// ═══════════════════════════════════════════════════════════════
function patchHistoryBank() {
  const orig = window.renderHistoryBank;
  if (!orig || window._patchedBank) return;
  window._patchedBank = true;

  window.renderHistoryBank = function() {
    orig();
    addBankDeleteButtons();
  };

  // Also add to renderInsights patch
  const origInsights = window.renderInsights;
  if (origInsights) {
    window.renderInsights = function() {
      origInsights();
      setTimeout(addBankDeleteButtons, 50);
    };
  }
}

function addBankDeleteButtons() {
  const list = document.getElementById('history-bank-list');
  if (!list) return;
  list.querySelectorAll('.history-bank-item').forEach(item => {
    if (item.querySelector('.bank-x')) return; // already has button

    // Determine month key from the item's text or existing onclick
    let monthKey = null;
    const resolveBtn = item.querySelector('button[onclick*="openConflictModal"]');
    if (resolveBtn) {
      const m = resolveBtn.getAttribute('onclick').match(/openConflictModal\('([^']+)'\)/);
      if (m) monthKey = m[1];
    }
    if (!monthKey) {
      // Try to derive from the label text (e.g. "Apr 2025")
      const span = item.querySelector('span[style*="font-weight"]');
      if (span && window.insightHistory) {
        const txt = span.textContent.trim();
        const MS = window.MS || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        monthKey = Object.keys(window.insightHistory).find(k => {
          const [y, mi] = k.split('-');
          return (MS[+mi] + ' ' + y) === txt;
        });
      }
    }
    if (!monthKey) return;

    const btn = document.createElement('button');
    btn.className = 'bank-x';
    btn.title = 'Delete this month from bank';
    btn.innerHTML = '<i class="ti ti-x" style="font-size:9px;"></i>';
    btn.onclick = e => { e.stopPropagation(); deleteBankMonth(monthKey); };
    item.appendChild(btn);
  });
}

function deleteBankMonth(key) {
  const [y, mi] = key.split('-');
  const MS = window.MS || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const label = (MS[+mi] || mi) + ' ' + y;
  if (!confirm(`Delete ${label} from History Bank?\n\nThis removes the month's tracker actuals, history snapshot, and bank entry. Cannot be undone.`)) return;
  if (window.insightHistory)  delete window.insightHistory[key];
  if (window.pendingConflicts) delete window.pendingConflicts[key];
  if (window.trackerData)      delete window.trackerData[key];
  if (window.monthHistory)     delete window.monthHistory[key];
  if (window.monthNotes)       delete window.monthNotes[key];
  if (typeof window.markDirty === 'function') window.markDirty();
  if (typeof window.renderInsights === 'function') window.renderInsights();
  if (typeof window.buildNotifications === 'function') window.buildNotifications();
}

// ═══════════════════════════════════════════════════════════════
// STEP 10 — PATCH captureState TO SAVE LAYOUT
// ═══════════════════════════════════════════════════════════════
function patchState() {
  const origCapture = window.captureState;
  const origApply   = window.applyState;
  if (origCapture && !window._patchedCapture) {
    window._patchedCapture = true;
    window.captureState = function() {
      const s = origCapture();
      s.layoutConfig = layoutConfig;
      return s;
    };
  }
  if (origApply && !window._patchedApply) {
    window._patchedApply = true;
    window.applyState = function(s) {
      origApply(s);
      if (s?.layoutConfig) {
        layoutConfig = s.layoutConfig;
        buildTabGrids(); // re-apply saved positions
      }
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
function init() {
  injectStyles();
  loadLayout();
  addMissingIds();
  buildTabGrids();
  injectGodUI();
  buildCashFlowCalendar();
  patchHistoryBank();
  patchShowTab();
  patchState();
  // Add delete buttons after first insights render (delayed because insights
  // renders on tab switch, not on load)
  const insightsOrig = window.renderInsights;
  if (insightsOrig && !window._patchedIns) {
    window._patchedIns = true;
    window.renderInsights = function() {
      insightsOrig();
      setTimeout(addBankDeleteButtons, 80);
    };
  }
  console.log('[patch v3] ✓ God mode, calendar, bank delete — all active');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 120));
} else {
  setTimeout(init, 120);
}

})();
