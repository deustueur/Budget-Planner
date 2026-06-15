// ═══════════════════════════════════════════════════════════════════
// BUDGET PLANNER — PATCH v3
// Fixes: Absolute-canvas God Mode, Cash Flow calendar, history bank delete
// ═══════════════════════════════════════════════════════════════════

(function(){
'use strict';

// ─── CONSTANTS ──────────────────────────────────────────────────
const GRID_COLS = 24;
const GRID_ROW_H = 80; // px per row unit
const GOD_STORAGE_KEY = 'bp_layout_v1';

// ─── STATE ──────────────────────────────────────────────────────
let godMode = false;
let godCanvas = null;  // Fixed absolute canvas overlay for dragging
let layoutConfig = {}; // { tabId: { islandId: {col,row,w,h} } }
let dragState = null;  // active drag info
let resizeState = null;

// Default island definitions per tab
const ISLAND_DEFAULTS = {
  dashboard: [
    { id:'dash-metrics',    label:'Metrics',          col:1,  row:1, w:24, h:2 },
    { id:'dash-bar',        label:'Budget bar',       col:1,  row:3, w:24, h:1 },
    { id:'income-card',     label:'Income',           col:1,  row:4, w:12, h:6 },
    { id:'expense-card',    label:'Expenses',         col:13, row:4, w:12, h:6 },
    { id:'dash-cat-chart',  label:'Category chart',   col:1,  row:10,w:12, h:4 },
    { id:'dash-global',     label:'All items',        col:13, row:10,w:12, h:4 },
    { id:'dash-savings-panel', label:'Tagged savings',col:1,  row:14,w:24, h:3 },
  ],
  cashflow: [
    { id:'cf-calendar-island', label:'Calendar',      col:1,  row:1, w:24, h:7 },
    { id:'cf-due-island',      label:'Due soon',      col:1,  row:8, w:12, h:4 },
    { id:'cf-tax-island',      label:'Tax estimator', col:13, row:8, w:12, h:4 },
  ],
  tracker: [
    { id:'tracker-island', label:'Tracker',           col:1,  row:1, w:24, h:12 },
  ],
  events: [
    { id:'events-island',  label:'Events',            col:1,  row:1, w:24, h:10 },
  ],
  savings: [
    { id:'savings-metrics-island', label:'Metrics',   col:1,  row:1, w:24, h:2 },
    { id:'savings-settlement',     label:'Settlement',col:1,  row:3, w:12, h:3 },
    { id:'savings-projections-island',label:'Goals',  col:13, row:3, w:12, h:3 },
    { id:'savings-grid-island',    label:'Streams',   col:1,  row:6, w:24, h:6 },
  ],
  instruments: [
    { id:'instr-metrics-island',   label:'Metrics',   col:1,  row:1, w:24, h:2 },
    { id:'instr-grid-island',      label:'Instruments',col:1, row:3, w:24, h:9 },
  ],
  insights: [
    { id:'nw-island',         label:'Net worth',      col:1,  row:1, w:24, h:3 },
    { id:'history-island',    label:'History',        col:1,  row:4, w:14, h:5 },
    { id:'bank-island',       label:'History bank',   col:15, row:4, w:10, h:5 },
    { id:'import-island',     label:'Import',         col:1,  row:9, w:14, h:6 },
    { id:'suggestions-island',label:'AI suggestions', col:15, row:9, w:10, h:3 },
    { id:'velocity-island',   label:'Savings velocity',col:15,row:12,w:10, h:3 },
    { id:'person-charts-island',label:'Person trends',col:1, row:15,w:24, h:4 },
    { id:'templates-island',  label:'Templates',      col:1, row:19,w:24, h:3 },
  ],
};

// ─── INJECT STYLES ──────────────────────────────────────────────
function injectStyles() {
  const s = document.createElement('style');
  s.id = 'patch-styles';
  s.textContent = `
/* ── God mode button ── */
.god-mode-btn {
  display:inline-flex;align-items:center;gap:5px;
  padding:5px 11px;border-radius:var(--radius);font-size:12px;
  cursor:pointer;border:1px solid var(--border);
  background:var(--surface);color:var(--text);
  transition:all .2s;font-family:inherit;white-space:nowrap;
}
.god-mode-btn.active {
  background:linear-gradient(135deg,#7F77DD,#D4537E);
  color:#fff;border-color:transparent;
  box-shadow:0 0 0 3px rgba(127,119,221,0.25);
}
.god-mode-btn i { font-size:13px; }

/* ── God mode floating bar ── */
.god-bar {
  position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
  background:var(--surface);border:1px solid var(--border);
  border-radius:99px;padding:8px 16px;
  display:flex;align-items:center;gap:10px;
  box-shadow:0 8px 32px rgba(0,0,0,0.25);z-index:1000;
  font-size:12px;color:var(--text2);
  opacity:0;pointer-events:none;transition:opacity .2s;
}
.god-bar.visible { opacity:1;pointer-events:all; }
.god-bar-dot {
  width:8px;height:8px;border-radius:99px;
  background:linear-gradient(135deg,#7F77DD,#D4537E);
  animation:pulse 1.5s infinite;
}

/* ── Island wrappers in god mode ── */
.island-wrapper {
  position:relative;
  transition:box-shadow .15s;
}
.god-active .island-wrapper {
  outline:2px dashed transparent;
  border-radius:var(--radius-lg);
  transition:outline .15s,box-shadow .15s;
}
.god-active .island-wrapper:hover {
  outline-color:var(--purple);
  box-shadow:0 0 0 4px rgba(127,119,221,0.12);
}
.god-active .island-wrapper.dragging {
  opacity:0.9;
  outline-color:var(--accent);
  box-shadow: 0 12px 40px rgba(0,0,0,0.3);
  z-index:999 !important;
}

/* Drag handle */
.island-handle {
  display:none;position:absolute;top:6px;left:6px;z-index:20;
  width:22px;height:22px;border-radius:6px;
  background:var(--purple);color:#fff;
  cursor:grab;align-items:center;justify-content:center;
  font-size:11px;box-shadow:var(--shadow);
  user-select:none;
}
.island-handle:active { cursor:grabbing; }
.god-active .island-wrapper:hover .island-handle { display:flex; }

/* Resize grip */
.island-resize {
  display:none;position:absolute;bottom:4px;right:4px;z-index:20;
  width:16px;height:16px;cursor:se-resize;
  border-right:3px solid var(--purple);border-bottom:3px solid var(--purple);
  border-radius:0 0 4px 0;opacity:.7;
}
.god-active .island-wrapper:hover .island-resize { display:block; }

/* Island label badge */
.island-label {
  display:none;position:absolute;top:6px;right:6px;z-index:20;
  font-size:9px;padding:2px 7px;border-radius:99px;
  background:rgba(127,119,221,0.15);color:var(--purple);
  font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  pointer-events:none;
}
.god-active .island-wrapper:hover .island-label { display:block; }

/* ── Absolute God Canvas Overlay ── */
.god-canvas {
  pointer-events: none; /* Ignore clicks on empty space */
}
.god-canvas .island-wrapper {
  pointer-events: auto; /* Allow interactions on the islands */
  z-index: 10;
  background: var(--bg);
}

/* ── Grid canvas (background subtle dots) ── */
.god-grid-canvas {
  position:fixed;inset:0;pointer-events:none;z-index:1;
  opacity:0;transition:opacity .3s;
}
.god-active .god-grid-canvas { opacity:1; }

/* ── Auto-fill grid layouts (default, no explicit positions) ── */
.island-grid {
  display:grid;
  grid-template-columns:repeat(24,1fr);
  gap:14px;
  align-items:start;
}

/* ── Cash flow calendar ── */
.cf-cal-grid {
  display:grid;
  grid-template-columns:repeat(7,1fr);
  gap:4px;
  margin-bottom:14px;
}
.cf-cal-day {
  min-height:64px;border-radius:8px;
  border:1px solid var(--border2);
  background:var(--surface2);
  padding:5px 6px;cursor:pointer;
  transition:all .15s;position:relative;
}
.cf-cal-day:hover { border-color:var(--accent);background:var(--accent-light); }
.cf-cal-day.today {
  border-color:var(--accent);
  background:var(--accent-light);
  box-shadow:0 0 0 2px rgba(29,158,117,0.2);
}
.cf-cal-day.has-income { border-left:3px solid var(--accent); }
.cf-cal-day.has-expense { border-left:3px solid var(--danger); }
.cf-cal-day.has-both {
  border-left:3px solid transparent;
  border-image:linear-gradient(var(--accent),var(--danger)) 1;
}
.cf-cal-day-num {
  font-size:11px;font-weight:700;color:var(--text2);margin-bottom:4px;
}
.cf-cal-day.today .cf-cal-day-num { color:var(--accent); }
.cf-cal-pill {
  font-size:9px;padding:1px 5px;border-radius:4px;
  margin-bottom:2px;display:block;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  font-weight:500;
}
.cf-cal-pill.income { background:var(--accent-light);color:var(--accent-dark); }
.cf-cal-pill.expense { background:var(--danger-light);color:var(--danger); }
.cf-cal-more {
  font-size:9px;color:var(--text3);margin-top:1px;
}
.cf-day-header {
  text-align:center;font-size:10px;font-weight:700;
  color:var(--text3);text-transform:uppercase;
  letter-spacing:.06em;padding:4px 0;
}
.cf-detail-panel {
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-lg);padding:14px;
  margin-bottom:14px;display:none;
}
.cf-detail-panel.open { display:block; }
.cf-detail-item {
  display:flex;align-items:center;gap:8px;
  padding:8px 10px;border-radius:var(--radius);
  background:var(--surface2);margin-bottom:6px;
  font-size:12px;
}
.cf-mark-paid {
  margin-left:auto;font-size:10px;padding:2px 8px;
  border-radius:99px;border:1px solid var(--border);
  background:none;color:var(--text2);cursor:pointer;
  font-family:inherit;transition:all .15s;
}
.cf-mark-paid:hover { background:var(--accent-light);color:var(--accent);border-color:var(--accent); }
.cf-mark-paid.paid { background:var(--accent-light);color:var(--accent);border-color:var(--accent); }

/* ── History bank delete ── */
.bank-delete-btn {
  width:22px;height:22px;border-radius:99px;border:none;
  background:var(--danger-light);color:var(--danger);
  cursor:pointer;display:flex;align-items:center;
  justify-content:center;font-size:11px;flex-shrink:0;
  transition:all .15s;
}
.bank-delete-btn:hover { background:var(--danger);color:#fff; }

/* ── Responsive: no god mode on mobile ── */
@media(max-width:900px){
  .god-mode-btn { display:none; }
  .island-grid { display:block; }
}
  `;
  document.head.appendChild(s);
}

// ─── WRAP ISLANDS ───────────────────────────────────────────────
// Wraps each known island element in a div.island-wrapper
function wrapIslands() {
  Object.entries(ISLAND_DEFAULTS).forEach(([tabId, islands]) => {
    islands.forEach(def => {
      const el = document.getElementById(def.id);
      if (!el || el.closest('.island-wrapper')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'island-wrapper';
      wrapper.dataset.island = def.id;
      wrapper.dataset.tab = tabId;
      
      const handle = document.createElement('div');
      handle.className = 'island-handle';
      handle.innerHTML = '<i class="ti ti-grip-vertical"></i>';
      handle.title = 'Drag to move';
      
      const grip = document.createElement('div');
      grip.className = 'island-resize';
      grip.title = 'Drag to resize';
      
      const label = document.createElement('div');
      label.className = 'island-label';
      label.textContent = def.label;
      
      el.parentNode.insertBefore(wrapper, el);
      wrapper.appendChild(el);
      wrapper.appendChild(handle);
      wrapper.appendChild(grip);
      wrapper.appendChild(label);
    });
  });
  rebuildDashboardGrid();
}

// ─── REBUILD DASHBOARD GRID (gravity fill) ──────────────────────
function rebuildDashboardGrid() {
  const tab = document.getElementById('tab-dashboard');
  if (!tab) return;
  let grid = tab.querySelector('.island-grid#dash-island-grid');
  if (!grid) {
    grid = document.createElement('div');
    grid.className = 'island-grid';
    grid.id = 'dash-island-grid';
    tab.appendChild(grid);
  }
  applyDefaultGridPositions('dashboard', grid);
}

// ─── APPLY GRID POSITIONS ───────────────────────────────────────
function applyDefaultGridPositions(tabId, container) {
  const islands = ISLAND_DEFAULTS[tabId];
  if (!islands || !container) return;
  const saved = layoutConfig[tabId] || {};
  islands.forEach(def => {
    const wrapper = document.querySelector(`.island-wrapper[data-island="${def.id}"]`);
    if (!wrapper) return;
    const pos = saved[def.id] || def;
    const col = pos.col || def.col;
    const row = pos.row || def.row;
    const w   = pos.w   || def.w;
    const h   = pos.h   || def.h;
    
    wrapper.style.gridColumn = `${col} / span ${w}`;
    wrapper.style.gridRow    = `${row} / span ${h}`;
    if (h > 1) wrapper.style.minHeight = (h * GRID_ROW_H) + 'px';
    
    // Move into grid container and intelligently hide abandoned legacy containers
    if (wrapper.parentElement !== container) {
      const oldParent = wrapper.parentElement;
      container.appendChild(wrapper);
      if (oldParent && oldParent.children.length === 0 && !oldParent.classList.contains('page')) {
        oldParent.style.display = 'none'; // Resolves Root Cause 1 entirely
      }
    }
  });
}

// ─── GOD MODE TOGGLE (The Absolute Canvas Controller) ───────────
function toggleGodMode() {
  godMode = !godMode;
  const btn = document.getElementById('god-mode-btn');
  const bar = document.getElementById('god-bar');
  const bgCanvas = document.getElementById('god-grid-canvas');
  document.body.classList.toggle('god-active', godMode);
  
  if (btn) {
    btn.classList.toggle('active', godMode);
    btn.innerHTML = godMode
      ? '<i class="ti ti-lock-open"></i> God mode ON'
      : '<i class="ti ti-adjustments"></i> Configure';
  }
  if (bar) bar.classList.toggle('visible', godMode);

  const activeTab = document.querySelector('.page.active');
  const grid = activeTab ? activeTab.querySelector('.island-grid') : null;

  if (godMode) {
    if (!grid) return;
    drawGridCanvas();
    enterAbsoluteMode(grid);
    attachDragListeners();
  } else {
    if (godCanvas) exitAbsoluteMode(grid);
    if (bgCanvas) bgCanvas.style.opacity = '0';
    detachDragListeners();
    saveLayoutConfig();
  }
}

function enterAbsoluteMode(grid) {
  if (document.getElementById('god-canvas')) return;

  godCanvas = document.createElement('div');
  godCanvas.id = 'god-canvas';
  godCanvas.className = 'god-canvas';

  const gridRect = grid.getBoundingClientRect();
  godCanvas.style.cssText = `
    position: absolute;
    top: ${gridRect.top + window.scrollY}px;
    left: ${gridRect.left + window.scrollX}px;
    width: ${gridRect.width}px;
    height: ${gridRect.height}px;
    z-index: 100;
  `;
  document.body.appendChild(godCanvas);

  const wrappers = Array.from(grid.querySelectorAll('.island-wrapper'));
  wrappers.forEach(wrapper => {
    const rect = wrapper.getBoundingClientRect();
    
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const l = Math.round(rect.left - gridRect.left);
    const t = Math.round(rect.top - gridRect.top);

    wrapper.style.position = 'absolute';
    wrapper.style.left = l + 'px';
    wrapper.style.top = t + 'px';
    wrapper.style.width = w + 'px';
    wrapper.style.height = h + 'px';
    wrapper.style.margin = '0';

    godCanvas.appendChild(wrapper);
  });

  // Hold grid height so the page doesn't collapse
  grid.style.minHeight = gridRect.height + 'px';
}

function exitAbsoluteMode(grid) {
  if (!godCanvas) return;
  const gridRect = grid.getBoundingClientRect();
  const colW = gridRect.width / GRID_COLS;

  const wrappers = Array.from(godCanvas.querySelectorAll('.island-wrapper'));
  const tabId = grid.id.replace('-island-grid', '');

  let maxH = 0;

  wrappers.forEach(wrapper => {
    const left = parseFloat(wrapper.style.left) || 0;
    const top = parseFloat(wrapper.style.top) || 0;
    const width = parseFloat(wrapper.style.width) || 0;
    const height = parseFloat(wrapper.style.height) || 0;

    // Mathematically lock to CSS Grid dimensions
    const newCol = Math.max(1, Math.min(GRID_COLS, Math.round(left / colW) + 1));
    const newRow = Math.max(1, Math.round(top / GRID_ROW_H) + 1);
    const newW = Math.max(1, Math.round(width / colW));
    const newH = Math.max(1, Math.round(height / GRID_ROW_H));

    wrapper.style.position = '';
    wrapper.style.left = '';
    wrapper.style.top = '';
    wrapper.style.width = '';
    wrapper.style.height = '';
    wrapper.style.margin = '';

    wrapper.style.gridColumn = `${newCol} / span ${newW}`;
    wrapper.style.gridRow = `${newRow} / span ${newH}`;
    wrapper.style.minHeight = (newH * GRID_ROW_H) + 'px';

    if (newRow + newH - 1 > maxH) maxH = newRow + newH - 1;

    const islandId = wrapper.dataset.island;
    if (islandId && tabId) {
      if (!layoutConfig[tabId]) layoutConfig[tabId] = {};
      layoutConfig[tabId][islandId] = { col: newCol, row: newRow, w: newW, h: newH };
    }

    grid.appendChild(wrapper);
  });

  godCanvas.remove();
  godCanvas = null;
  grid.style.minHeight = (maxH * GRID_ROW_H) + 'px';
}

// ─── GRID CANVAS (subtle dot grid overlay) ──────────────────────
function drawGridCanvas() {
  let canvas = document.getElementById('god-grid-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'god-grid-canvas';
    canvas.className = 'god-grid-canvas';
    document.body.appendChild(canvas);
  }
  canvas.width  = window.innerWidth;
  canvas.height = document.body.scrollHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const colW = canvas.width / GRID_COLS;
  ctx.fillStyle = 'rgba(127,119,221,0.12)';
  for (let c = 0; c <= GRID_COLS; c++) {
    for (let r = 0; r * GRID_ROW_H < canvas.height; r++) {
      ctx.beginPath();
      ctx.arc(c * colW, r * GRID_ROW_H, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  canvas.style.opacity = '1';
}

// ─── ABSOLUTE DRAG AND DROP ─────────────────────────────────────
function attachDragListeners() {
  document.querySelectorAll('.island-handle').forEach(handle => {
    handle.addEventListener('mousedown', onDragStart);
    handle.addEventListener('touchstart', onDragStart, { passive: true });
  });
  document.querySelectorAll('.island-resize').forEach(grip => {
    grip.addEventListener('mousedown', onResizeStart);
  });
}

function detachDragListeners() {
  document.querySelectorAll('.island-handle').forEach(h => {
    h.removeEventListener('mousedown', onDragStart);
    h.removeEventListener('touchstart', onDragStart);
  });
  document.querySelectorAll('.island-resize').forEach(g => {
    g.removeEventListener('mousedown', onResizeStart);
  });
}

function onDragStart(e) {
  const wrapper = e.currentTarget.closest('.island-wrapper');
  if (!wrapper || !godCanvas) return;
  e.preventDefault();
  wrapper.classList.add('dragging');

  // Bring island to front of canvas
  godCanvas.appendChild(wrapper);

  dragState = {
    wrapper,
    startX: (e.touches ? e.touches[0].clientX : e.clientX),
    startY: (e.touches ? e.touches[0].clientY : e.clientY),
    initLeft: parseFloat(wrapper.style.left) || 0,
    initTop: parseFloat(wrapper.style.top) || 0
  };

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd);
}

function onDragMove(e) {
  if (!dragState) return;
  e.preventDefault();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  const dx = clientX - dragState.startX;
  const dy = clientY - dragState.startY;

  let newLeft = dragState.initLeft + dx;
  let newTop = dragState.initTop + dy;

  // Snappy visual movement relative to grid segments
  const gridRect = godCanvas.getBoundingClientRect();
  const colW = gridRect.width / GRID_COLS;
  const snapLeft = Math.round(newLeft / colW) * colW;
  const snapTop = Math.round(newTop / GRID_ROW_H) * GRID_ROW_H;

  dragState.wrapper.style.left = snapLeft + 'px';
  dragState.wrapper.style.top = snapTop + 'px';
}

function onDragEnd(e) {
  if (!dragState) return;
  dragState.wrapper.classList.remove('dragging');
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);
  dragState = null;
}

// ─── ABSOLUTE RESIZE ────────────────────────────────────────────
function onResizeStart(e) {
  const wrapper = e.currentTarget.closest('.island-wrapper');
  if (!wrapper || !godCanvas) return;
  e.preventDefault();

  godCanvas.appendChild(wrapper); // Bring to front

  resizeState = {
    wrapper,
    startX: e.clientX,
    startY: e.clientY,
    initWidth: parseFloat(wrapper.style.width) || wrapper.offsetWidth,
    initHeight: parseFloat(wrapper.style.height) || wrapper.offsetHeight
  };
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
}

function onResizeMove(e) {
  if (!resizeState) return;
  e.preventDefault();
  const dx = e.clientX - resizeState.startX;
  const dy = e.clientY - resizeState.startY;

  const gridRect = godCanvas.getBoundingClientRect();
  const colW = gridRect.width / GRID_COLS;

  const newWidth = Math.max(colW * 4, resizeState.initWidth + dx);
  const newHeight = Math.max(GRID_ROW_H, resizeState.initHeight + dy);

  const snapWidth = Math.round(newWidth / colW) * colW;
  const snapHeight = Math.round(newHeight / GRID_ROW_H) * GRID_ROW_H;

  resizeState.wrapper.style.width = snapWidth + 'px';
  resizeState.wrapper.style.height = snapHeight + 'px';
}

function onResizeEnd(e) {
  if (!resizeState) return;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  resizeState = null;
}

// ─── SAVE / LOAD LAYOUT ─────────────────────────────────────────
function saveLayoutConfig() {
  try {
    localStorage.setItem(GOD_STORAGE_KEY, JSON.stringify(layoutConfig));
  } catch(e) {}
  if (typeof captureState === 'function' && typeof markDirty === 'function') {
    window._patchLayoutInjected = true;
  }
  window.__LAYOUT_CONFIG__ = layoutConfig;
}

function loadLayoutConfig() {
  if (window.__BP_STATE__ && window.__BP_STATE__.layoutConfig) {
    layoutConfig = window.__BP_STATE__.layoutConfig;
    return;
  }
  try {
    const raw = localStorage.getItem(GOD_STORAGE_KEY);
    if (raw) { layoutConfig = JSON.parse(raw); return; }
  } catch(e) {}
  layoutConfig = {};
}

// ─── RESET LAYOUT ───────────────────────────────────────────────
function resetLayout() {
  if (!confirm('Reset layout to defaults for all tabs?')) return;
  layoutConfig = {};
  saveLayoutConfig();
  Object.entries(ISLAND_DEFAULTS).forEach(([tabId]) => {
    const grid = document.getElementById(tabId + '-island-grid') ||
                 document.querySelector(`#tab-${tabId} .island-grid`);
    if (grid) applyDefaultGridPositions(tabId, grid);
  });
  alert('Layout reset to defaults.');
}

// ─── INJECT GOD MODE BUTTON ─────────────────────────────────────
function injectGodButton() {
  const navRight = document.querySelector('.nav-right');
  if (!navRight || document.getElementById('god-mode-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'god-mode-btn';
  btn.className = 'god-mode-btn';
  btn.innerHTML = '<i class="ti ti-adjustments"></i> Configure';
  btn.onclick = toggleGodMode;
  btn.title = 'God mode — drag, resize and arrange islands';
  navRight.insertBefore(btn, navRight.firstChild);
  
  const bar = document.createElement('div');
  bar.id = 'god-bar';
  bar.className = 'god-bar';
  bar.innerHTML = `
    <div class="god-bar-dot"></div>
    <span style="font-weight:600;color:var(--purple);">God mode</span>
    <span style="color:var(--text3);">Drag handles to move · Corner grip to resize</span>
    <button class="btn btn-sm" onclick="resetLayout()" style="border-color:var(--border);">
      <i class="ti ti-refresh"></i> Reset
    </button>
    <button class="btn btn-sm btn-accent" onclick="toggleGodMode()">
      <i class="ti ti-check"></i> Save &amp; exit
    </button>
  `;
  document.body.appendChild(bar);
  window.resetLayout = resetLayout;
  window.toggleGodMode = toggleGodMode;
}

// ─── ISLAND GRID SCAFFOLDING PER TAB ────────────────────────────
function scaffoldTabGrids() {
  const tabs = Object.keys(ISLAND_DEFAULTS).filter(t => t !== 'dashboard');
  tabs.forEach(tabId => {
    const tabEl = document.getElementById('tab-' + tabId);
    if (!tabEl) return;
    let grid = tabEl.querySelector('.island-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'island-grid';
      grid.id = tabId + '-island-grid';
      Array.from(tabEl.children).forEach(child => grid.appendChild(child));
      tabEl.appendChild(grid);
    }
    applyDefaultGridPositions(tabId, grid);
  });
}

// ─── CASH FLOW CALENDAR (untouched from original patch) ──────────
function renderCashFlowCalendar() {
  const now = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const today = now.getDate();

  const dayMap = {};
  const allItems = window.items || [];
  allItems.filter(i => i.on && i.dueDay > 0).forEach(item => {
    const d = item.dueDay;
    if (d < 1 || d > daysInMonth) return;
    if (!dayMap[d]) dayMap[d] = [];
    dayMap[d].push(item);
  });

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = `
    <div class="card" style="margin-bottom:14px;">
      <div class="card-head">
        <span class="card-title">
          <i class="ti ti-calendar-month" style="color:var(--accent);margin-right:5px;"></i>
          ${window.MONTHS ? window.MONTHS[month] : ''} ${year} — Cash flow
        </span>
        <span id="cf-selected-label" style="font-size:11px;color:var(--text2);"></span>
      </div>
      <div class="cf-cal-grid" style="margin-bottom:8px;">
        ${DAYS.map(d => `<div class="cf-day-header">${d}</div>`).join('')}
        ${Array(firstDay).fill('<div></div>').join('')}
        ${Array.from({length: daysInMonth}, (_, i) => {
          const day = i + 1;
          const dayItems = dayMap[day] || [];
          const hasInc  = dayItems.some(it => it.type === 'income');
          const hasExp  = dayItems.some(it => it.type === 'expense');
          const isToday = day === today;
          const cls = [
            'cf-cal-day',
            isToday ? 'today' : '',
            hasInc && hasExp ? 'has-both' : hasInc ? 'has-income' : hasExp ? 'has-expense' : ''
          ].filter(Boolean).join(' ');
          const pills = dayItems.slice(0, 2).map(it =>
            `<span class="cf-cal-pill ${it.type}" title="${it.name}: ${window.fmtC ? window.fmtC(Math.round(window.toMonthly ? window.toMonthly(it.val, it.freq) : it.val)) : it.val}">
              ${it.type === 'income' ? '↑' : '↓'} ${it.name}
            </span>`
          ).join('');
          const more = dayItems.length > 2 ? `<div class="cf-cal-more">+${dayItems.length - 2} more</div>` : '';
          return `<div class="${cls}" onclick="openCfDayDetail(${day})" data-day="${day}">${
            '<div class="cf-cal-day-num">' + day + '</div>' + pills + more
          }</div>`;
        }).join('')}
      </div>
      <div class="cf-detail-panel" id="cf-detail-panel"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--text2);padding-top:8px;border-top:1px solid var(--border2);">
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--accent);border-radius:2px;margin-right:4px;"></span>Income due</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--danger);border-radius:2px;margin-right:4px;"></span>Expense due</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-left:3px solid var(--accent);border-bottom:3px solid var(--danger);margin-right:4px;"></span>Both</span>
      </div>
    </div>`;

  const cfTab = document.getElementById('tab-cashflow');
  if (!cfTab) return;

  const firstCard = cfTab.querySelector('.card');
  if (firstCard) {
    firstCard.outerHTML = html;
  } else {
    cfTab.insertAdjacentHTML('afterbegin', html);
  }

  window.openCfDayDetail = function(day) {
    const panel = document.getElementById('cf-detail-panel');
    const label = document.getElementById('cf-selected-label');
    if (!panel) return;
    const dayItems = dayMap[day] || [];
    document.querySelectorAll('.cf-cal-day').forEach(el => el.classList.remove('selected'));
    const selDay = document.querySelector(`.cf-cal-day[data-day="${day}"]`);
    if (selDay) selDay.style.outline = '2px solid var(--accent)';
    if (!dayItems.length) { panel.classList.remove('open'); if(label) label.textContent = ''; return; }
    if (label) label.textContent = `Day ${day} — ${dayItems.length} item${dayItems.length > 1 ? 's' : ''}`;
    const fmtC = window.fmtC || (n => n);
    const toM  = window.toMonthly || (v => v);
    const fmt  = window.fmt || (n => n);
    const now  = new Date();
    const tkey = window.getTkey ? window.getTkey(now.getMonth(), now.getFullYear()) : `${now.getFullYear()}-${now.getMonth()}`;
    const td   = (window.trackerData && window.trackerData[tkey]) || {};
    panel.classList.add('open');
    panel.innerHTML = `
      <div class="card-head" style="margin-bottom:10px;">
        <span class="card-title">Day ${day} items</span>
        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('cf-detail-panel').classList.remove('open');document.getElementById('cf-selected-label').textContent=''">✕</button>
      </div>
      ${dayItems.map(item => {
        const mv   = Math.round(toM(item.val, item.freq));
        const pKey = (item.type === 'income' ? 'inc_' : 'exp_') + item.id;
        const paid = td[pKey] !== undefined && td[pKey] !== '';
        const days = window.getDaysUntil ? window.getDaysUntil(item.dueDay) : null;
        return `<div class="cf-detail-item">
          <div class="owner-dot ${item.owner || 'shared'}"></div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:500;">${item.name}</div>
            <div style="font-size:10px;color:var(--text2);">${item.type} · ${item.owner} · ${item.tag}</div>
          </div>
          <span style="font-size:14px;font-weight:700;color:${item.type==='income'?'var(--accent)':'var(--danger)'};">${fmtC(mv)}</span>
          ${days !== null ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${days===0?'var(--danger-light)':days<=3?'var(--warning-light)':'var(--surface3)'};color:${days===0?'var(--danger)':days<=3?'var(--warning)':'var(--text3)'};">${days===0?'TODAY':days+'d'}</span>` : ''}
          <button class="cf-mark-paid ${paid ? 'paid' : ''}" onclick="markCfPaid('${item.id}','${item.type}','${tkey}',this,${mv})">
            ${paid ? '✓ Paid' : 'Mark paid'}
          </button>
        </div>`;
      }).join('')}`;
  };

  window.markCfPaid = function(itemId, type, tkey, btn, val) {
    if (!window.trackerData) window.trackerData = {};
    if (!window.trackerData[tkey]) window.trackerData[tkey] = {};
    const key = (type === 'income' ? 'inc_' : 'exp_') + itemId;
    if (btn.classList.contains('paid')) {
      delete window.trackerData[tkey][key];
      btn.classList.remove('paid');
      btn.textContent = 'Mark paid';
    } else {
      window.trackerData[tkey][key] = val;
      btn.classList.add('paid');
      btn.textContent = '✓ Paid';
    }
    if (typeof window.markDirty === 'function') window.markDirty();
  };
}

// ─── HISTORY BANK DELETE BUTTON (untouched) ──────────────────────
function patchHistoryBank() {
  const origRender = window.renderHistoryBank;
  window.renderHistoryBank = function() {
    origRender && origRender();
    const items = document.querySelectorAll('#history-bank-list .history-bank-item');
    items.forEach(item => {
      if (item.querySelector('.bank-delete-btn')) return;
      const keyEl = item.querySelector('button[onclick*="openConflictModal"]');
      const onclickAttr = keyEl ? keyEl.getAttribute('onclick') : '';
      const keyMatch = onclickAttr.match(/openConflictModal\('([^']+)'\)/);
      const label = item.querySelector('span[style*="font-weight"]');
      if (!label) return;
      const labelText = label.textContent.trim();
      let monthKey = null;
      if (window.insightHistory) {
        monthKey = Object.keys(window.insightHistory).find(k => {
          const [y, m] = k.split('-');
          const ms = window.MS || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          return (ms[+m] + ' ' + y) === labelText;
        });
      }
      if (keyMatch) monthKey = keyMatch[1];
      if (!monthKey) return;
      const delBtn = document.createElement('button');
      delBtn.className = 'bank-delete-btn';
      delBtn.innerHTML = '<i class="ti ti-x" style="font-size:10px;"></i>';
      delBtn.title = 'Delete this month from bank';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        deleteHistoryBankMonth(monthKey);
      };
      item.appendChild(delBtn);
    });
  };

  window.deleteHistoryBankMonth = function(key) {
    const [y, m] = key.split('-');
    const ms = window.MS || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const label = (ms[+m] || m) + ' ' + y;
    if (!confirm(`Delete ${label} from History Bank?\n\nThis will also remove the tracker actuals for that month. This cannot be undone.`)) return;
    if (window.insightHistory) delete window.insightHistory[key];
    if (window.pendingConflicts) delete window.pendingConflicts[key];
    if (window.trackerData) delete window.trackerData[key];
    if (window.monthHistory) delete window.monthHistory[key];
    if (window.monthNotes) delete window.monthNotes[key];
    if (typeof window.markDirty === 'function') window.markDirty();
    if (typeof window.renderInsights === 'function') window.renderInsights();
    if (typeof window.buildNotifications === 'function') window.buildNotifications();
  };
}

// ─── PATCH CAPTURE STATE ─────────────────────────────────────────
function patchCaptureState() {
  const orig = window.captureState;
  if (!orig) return;
  window.captureState = function() {
    const state = orig();
    state.layoutConfig = layoutConfig;
    return state;
  };
  const origApply = window.applyState;
  if (!origApply) return;
  window.applyState = function(s) {
    origApply(s);
    if (s && s.layoutConfig) {
      layoutConfig = s.layoutConfig;
    }
  };
}

// ─── PATCH SHOW TAB (with auto-exit God Mode protection) ─────────
function patchShowTab() {
  const orig = window.showTab;
  if (!orig) return;
  window.showTab = function(t) {
    if (godMode) toggleGodMode(); // Safely exit and save configuration if switching tabs
    orig(t);
    setTimeout(() => {
      const grid = document.getElementById(t + '-island-grid') ||
                   document.querySelector(`#tab-${t} .island-grid`);
      if (grid) applyDefaultGridPositions(t, grid);
      if (t === 'cashflow') renderCashFlowCalendar();
    }, 50);
  };
}

// ─── HOOK INTO MAIN SITE MASTER DOWNLOAD ────────────────────────
function patchSiteMasterDownload() {
  const orig = window.downloadSiteMaster;
  if (!orig) return;
  window.downloadSiteMaster = async function() {
    window.__LAYOUT_CONFIG__ = layoutConfig;
    await orig();
  };
}

// ─── INIT ────────────────────────────────────────────────────────
function init() {
  const ready = () => {
    injectStyles();
    loadLayoutConfig();
    wrapIslands();
    scaffoldTabGrids();
    
    const dashGrid = document.getElementById('dash-island-grid');
    if (dashGrid) applyDefaultGridPositions('dashboard', dashGrid);
    
    injectGodButton();
    patchHistoryBank();
    patchCaptureState();
    patchShowTab();
    patchSiteMasterDownload();
    
    if (document.querySelector('#tab-cashflow.active')) renderCashFlowCalendar();
    
    if (typeof window.renderHistoryBank === 'function') {
      const origRender = window.renderHistoryBank;
      setTimeout(() => {
        if (typeof origRender === 'function') window.renderHistoryBank();
      }, 300);
    }
    console.log('[patch v3] loaded — Absolute God Mode Canvas Active');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    setTimeout(ready, 100);
  }
}

init();

})(); // end IIFE
