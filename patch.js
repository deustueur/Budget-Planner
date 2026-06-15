bash

cat > /home/claude/patch-v2.js << 'PATCHEOF'
// ═══════════════════════════════════════════════════════════════════
// BUDGET PLANNER — PATCH v2 (God Mode + Cash Flow Calendar)
// Architecture: islands lift to absolute canvas in edit mode only.
// Normal layout is NEVER touched. No grid scaffold injected.
// ═══════════════════════════════════════════════════════════════════
(function(){
'use strict';

// ─── STATE ──────────────────────────────────────────────────────
let godMode = false;
let savedPositions = {}; // { islandId: {x,y,w,h} } in pixels
let dragging = null;
let canvas = null; // the absolute-position overlay div
const STORAGE_KEY = 'bp_god_positions_v1';

// ─── ISLAND REGISTRY ────────────────────────────────────────────
// These are the IDs we know about. Any element with these IDs
// becomes a draggable island in god mode. Normal layout unchanged.
const ISLANDS = {
  'dash-metrics':         'Metrics',
  'bbar-card':            'Budget bar',        // will be found by class
  'income-card':          'Income',
  'expense-card':         'Expenses',
  'dash-savings-panel':   'Tagged savings',
  'dash-cat-chart':       'Category chart',    // injected wrapper
  'tab-cashflow':         null,                // skip — whole tab
  'tracker-body':         'Tracker table',
  'events-list':          'Events',
  'savings-metrics':      'Savings metrics',
  'savings-grid':         'Savings streams',
  'savings-projections':  'Goal projections',
  'instruments-grid':     'Instruments',
  'instr-metrics':        'Instruments metrics',
};

// Dashboard-specific island list (what we expose in god mode on dashboard)
const DASH_ISLANDS = [
  { find: () => document.getElementById('dash-metrics'),      label: 'Metrics'          },
  { find: () => document.querySelector('.bbar-card'),          label: 'Budget bar'       },
  { find: () => document.getElementById('dash-savings-panel'),label: 'Tagged savings'   },
  { find: () => document.getElementById('income-card'),        label: 'Income'           },
  { find: () => document.getElementById('expense-card'),       label: 'Expenses'         },
  { find: () => document.querySelector('.chart-card'),         label: 'Category chart'   },
];

// ─── STYLES ─────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('patch-v2-styles')) return;
  const s = document.createElement('style');
  s.id = 'patch-v2-styles';
  s.textContent = `
/* ── God mode button ── */
#god-mode-btn {
  display:inline-flex;align-items:center;gap:5px;
  padding:5px 11px;border-radius:var(--radius);font-size:12px;
  cursor:pointer;border:1px solid var(--border);
  background:var(--surface);color:var(--text);
  transition:all .2s;font-family:inherit;white-space:nowrap;
}
#god-mode-btn.active {
  background:linear-gradient(135deg,#7F77DD,#D4537E);
  color:#fff;border-color:transparent;
  box-shadow:0 0 0 3px rgba(127,119,221,0.25);
}

/* ── God mode overlay canvas ── */
#god-canvas {
  position:fixed;
  inset:0;
  z-index:900;
  pointer-events:none; /* enabled per island on mousedown */
  display:none;
}
#god-canvas.active {
  display:block;
  background:rgba(0,0,0,0.45);
  backdrop-filter:blur(2px);
}

/* ── Floating island card in god mode ── */
.god-island {
  position:absolute;
  background:var(--surface);
  border:2px solid transparent;
  border-radius:var(--radius-lg);
  box-shadow:0 4px 24px rgba(0,0,0,0.3);
  overflow:hidden;
  cursor:default;
  user-select:none;
  transition:border-color .15s, box-shadow .15s;
  display:flex;
  flex-direction:column;
  pointer-events:all;
}
.god-island:hover {
  border-color:var(--purple);
  box-shadow:0 8px 32px rgba(127,119,221,0.25);
}
.god-island.dragging {
  border-color:var(--accent);
  box-shadow:0 12px 40px rgba(29,158,117,0.35);
  opacity:0.92;
  z-index:999;
}

/* ── Island header bar ── */
.god-island-header {
  display:flex;align-items:center;gap:8px;
  padding:8px 12px;
  background:linear-gradient(135deg,rgba(127,119,221,0.15),rgba(212,83,126,0.1));
  border-bottom:1px solid var(--border);
  cursor:grab;
  flex-shrink:0;
}
.god-island-header:active { cursor:grabbing; }
.god-island-title {
  font-size:11px;font-weight:700;color:var(--purple);
  text-transform:uppercase;letter-spacing:.07em;flex:1;
}
.god-island-close {
  width:20px;height:20px;border-radius:6px;border:none;
  background:rgba(226,75,74,0.15);color:var(--danger);
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  font-size:11px;transition:background .15s;font-family:inherit;
}
.god-island-close:hover { background:var(--danger);color:#fff; }

/* ── Island content area (scrollable) ── */
.god-island-body {
  flex:1;overflow:auto;padding:4px;min-height:0;
}

/* ── Resize grip ── */
.god-island-resize {
  position:absolute;bottom:0;right:0;
  width:18px;height:18px;cursor:se-resize;
  border-right:3px solid var(--purple);
  border-bottom:3px solid var(--purple);
  border-radius:0 0 var(--radius-lg) 0;
  opacity:0.6;transition:opacity .15s;
}
.god-island:hover .god-island-resize { opacity:1; }

/* ── God bar (bottom floating toolbar) ── */
#god-bar {
  position:fixed;bottom:24px;left:50%;
  transform:translateX(-50%);
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:99px;
  padding:9px 18px;
  display:none;align-items:center;gap:12px;
  box-shadow:0 8px 32px rgba(0,0,0,0.3);
  z-index:1000;font-size:12px;color:var(--text2);
  pointer-events:all;
}
#god-bar.visible { display:flex; }
.god-bar-dot {
  width:8px;height:8px;border-radius:99px;flex-shrink:0;
  background:linear-gradient(135deg,#7F77DD,#D4537E);
  animation:pulse 1.5s infinite;
}

/* ── Dot grid bg in god mode ── */
#god-dot-grid {
  position:fixed;inset:0;z-index:901;pointer-events:none;
  opacity:0;transition:opacity .3s;
  background-image:radial-gradient(circle,rgba(127,119,221,0.25) 1px,transparent 1px);
  background-size:32px 32px;
}
#god-dot-grid.visible { opacity:1; }

/* ── Snap guides ── */
.god-guide {
  position:fixed;z-index:950;pointer-events:none;
  background:var(--accent);opacity:0.6;
}
.god-guide.h { height:1px;left:0;right:0; }
.god-guide.v { width:1px;top:0;bottom:0; }

/* ── Island selector panel ── */
#god-island-panel {
  position:fixed;left:20px;top:50%;transform:translateY(-50%);
  z-index:1001;background:var(--surface);
  border:1px solid var(--border);border-radius:var(--radius-lg);
  padding:14px;min-width:160px;
  box-shadow:0 8px 32px rgba(0,0,0,0.2);
  display:none;
}
#god-island-panel.visible { display:block; }
.god-panel-title {
  font-size:10px;font-weight:700;color:var(--text3);
  text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;
}
.god-panel-item {
  display:flex;align-items:center;gap:7px;padding:6px 8px;
  border-radius:8px;cursor:pointer;font-size:12px;color:var(--text2);
  transition:background .12s;margin-bottom:3px;
}
.god-panel-item:hover { background:var(--surface2);color:var(--text); }
.god-panel-item.shown { color:var(--accent); }
.god-panel-item .god-eye {
  width:16px;height:16px;border-radius:4px;
  background:var(--surface2);display:flex;align-items:center;
  justify-content:center;font-size:10px;flex-shrink:0;
}
.god-panel-item.shown .god-eye { background:var(--accent-light);color:var(--accent); }

/* ── Cash flow calendar ── */
.cf-cal-grid {
  display:grid;grid-template-columns:repeat(7,1fr);gap:4px;
  margin-bottom:12px;
}
.cf-day-hdr {
  text-align:center;font-size:10px;font-weight:700;
  color:var(--text3);text-transform:uppercase;
  letter-spacing:.06em;padding:4px 0;
}
.cf-cal-day {
  min-height:60px;border-radius:8px;
  border:1px solid var(--border2);background:var(--surface2);
  padding:4px 5px;cursor:pointer;transition:all .15s;
  position:relative;overflow:hidden;
}
.cf-cal-day:hover { border-color:var(--accent);background:var(--accent-light); }
.cf-cal-day.today {
  border-color:var(--accent);background:var(--accent-light);
  box-shadow:0 0 0 2px rgba(29,158,117,0.2);
}
.cf-cal-day.has-income { border-left:3px solid var(--accent); }
.cf-cal-day.has-expense { border-left:3px solid var(--danger); }
.cf-cal-day.has-both {
  border-left:3px solid var(--warning);
}
.cf-cal-day.empty-day { opacity:.3;pointer-events:none; }
.cf-cal-day-num {
  font-size:10px;font-weight:700;color:var(--text2);margin-bottom:3px;
}
.cf-cal-day.today .cf-cal-day-num { color:var(--accent); }
.cf-cal-pill {
  font-size:8px;padding:1px 4px;border-radius:3px;
  margin-bottom:1px;display:block;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  font-weight:500;
}
.cf-cal-pill.income { background:var(--accent-light);color:var(--accent-dark); }
.cf-cal-pill.expense { background:var(--danger-light);color:var(--danger); }
.cf-cal-more { font-size:8px;color:var(--text3);margin-top:1px; }
.cf-detail-panel {
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-lg);padding:14px;
  margin-top:12px;display:none;
}
.cf-detail-panel.open { display:block; }
.cf-detail-item {
  display:flex;align-items:center;gap:8px;
  padding:8px 10px;border-radius:var(--radius);
  background:var(--surface2);margin-bottom:6px;font-size:12px;
}
.cf-mark-paid {
  margin-left:auto;font-size:10px;padding:2px 8px;
  border-radius:99px;border:1px solid var(--border);
  background:none;color:var(--text2);cursor:pointer;
  font-family:inherit;transition:all .15s;
}
.cf-mark-paid:hover,.cf-mark-paid.paid {
  background:var(--accent-light);color:var(--accent);border-color:var(--accent);
}

@media(max-width:900px){
  #god-mode-btn { display:none; }
  #god-canvas,#god-bar,#god-island-panel { display:none !important; }
}
  `;
  document.head.appendChild(s);
}

// ─── INJECT GOD MODE BUTTON ──────────────────────────────────────
function injectGodButton() {
  if (document.getElementById('god-mode-btn')) return;
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;
  const btn = document.createElement('button');
  btn.id = 'god-mode-btn';
  btn.innerHTML = '<i class="ti ti-adjustments"></i> Configure';
  btn.title = 'God mode — freely arrange islands';
  btn.onclick = toggleGodMode;
  navRight.insertBefore(btn, navRight.firstChild);
}

// ─── CANVAS + BAR ───────────────────────────────────────────────
function createCanvas() {
  if (document.getElementById('god-canvas')) return;
  // dot grid
  const dotGrid = document.createElement('div');
  dotGrid.id = 'god-dot-grid';
  document.body.appendChild(dotGrid);
  // canvas overlay
  canvas = document.createElement('div');
  canvas.id = 'god-canvas';
  document.body.appendChild(canvas);
  canvas.addEventListener('click', function(e) {
    if (e.target === canvas) closeDayDetail();
  });
  // god bar
  const bar = document.createElement('div');
  bar.id = 'god-bar';
  bar.innerHTML = `
    <div class="god-bar-dot"></div>
    <span style="font-weight:600;color:var(--purple);">God mode</span>
    <span style="color:var(--text3);font-size:11px;">Drag header to move · Corner to resize</span>
    <button class="btn btn-sm" onclick="resetGodPositions()" style="border-color:var(--border);">
      <i class="ti ti-refresh"></i> Reset
    </button>
    <button class="btn btn-sm btn-accent" onclick="toggleGodMode()">
      <i class="ti ti-check"></i> Save & exit
    </button>`;
  document.body.appendChild(bar);
  // island selector panel
  const panel = document.createElement('div');
  panel.id = 'god-island-panel';
  panel.innerHTML = `<div class="god-panel-title">Islands</div><div id="god-panel-list"></div>`;
  document.body.appendChild(panel);
  window.resetGodPositions = resetPositions;
}

// ─── TOGGLE GOD MODE ────────────────────────────────────────────
function toggleGodMode() {
  godMode = !godMode;
  const btn = document.getElementById('god-mode-btn');
  const bar = document.getElementById('god-bar');
  const dotGrid = document.getElementById('god-dot-grid');
  const panel = document.getElementById('god-island-panel');
  canvas = document.getElementById('god-canvas');
  if (!btn || !canvas) return;
  if (godMode) {
    btn.classList.add('active');
    btn.innerHTML = '<i class="ti ti-lock-open"></i> God mode ON';
    canvas.classList.add('active');
    if (bar) bar.classList.add('visible');
    if (dotGrid) dotGrid.classList.add('visible');
    if (panel) panel.classList.add('visible');
    buildGodIslands();
    buildIslandPanel();
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '<i class="ti ti-adjustments"></i> Configure';
    canvas.classList.remove('active');
    if (bar) bar.classList.remove('visible');
    if (dotGrid) dotGrid.classList.remove('visible');
    if (panel) panel.classList.remove('visible');
    destroyGodIslands();
    savePositions();
  }
}

// ─── BUILD ISLANDS ON CANVAS ─────────────────────────────────────
// Find visible islands on the current active tab and float them
let activeIslands = []; // { id, el, floater, originalParent, originalNext }

function buildGodIslands() {
  activeIslands = [];
  canvas = document.getElementById('god-canvas');
  if (!canvas) return;
  // Determine which tab is active
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const tabId = activePage.id.replace('tab-', '');
  // Collect elements to float
  const targets = getIslandsForTab(tabId, activePage);
  targets.forEach(({ el, label, id }) => {
    if (!el || !el.offsetParent) return; // not visible
    const rect = el.getBoundingClientRect();
    const scrollTop = window.scrollY;
    // Create floater
    const floater = document.createElement('div');
    floater.className = 'god-island';
    floater.dataset.islandId = id;
    // Position from saved or from current DOM rect
    const saved = savedPositions[id];
    const x = saved ? saved.x : rect.left;
    const y = saved ? saved.y : rect.top + scrollTop;
    const w = saved ? saved.w : rect.width;
    const h = saved ? saved.h : rect.height;
    floater.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;
    // Header (drag handle)
    const header = document.createElement('div');
    header.className = 'god-island-header';
    header.innerHTML = `<span class="god-island-title">${label}</span>
      <button class="god-island-close" onclick="hideGodIsland('${id}')" title="Hide island">✕</button>`;
    // Body — clone the element's content
    const body = document.createElement('div');
    body.className = 'god-island-body';
    // Move the actual element into the floater body
    el.parentNode.insertBefore(floater, el);
    body.appendChild(el);
    floater.appendChild(header);
    floater.appendChild(body);
    // Resize grip
    const grip = document.createElement('div');
    grip.className = 'god-island-resize';
    floater.appendChild(grip);
    canvas.appendChild(floater);
    // Drag
    header.addEventListener('mousedown', (e) => startDrag(e, floater, id));
    header.addEventListener('touchstart', (e) => startDrag(e, floater, id), { passive: false });
    // Resize
    grip.addEventListener('mousedown', (e) => startResize(e, floater, id));
    activeIslands.push({ id, el, floater, header });
  });
}

function getIslandsForTab(tabId, page) {
  // Returns array of {el, label, id}
  if (tabId === 'dashboard') {
    return DASH_ISLANDS.map((def, i) => ({
      el: def.find(),
      label: def.label,
      id: 'dash-island-' + i
    })).filter(x => x.el);
  }
  // For other tabs, take direct children cards/sections
  const result = [];
  page.querySelectorAll(':scope > .card, :scope > .chart-card, :scope > .metrics, :scope > .tracker-section, :scope > [id]').forEach((el, i) => {
    if (el.style.display === 'none') return;
    result.push({
      el,
      label: el.querySelector('.card-title, .tracker-section-title, .metric-label')?.textContent?.trim() || ('Section ' + (i+1)),
      id: (el.id || (tabId + '-section-' + i))
    });
  });
  return result;
}

function destroyGodIslands() {
  // Put elements back where they were
  activeIslands.forEach(({ id, el, floater }) => {
    if (!floater || !el) return;
    const body = floater.querySelector('.god-island-body');
    if (body && body.contains(el)) {
      // Put element back before the floater
      floater.parentNode && floater.parentNode.insertBefore(el, floater);
    }
    floater.remove();
  });
  // Remove any remaining floaters
  canvas = document.getElementById('god-canvas');
  if (canvas) canvas.innerHTML = '';
  activeIslands = [];
}

// ─── HIDE ISLAND (from island selector) ──────────────────────────
window.hideGodIsland = function(id) {
  const entry = activeIslands.find(a => a.id === id);
  if (!entry) return;
  entry.floater.style.display = 'none';
  buildIslandPanel();
};
window.showGodIsland = function(id) {
  const entry = activeIslands.find(a => a.id === id);
  if (!entry) return;
  entry.floater.style.display = '';
  buildIslandPanel();
};

function buildIslandPanel() {
  const list = document.getElementById('god-panel-list');
  if (!list) return;
  list.innerHTML = activeIslands.map(({ id, floater }) => {
    const label = floater.querySelector('.god-island-title')?.textContent || id;
    const shown = floater.style.display !== 'none';
    return `<div class="god-panel-item ${shown ? 'shown' : ''}" onclick="${shown ? 'hideGodIsland' : 'showGodIsland'}('${id}')">
      <div class="god-eye">${shown ? '<i class="ti ti-eye" style="font-size:10px;"></i>' : '<i class="ti ti-eye-off" style="font-size:10px;color:var(--text3);"></i>'}</div>
      ${label}
    </div>`;
  }).join('');
}

// ─── DRAG ────────────────────────────────────────────────────────
function startDrag(e, floater, id) {
  if (e.target.classList.contains('god-island-close')) return;
  e.preventDefault();
  const touch = e.touches ? e.touches[0] : e;
  const startX = touch.clientX;
  const startY = touch.clientY;
  const origLeft = parseFloat(floater.style.left) || 0;
  const origTop  = parseFloat(floater.style.top)  || 0;
  floater.classList.add('dragging');
  floater.style.zIndex = '999';
  function onMove(ev) {
    ev.preventDefault();
    const t = ev.touches ? ev.touches[0] : ev;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    // Snap to 16px grid
    const newLeft = Math.round((origLeft + dx) / 16) * 16;
    const newTop  = Math.round((origTop  + dy + window.scrollY - (parseInt(floater.style.top) < window.scrollY + 100 ? 0 : 0)) / 16) * 16;
    floater.style.left = Math.max(0, newLeft) + 'px';
    floater.style.top  = Math.max(0, origTop + dy) + 'px';
    showSnapGuides(parseFloat(floater.style.left), parseFloat(floater.style.top));
  }
  function onEnd() {
    floater.classList.remove('dragging');
    floater.style.zIndex = '';
    hideSnapGuides();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
}

// ─── RESIZE ─────────────────────────────────────────────────────
function startResize(e, floater, id) {
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  const startY = e.clientY;
  const origW = parseFloat(floater.style.width)  || floater.offsetWidth;
  const origH = parseFloat(floater.style.height) || floater.offsetHeight;
  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    floater.style.width  = Math.max(200, Math.round((origW + dx) / 16) * 16) + 'px';
    floater.style.height = Math.max(80,  Math.round((origH + dy) / 16) * 16) + 'px';
  }
  function onEnd() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
}

// ─── SNAP GUIDES ────────────────────────────────────────────────
function showSnapGuides(x, y) {
  hideSnapGuides();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const snaps = [0, vw/4, vw/2, vw*3/4, vw]; // vertical guides
  snaps.forEach(sx => {
    if (Math.abs(x - sx) < 20) {
      const g = document.createElement('div');
      g.className = 'god-guide v';
      g.style.left = sx + 'px';
      document.body.appendChild(g);
    }
  });
  const hsnaps = [0, vh/4, vh/2, vh*3/4, vh];
  hsnaps.forEach(sy => {
    if (Math.abs(y - sy - window.scrollY) < 20) {
      const g = document.createElement('div');
      g.className = 'god-guide h';
      g.style.top = (sy + window.scrollY) + 'px';
      document.body.appendChild(g);
    }
  });
  setTimeout(hideSnapGuides, 600);
}
function hideSnapGuides() {
  document.querySelectorAll('.god-guide').forEach(g => g.remove());
}

// ─── SAVE / LOAD / RESET ────────────────────────────────────────
function savePositions() {
  // Capture current positions of all floaters
  activeIslands.forEach(({ id, floater }) => {
    if (!floater) return;
    savedPositions[id] = {
      x: parseFloat(floater.style.left) || 0,
      y: parseFloat(floater.style.top)  || 0,
      w: parseFloat(floater.style.width)  || floater.offsetWidth,
      h: parseFloat(floater.style.height) || floater.offsetHeight,
      hidden: floater.style.display === 'none'
    };
  });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPositions)); } catch(e) {}
  if (typeof window.markDirty === 'function') window.markDirty();
}

function loadPositions() {
  // From baked state
  if (window.__BP_STATE__?.godPositions) {
    savedPositions = window.__BP_STATE__.godPositions;
    return;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) savedPositions = JSON.parse(raw);
  } catch(e) {}
}

function resetPositions() {
  if (!confirm('Reset all island positions to defaults?')) return;
  savedPositions = {};
  try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  // Destroy and rebuild with fresh positions
  destroyGodIslands();
  buildGodIslands();
  buildIslandPanel();
}

// ─── PATCH captureState / applyState ────────────────────────────
function patchState() {
  const origCapture = window.captureState;
  if (origCapture && !window._godStatPatched) {
    window.captureState = function() {
      const s = origCapture();
      s.godPositions = savedPositions;
      return s;
    };
    const origApply = window.applyState;
    if (origApply) {
      window.applyState = function(s) {
        origApply(s);
        if (s?.godPositions) savedPositions = s.godPositions;
      };
    }
    window._godStatPatched = true;
  }
}

// ─── PATCH showTab — exit god mode when switching tabs ───────────
function patchShowTab() {
  const orig = window.showTab;
  if (!orig || window._godTabPatched) return;
  window.showTab = function(t) {
    if (godMode) {
      // Save positions and exit god mode before switching
      savePositions();
      destroyGodIslands();
      const btn = document.getElementById('god-mode-btn');
      if (btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="ti ti-adjustments"></i> Configure'; }
      const bar = document.getElementById('god-bar');
      if (bar) bar.classList.remove('visible');
      const dotGrid = document.getElementById('god-dot-grid');
      if (dotGrid) dotGrid.classList.remove('visible');
      const panel = document.getElementById('god-island-panel');
      if (panel) panel.classList.remove('visible');
      const cv = document.getElementById('god-canvas');
      if (cv) cv.classList.remove('active');
      godMode = false;
    }
    orig(t);
    // After switching, rebuild calendar if cashflow
    setTimeout(() => {
      if (t === 'cashflow') renderCashFlowCalendar();
    }, 80);
  };
  window._godTabPatched = true;
}

// ─── CASH FLOW CALENDAR ─────────────────────────────────────────
function renderCashFlowCalendar() {
  const cfTab = document.getElementById('tab-cashflow');
  if (!cfTab || !cfTab.classList.contains('active')) return;

  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const today       = now.getDate();

  const allItems = window.items || [];
  const dayMap = {};
  allItems.filter(i => i.on && i.dueDay > 0).forEach(item => {
    const d = item.dueDay;
    if (d < 1 || d > daysInMonth) return;
    if (!dayMap[d]) dayMap[d] = [];
    dayMap[d].push(item);
  });

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const fmtC = window.fmtC || (n => (window.fmt ? window.fmt(n) : n) + ' ' + (window.currencySymbol || 'LKR'));
  const toM  = window.toMonthly || (v => v);
  const MS   = window.MS || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTHS = window.MONTHS || [];

  const dayHeaders = DAYS.map(d => `<div class="cf-day-hdr">${d}</div>`).join('');
  const emptyBefore = Array(firstDay).fill('<div class="cf-cal-day empty-day"></div>').join('');
  const dayCells = Array.from({length: daysInMonth}, (_, i) => {
    const day = i + 1;
    const dayItems = dayMap[day] || [];
    const hasInc = dayItems.some(it => it.type === 'income');
    const hasExp = dayItems.some(it => it.type === 'expense');
    const cls = ['cf-cal-day',
      day === today ? 'today' : '',
      hasInc && hasExp ? 'has-both' : hasInc ? 'has-income' : hasExp ? 'has-expense' : ''
    ].filter(Boolean).join(' ');
    const pills = dayItems.slice(0, 2).map(it =>
      `<span class="cf-cal-pill ${it.type}">${it.type==='income'?'↑':'↓'} ${it.name}</span>`
    ).join('');
    const more = dayItems.length > 2 ? `<div class="cf-cal-more">+${dayItems.length-2}</div>` : '';
    return `<div class="${cls}" onclick="openCfDay(${day})" data-day="${day}">
      <div class="cf-cal-day-num">${day}</div>${pills}${more}
    </div>`;
  }).join('');

  const calHtml = `
    <div class="card" id="cf-cal-card" style="margin-bottom:14px;">
      <div class="card-head">
        <span class="card-title"><i class="ti ti-calendar-month" style="color:var(--accent);margin-right:5px;"></i>${MONTHS[month]||MS[month]} ${year} — Cash flow calendar</span>
        <span id="cf-day-label" style="font-size:11px;color:var(--text2);"></span>
      </div>
      <div class="cf-cal-grid">${dayHeaders}${emptyBefore}${dayCells}</div>
      <div style="display:flex;gap:10px;font-size:11px;color:var(--text2);padding-top:8px;border-top:1px solid var(--border2);">
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--accent);border-radius:2px;margin-right:3px;"></span>Income</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--danger);border-radius:2px;margin-right:3px;"></span>Expense</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--warning);border-radius:2px;margin-right:3px;"></span>Both</span>
      </div>
      <div class="cf-detail-panel" id="cf-detail-panel"></div>
    </div>`;

  // Replace existing calendar card or prepend
  const existing = cfTab.querySelector('#cf-cal-card');
  if (existing) {
    existing.outerHTML = calHtml;
  } else {
    // Find first card in cashflow tab and insert before it
    const firstCard = cfTab.querySelector('.card, .chart-card, .two-col');
    if (firstCard) {
      firstCard.insertAdjacentHTML('beforebegin', calHtml);
    } else {
      cfTab.insertAdjacentHTML('afterbegin', calHtml);
    }
  }

  // Day detail handler
  window.openCfDay = function(day) {
    const panel = document.getElementById('cf-detail-panel');
    const label = document.getElementById('cf-day-label');
    if (!panel) return;
    // Reset highlights
    document.querySelectorAll('.cf-cal-day').forEach(el => el.style.outline = '');
    const selEl = document.querySelector(`.cf-cal-day[data-day="${day}"]`);
    if (selEl) selEl.style.outline = '2px solid var(--accent)';

    const dayItems = dayMap[day] || [];
    if (!dayItems.length) { panel.classList.remove('open'); if(label) label.textContent=''; return; }
    if (label) label.textContent = `Day ${day} · ${dayItems.length} item${dayItems.length>1?'s':''}`;

    const now2 = new Date();
    const tkey = window.getTkey ? window.getTkey(now2.getMonth(), now2.getFullYear()) : `${now2.getFullYear()}-${now2.getMonth()}`;
    const td   = (window.trackerData && window.trackerData[tkey]) || {};
    const gdu  = window.getDaysUntil || (() => null);

    panel.classList.add('open');
    panel.innerHTML = `
      <div class="card-head" style="margin-bottom:10px;">
        <span class="card-title">Day ${day} — details</span>
        <button class="btn btn-sm btn-ghost" onclick="closeCfDay()">✕ Close</button>
      </div>
      ${dayItems.map(item => {
        const mv = Math.round(toM(item.val, item.freq));
        const pKey = (item.type==='income'?'inc_':'exp_') + item.id;
        const paid = td[pKey] !== undefined && td[pKey] !== '';
        const days = gdu(item.dueDay);
        return `<div class="cf-detail-item">
          <div class="owner-dot ${item.owner||'shared'}"></div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:500;">${item.name}</div>
            <div style="font-size:10px;color:var(--text2);">${item.type} · ${item.owner} · ${item.tag}</div>
          </div>
          <span style="font-size:14px;font-weight:700;color:${item.type==='income'?'var(--accent)':'var(--danger)'};">${fmtC(mv)}</span>
          ${days !== null ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${days===0?'var(--danger-light)':days<=3?'var(--warning-light)':'var(--surface3)'};color:${days===0?'var(--danger)':days<=3?'var(--warning)':'var(--text3)'};">${days===0?'TODAY':days+'d'}</span>` : ''}
          <button class="cf-mark-paid${paid?' paid':''}" onclick="cfMarkPaid('${item.id}','${item.type}','${tkey}',this,${mv})">
            ${paid ? '✓ Paid' : 'Mark paid'}
          </button>
        </div>`;
      }).join('')}`;
  };
  window.closeCfDay = function() {
    const panel = document.getElementById('cf-detail-panel');
    if (panel) panel.classList.remove('open');
    const label = document.getElementById('cf-day-label');
    if (label) label.textContent = '';
    document.querySelectorAll('.cf-cal-day').forEach(el => el.style.outline = '');
  };
  window.closeDayDetail = window.closeCfDay;
  window.cfMarkPaid = function(itemId, type, tkey, btn, val) {
    if (!window.trackerData) window.trackerData = {};
    if (!window.trackerData[tkey]) window.trackerData[tkey] = {};
    const key = (type==='income'?'inc_':'exp_') + itemId;
    if (btn.classList.contains('paid')) {
      delete window.trackerData[tkey][key];
      btn.classList.remove('paid'); btn.textContent = 'Mark paid';
    } else {
      window.trackerData[tkey][key] = val;
      btn.classList.add('paid'); btn.textContent = '✓ Paid';
    }
    if (typeof window.markDirty === 'function') window.markDirty();
  };
}

// ─── HISTORY BANK DELETE ─────────────────────────────────────────
// Patches renderHistoryBankList (defined in the main patch) to use
// a proper CSS-class button instead of inline styles with icon font
function patchHistoryBankDelete() {
  const orig = window.renderHistoryBankList;
  if (!orig || window._histBankPatched) return;
  window.renderHistoryBankList = function() {
    orig();
    // After render, replace any × button with a classed one
    document.querySelectorAll('#history-bank-list [onclick*="deleteHistoryEntry"]').forEach(btn => {
      if (btn.classList.contains('bank-delete-btn')) return;
      btn.className = 'bank-delete-btn';
      btn.innerHTML = '<i class="ti ti-x" style="font-size:10px;pointer-events:none;"></i>';
    });
  };
  window._histBankPatched = true;
}

// ─── INIT ────────────────────────────────────────────────────────
function init() {
  injectStyles();
  createCanvas();
  loadPositions();
  injectGodButton();
  patchState();
  patchShowTab();
  patchHistoryBankDelete();
  // Render calendar if cashflow is already active on load
  if (document.querySelector('#tab-cashflow.active')) {
    renderCashFlowCalendar();
  }
  console.log('[patch v2] God mode ready. Cash flow calendar ready.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 120);
}

})();
