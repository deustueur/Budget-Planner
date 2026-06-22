// insightHistory alignment patch
window.addEventListener('load',()=>{
  try{const _s=localStorage.getItem('bp_state_v8');if(_s){const _p=JSON.parse(_s);if(_p.insightHistory){window.insightHistory=_p.insightHistory;if(typeof insightHistory!=='undefined')insightHistory=_p.insightHistory;}}}catch(e){}
});
// ═══════════════════════════════════════════════════════════════════
// BUDGET PLANNER — patch.js
// ═══════════════════════════════════════════════════════════════════
//
// ARCHITECTURE — READ THIS BEFORE EDITING
// ════════════════════════════════════════
// This file is the UI LAYER only. It adds cosmetic features and
// interactive extensions to index.html. It must NEVER:
//   - Define or redefine core data functions
//   - Reach into index.html's internal variables directly
//   - Overwrite index.html's own functions on window
//
// The ONLY way this file communicates with index.html is through:
//   window.BudgetPlanner.*
//
// That object is defined at the bottom of index.html and exposes:
//   .state.* — live getters/setters for all state objects
//   .tabs.* — references to each tab's DOM element
//   .onAfterRender    — hook: set to a function, called after every recalc()
//   .onTabSwitch      — hook: set to a function, called after showTab(t)
//   .onSaveComplete   — hook: set to a function, called after saveAll()
//   .fmt / .fmtC      — formatting helpers
//   .recalc()         — trigger a full recalc
//   .markDirty()      — mark state changed and save to localStorage
//   .renderInsights() — re-render insights tab
//   .renderSavings()  — re-render savings tab
//   .renderInstruments() — re-render instruments tab
//   .renderHistoryBank() — re-render history bank list
//   .captureState()   — get current state snapshot
//   .applyState(s)    — apply a state snapshot
//   .showTab(t)       — switch to tab by id string
//   .deleteHistoryMonth(key) — delete a month from all stores
//
// ISLAND GRID SYSTEM
// ══════════════════
// God mode uses a 24-column × 80px-row grid overlaid on each tab.
// Each draggable island is a .gm-wrap div wrapping an existing
// card element. Positions are stored in layoutConfig (via
// BudgetPlanner.state.layoutConfig) and persist to localStorage
// and the Site Master xlsx.
//
// TO ADD A NEW ISLAND: add its id and default position to TAB_ISLANDS.
// TO ADD A NEW FEATURE: use BudgetPlanner.* ports only.
// TO DEBUG: run the diagnostic script from the project README.
// ═══════════════════════════════════════════════════════════════════

(function () {
'use strict';

// ─── GRID CONFIG ────────────────────────────────────────────────
const GRID_COLS  = 24;
const GRID_ROW_H = 80;
const LS_LAYOUT  = 'bp_layout_v5';

// ─── EXECUTION GUARD & SITE OVERRIDE ────────────────────────────
// Defer guard until BudgetPlanner is actually available
window.addEventListener('DOMContentLoaded', () => {
    const originalBP = window.BudgetPlanner;
    Object.defineProperty(window, 'BudgetPlanner', {
        configurable: true,
        get: function() { return window._bp_cache || originalBP; },
        set: function(val) {
            window._bp_cache = val;
            if (val && !val._patched) {
                val._patched = true;
                console.log('[patch] 🛡️ Guard Active: BudgetPlanner intercepted.');
            }
        }
    });
});

// ─── GLOBAL UTILITIES ───────────────────────────────────────────
// Promoting functions to window scope to fix ReferenceErrors
window.wrapBlock = function(id, els) {
    if (document.getElementById(id)) return;
    const valid = els.filter(Boolean);
    if (!valid.length) return;
    const wrap = document.createElement('div');
    wrap.id = id;
    const parent = valid[0].parentNode;
    parent.insertBefore(wrap, valid[0]);
    valid.forEach(el => wrap.appendChild(el));
};

    
// ─── ISLAND DEFINITIONS ─────────────────────────────────────────
// Maps each tab to its draggable islands.
// col/row = grid start position, w/h = span in grid units.
// All IDs must exist as static element IDs in index.html.
const TAB_ISLANDS = {
  dashboard: [
    { id:'events-banner',      label:'Events banner',   col:1,  row:1,  w:24, h:1 },
    { id:'dash-metrics',       label:'Metrics',         col:1,  row:2,  w:24, h:2 },
    { id:'dash-bar',           label:'Budget bar',      col:1,  row:3,  w:24, h:1 },
    { id:'dash-savings-panel', label:'Tagged savings',  col:1,  row:4,  w:24, h:3 },
    { id:'income-card',        label:'Income',          col:1,  row:7,  w:12, h:7 },
    { id:'expense-card',       label:'Expenses',        col:13, row:7,  w:12, h:7 },
    { id:'dash-cat-chart',     label:'Category chart',  col:1,  row:14, w:12, h:4 },
    { id:'dash-global',        label:'All items',       col:13, row:14, w:12, h:4 },
  ],
  cashflow: [
    { id:'cf-main-card',       label:'Calendar',        col:1,  row:1,  w:24, h:8 },
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
    { id:'savings-metrics',    label:'Metrics',         col:1,  row:1,  w:24, h:2 },
    { id:'settlement-panel',   label:'Settlement',      col:1,  row:3,  w:12, h:3 },
    { id:'savings-projections',label:'Projections',     col:13, row:3,  w:12, h:3 },
    { id:'sav-grid-island',    label:'Streams',         col:1,  row:6,  w:24, h:6 },
  ],
  instruments: [
    { id:'instr-metrics',      label:'Metrics',         col:1,  row:1,  w:24, h:2 },
    { id:'ins-grid-island',    label:'Instruments',     col:1,  row:3,  w:24, h:9 },
  ],
  insights: [
    { id:'ins-networth',       label:'Net worth',       col:1,  row:1,  w:24, h:3 },
    { id:'ins-history',        label:'History',         col:1,  row:4,  w:14, h:5 },
    { id:'ins-bank',           label:'History bank',    col:15, row:4,  w:10, h:5 },
    { id:'ins-import',         label:'Import',          col:1,  row:9,  w:14, h:6 },
    { id:'ins-suggestions',    label:'Suggestions',     col:15, row:9,  w:10, h:3 },
    { id:'ins-velocity',       label:'Velocity',        col:15, row:12, w:10, h:3 },
    { id:'ins-chart-trevin',   label:'Trevin trend',    col:1,  row:15, w:12, h:5 },
    { id:'ins-chart-dulini',   label:'Dulini trend',    col:13, row:15, w:12, h:5 },
    { id:'ins-chart-combined', label:'Combined trend',  col:1,  row:20, w:24, h:5 },
    { id:'ins-charts',         label:'Person trends',   col:1,  row:15, w:24, h:5 },
    { id:'ins-templates',      label:'Templates',       col:1,  row:20, w:24, h:3 },
  ],
};

// ─── INTERNAL STATE (patch-only, not shared with index.html) ────
let godMode      = false;
let layoutConfig = {};
let dragState    = null;
let resizeState  = null;

// ═══════════════════════════════════════════════════════════════
// SECTION A — CORE FUNCTIONS
// Pure logic. No DOM queries beyond .gm-* patch-owned classes.
// No direct index.html variable access.
// ═══════════════════════════════════════════════════════════════

function pStart(v) {
  const m = (v||'').match(/^(\d+)/);
  return m ? +m[1] : 1;
}
function pSpan(v) {
  const m = (v||'').match(/span\s+(\d+)/);
  return m ? +m[1] : 1;
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
  window.__patchLayoutConfig = layoutConfig;
}

function loadLayout() {
  // Priority 1: from baked __BP_STATE__ in html file
  if (window.__BP_STATE__&&window.__BP_STATE__.layoutConfig) {
    layoutConfig = window.__BP_STATE__.layoutConfig;
    return;
  }
  // Priority 2: localStorage
  try {
    const r = localStorage.getItem(LS_LAYOUT);
    if (r) { layoutConfig = JSON.parse(r); return; }
  } catch(e) {}
  layoutConfig = {};
}

function saveLayout() {
  try { localStorage.setItem(LS_LAYOUT, JSON.stringify(layoutConfig)); } catch(e) {}
  // Persist into main state via port — not by overwriting window.markDirty
  if (window.BudgetPlanner) {
    window.BudgetPlanner.state.layoutConfig = layoutConfig;
    window.BudgetPlanner.markDirty();
  }
}

function pinAllWraps(grid, tabId) {
  grid.querySelectorAll('.gm-wrap').forEach(wrap => {
    const id = wrap.dataset.id;
    if (!id) return;
    const saved = (layoutConfig[tabId]||{})[id];
    const def   = (TAB_ISLANDS[tabId]||[]).find(d => d.id === id);
    const p     = saved || def;
    if (!p) return;
    wrap.style.gridColumn = p.col + ' / span ' + p.w;
    wrap.style.gridRow    = p.row + ' / span ' + p.h;
    if (p.h > 1) wrap.style.minHeight = (p.h * GRID_ROW_H) + 'px';
  });
}

function lockAllPositions() {
  document.querySelectorAll('.gm-grid').forEach(grid => {
    const tabId = grid.id.replace('gm-grid-','');
    pinAllWraps(grid, tabId);
  });
}

function resetLayout() {
  if (!confirm('Reset all layouts to defaults for all tabs?')) return;
  layoutConfig = {};
  try { localStorage.removeItem(LS_LAYOUT); } catch(e) {}
  lockAllPositions();
  saveLayout();
}

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

function drawDots() {
  let cv = document.getElementById('gm-dot-canvas');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'gm-dot-canvas';
    document.body.appendChild(cv);
  }
  cv.width  = window.innerWidth;
  cv.height = Math.max(document.body.scrollHeight, window.innerHeight * 2);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  const cw = cv.width / GRID_COLS;
  ctx.fillStyle = 'rgba(127,119,221,0.16)';
  for (let c=0;c<=GRID_COLS;c++)
    for (let r=0;r*GRID_ROW_H<=cv.height;r++) {
      ctx.beginPath();ctx.arc(c*cw,r*GRID_ROW_H,1.5,0,Math.PI*2);ctx.fill();
    }
  cv.style.opacity='1';
}

function hideDots() {
  const cv = document.getElementById('gm-dot-canvas');
  if (cv) cv.style.opacity='0';
}

function bindDrag() {
  document.querySelectorAll('.gm-handle').forEach(h => {
    h.addEventListener('mousedown', startDrag);
    h.addEventListener('touchstart', startDrag, {passive:false});
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
  if (!wrap||!grid) return;
  const gr = grid.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  wrap.classList.add('dragging');
  dragState = {
    wrap, grid, gr,
    ox: cx - wr.left,
    oy: cy - wr.top,
    w: pSpan(wrap.style.gridColumn),
    h: pSpan(wrap.style.gridRow),
  };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup',   endDrag);
  document.addEventListener('touchmove', onDrag,  {passive:false});
  document.addEventListener('touchend',  endDrag);
}

function onDrag(e) {
  if (!dragState) return;
  e.preventDefault();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  const {wrap,gr,ox,oy,w,h} = dragState;
  const cw  = gr.width / GRID_COLS;
  const relX = cx - ox - gr.left;
  const relY = cy - oy - gr.top + window.scrollY;
  const col  = Math.max(1, Math.min(GRID_COLS-w+1, Math.round(relX/cw)+1));
  const row  = Math.max(1, Math.round(relY/GRID_ROW_H)+1);
  wrap.style.gridColumn = col+' / span '+w;
  wrap.style.gridRow    = row+' / span '+h;
}

function endDrag(e) {
  if (!dragState) return;
  dragState.wrap.classList.remove('dragging');
  recordPos(dragState.wrap);
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
  if (!wrap||!grid) return;
  resizeState = {
    wrap,
    gr:  grid.getBoundingClientRect(),
    sx:  e.clientX, sy: e.clientY,
    sw:  pSpan(wrap.style.gridColumn),
    sh:  pSpan(wrap.style.gridRow),
    sc:  pStart(wrap.style.gridColumn),
    sr:  pStart(wrap.style.gridRow),
  };
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup',   endResize);
}

function onResize(e) {
  if (!resizeState) return;
  const {wrap,gr,sx,sy,sw,sh,sc,sr} = resizeState;
  const cw   = gr.width / GRID_COLS;
  const newW = Math.max(3, Math.min(GRID_COLS-sc+1, sw+Math.round((e.clientX-sx)/cw)));
  const newH = Math.max(1, sh+Math.round((e.clientY-sy)/GRID_ROW_H));
  wrap.style.gridColumn = sc+' / span '+newW;
  wrap.style.gridRow    = sr+' / span '+newH;
  wrap.style.minHeight  = (newH*GRID_ROW_H)+'px';
}

function endResize() {
  if (!resizeState) return;
  recordPos(resizeState.wrap);
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup',   endResize);
  resizeState = null;
}

// ═══════════════════════════════════════════════════════════════
// SECTION B — UI FUNCTIONS
// DOM rendering, wrapping, styling. Uses BudgetPlanner.* ports.
// .gm-* classes are patch-owned and safe to query directly.
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
  border-radius:99px;padding:9px 18px;display:flex;align-items:center;gap:12px;
  box-shadow:0 8px 28px rgba(0,0,0,0.22);z-index:900;font-size:12px;
  color:var(--text2);opacity:0;pointer-events:none;transition:opacity .25s;white-space:nowrap;}
#gm-bar.on{opacity:1;pointer-events:all;}
.gm-pulse{width:8px;height:8px;border-radius:99px;flex-shrink:0;
  background:linear-gradient(135deg,#7F77DD,#D4537E);animation:gmpulse 1.4s infinite;}
@keyframes gmpulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(1.4);}}
#gm-dot-canvas{position:fixed;inset:0;pointer-events:none;z-index:1;
  opacity:0;transition:opacity .3s;}
body.gm-on #gm-dot-canvas{opacity:1;}
.gm-grid{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:14px;align-items:start;grid-auto-flow:dense;min-width:0;width:100%;}
.gm-wrap{position:relative;border-radius:var(--radius-lg);min-width:0;}
body.gm-on .gm-wrap{outline:1.5px dashed transparent;transition:outline .15s,box-shadow .15s;}
body.gm-on .gm-wrap:hover{outline-color:rgba(127,119,221,0.55);
  box-shadow:0 0 0 4px rgba(127,119,221,0.09);z-index:10;}
body.gm-on .gm-wrap.dragging{opacity:.35;}
.gm-handle{display:none;position:absolute;top:7px;left:7px;z-index:30;
  width:24px;height:24px;border-radius:7px;background:#7F77DD;color:#fff;
  cursor:grab;align-items:center;justify-content:center;font-size:12px;
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
  font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none;}
body.gm-on .gm-wrap:hover .gm-lbl{display:block;}
.cf-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
.cf-dh{text-align:center;font-size:9px;font-weight:700;color:var(--text3);
  text-transform:uppercase;letter-spacing:.06em;padding:3px 0 5px;}
.cf-day{min-height:62px;border-radius:7px;border:1px solid var(--border2);
  background:var(--surface2);padding:5px 5px 4px;cursor:pointer;transition:all .15s;}
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
  display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;}
.cf-pill.pi{background:var(--accent-light);color:var(--accent-dark);}
.cf-pill.pe{background:var(--danger-light);color:var(--danger);}
.cf-more{font-size:8px;color:var(--text3);margin-top:1px;}
.cf-det{background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-lg);padding:14px;margin-top:12px;display:none;}
.cf-det.open{display:block;}
.cf-di{display:flex;align-items:center;gap:8px;padding:8px 10px;
  border-radius:var(--radius);background:var(--surface2);margin-bottom:6px;font-size:12px;}
.cf-mp{margin-left:auto;font-size:10px;padding:2px 8px;border-radius:99px;
  border:1px solid var(--border);background:none;color:var(--text2);
  cursor:pointer;font-family:inherit;transition:all .15s;flex-shrink:0;}
.cf-mp:hover,.cf-mp.paid{background:var(--accent-light);color:var(--accent);border-color:var(--accent);}
.cf-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:var(--text2);
  padding-top:10px;border-top:1px solid var(--border2);margin-top:10px;}
.cf-ld{display:inline-block;width:10px;height:10px;border-radius:2px;
  margin-right:4px;vertical-align:middle;}
.bx{width:20px;height:20px;border-radius:99px;border:none;
  background:var(--danger-light);color:var(--danger);cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;
  font-size:10px;flex-shrink:0;transition:all .15s;margin-left:4px;font-family:inherit;}
.bx:hover{background:var(--danger);color:#fff;}
@media(max-width:900px){
  .god-btn{display:none!important;}
  .gm-grid{display:block!important;}
}`;
  document.head.appendChild(s);
}

function wrapEl(id, el) {
  if (!el || document.getElementById(id)) return;
  el.id = id;
}

function buildInsBlock(els) {
  const valid = els.filter(Boolean);
  if (!valid.length) return null;
  const wrap  = document.createElement('div');
  const parent = valid[0].parentNode;
  parent.insertBefore(wrap, valid[0]);
  valid.forEach(el => wrap.appendChild(el));
  return wrap;
}

function nthInsTitle(n) {
  // Uses BudgetPlanner.tabs.insights — no blind hunting
  const tab = window.BudgetPlanner && window.BudgetPlanner.tabs.insights;
  if (!tab) return null;
  return tab.querySelectorAll('.insight-section-title')[n] || null;
}

function addStaticIds() {
  const BP = window.BudgetPlanner;
  if (!BP) return;

  const bbar = BP.tabs.dashboard && BP.tabs.dashboard.querySelector('.bbar-card');
  if (bbar && !bbar.id) bbar.id = 'dash-bar';
  const catChart = BP.tabs.dashboard && BP.tabs.dashboard.querySelector('.chart-card');
  if (catChart && !catChart.id) catChart.id = 'dash-cat-chart';
  const globalCard = BP.tabs.dashboard && BP.tabs.dashboard.querySelector('.card #global-tbody');
  if (globalCard && !globalCard.closest('.card').id) globalCard.closest('.card').id = 'dash-global';

  if (BP.tabs.savings) {
     const sg = document.getElementById('savings-grid');
     if (sg && sg.previousElementSibling && !document.getElementById('sav-grid-island')) {
         wrapBlock('sav-grid-island', [sg.previousElementSibling, sg]);
     }
  }

  if (BP.tabs.instruments) {
     const ig = document.getElementById('instruments-grid');
     if (ig && ig.previousElementSibling && !document.getElementById('ins-grid-island')) {
         wrapBlock('ins-grid-island', [ig.previousElementSibling, ig]);
     }
  }

  const ins = BP.tabs.insights;
  if (ins) {
    if (!document.getElementById('ins-networth')) {
      const nw = ins.querySelector('.networth-card');
      if (nw) nw.id = 'ins-networth';
    }
    wrapBlock('ins-history', [nthInsTitle(0), document.getElementById('history-grid'), document.getElementById('history-detail')]);
    wrapBlock('ins-bank', [nthInsTitle(1), document.getElementById('history-bank-list')]);
    wrapBlock('ins-import', [nthInsTitle(2), document.getElementById('import-panel-local'), document.getElementById('import-panel-drive')]);
    wrapBlock('ins-suggestions', [nthInsTitle(3), document.getElementById('suggestions-list')]);
    wrapBlock('ins-velocity', [nthInsTitle(4), document.getElementById('savings-velocity')]);

    const cards = Array.from(ins.querySelectorAll('.chart-card, .card'));
    const trevin = cards.find(c => c.innerText.includes('TREVIN') && c.innerText.includes('TREND'));
    if (trevin) trevin.id = 'ins-chart-trevin';
    
    const dulini = cards.find(c => c.innerText.includes('DULINI') && c.innerText.includes('TREND'));
    if (dulini) dulini.id = 'ins-chart-dulini';
    
   const comb = cards.find(c => c.innerText.includes('COMBINED') && c.innerText.includes('TREND'));
    if (comb) comb.id = 'ins-chart-combined';

    wrapBlock('ins-templates', [nthInsTitle(6), document.getElementById('templates-list'), ins.querySelector('button[onclick*="saveTemplate"]')]);
  }
}

function patchMetricsRender() {
  // Protects .gm-wrap containers from being nuked when
  // renderSavings() / renderInstruments() rebuild metric cards.
  // Protects .gm-wrap containers from being nuked when
  // renderSavings() / renderInstruments() rebuild metric cards.
  // Uses BudgetPlanner hooks instead of overwriting functions.
  if (window._gmMetricsPatched) return;
  window._gmMetricsPatched = true;
  if (!window.BudgetPlanner) return;
  const origOnRender = window.BudgetPlanner.onAfterRender;
  window.BudgetPlanner.onAfterRender = function() {
    lockAllPositions();
    if (origOnRender) origOnRender();
  };
}

function buildTabGrids() {
  const BP = window.BudgetPlanner;
  Object.entries(TAB_ISLANDS).forEach(([tabId, defs]) => {
    const tabEl = BP ? BP.tabs[tabId] : document.getElementById('tab-'+tabId);
    if (!tabEl) return;
    let grid = document.getElementById('gm-grid-'+tabId);
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'gm-grid';
      grid.id = 'gm-grid-'+tabId;
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
      pinAllWraps(grid, tabId);
    });
  });
}

function injectGodUI() {
  if (document.getElementById('gm-btn')) return;
  // Use BudgetPlanner port for nav-right reference
  const navRight = window.BudgetPlanner && window.BudgetPlanner.tabs.navRight;
  if (!navRight) return;
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

function buildCalendarCard() {
  // Uses BudgetPlanner.tabs.cashflow — no querySelector
  const cfTab = window.BudgetPlanner && window.BudgetPlanner.tabs.cashflow;
  if (!cfTab) return;
  if (!document.getElementById('cf-main-card')) {
    const card = document.createElement('div');
    card.id = 'cf-main-card';
    card.className = 'card';
    card.style.marginBottom = '14px';
    cfTab.insertBefore(card, cfTab.firstChild);
  }
  renderCalendar();
}

function renderCalendar() {
  const card = document.getElementById('cf-main-card');
  if (!card) return;
  const BP   = window.BudgetPlanner;
  const now  = new Date();
  const mo   = now.getMonth();
  const yr   = now.getFullYear();
  const dim  = new Date(yr,mo+1,0).getDate();
  const first= new Date(yr,mo,1).getDay();
  const today= now.getDate();
  const MN   = BP ? BP.MONTHS[mo] : '';
  const fmtC = BP ? BP.fmtC : (n=>n);
  const toM  = BP ? BP.toMonthly : (v=>v);
  const getTk= window.getTkey || ((m,y)=>y+'-'+m);
  const tkey = getTk(mo,yr);
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  // Build day map from state via port
  const allItems = BP ? BP.state.items : [];
  const dm = {};
  allItems.filter(i=>i.on&&i.dueDay>0).forEach(it=>{
    const d=it.dueDay;
    if(d<1||d>dim)return;
    if(!dm[d])dm[d]=[];
    dm[d].push(it);
  });
  const hdrs  = DAYS.map(d=>`<div class="cf-dh">${d}</div>`).join('');
  const empty = Array(first).fill('<div></div>').join('');
  const cells = Array.from({length:dim},(_,i)=>{
    const day=i+1;
    const its=dm[day]||[];
    const hi=its.some(x=>x.type==='income');
    const he=its.some(x=>x.type==='expense');
    const cls=['cf-day',day===today?'cf-today':'',
      hi&&he?'cf-both':hi?'cf-inc':he?'cf-exp':''].filter(Boolean).join(' ');
    const pills=its.slice(0,2).map(it=>
      `<span class="cf-pill ${it.type==='income'?'pi':'pe'}">${it.type==='income'?'↑':'↓'} ${it.name}</span>`).join('');
    const more=its.length>2?`<div class="cf-more">+${its.length-2}</div>`:'';
    return `<div class="${cls}" data-d="${day}" onclick="cfClick(${day})">${
      '<div class="cf-dn">'+day+'</div>'+pills+more}</div>`;
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
  // Day click handler — exposed on window for inline onclick
  window.cfClick = function(day) {
    const its=dm[day]||[];
    const det=document.getElementById('cf-det');
    const lbl=document.getElementById('cf-sel-lbl');
    document.querySelectorAll('.cf-day.cf-sel').forEach(x=>x.classList.remove('cf-sel'));
    const dayEl=document.querySelector(`.cf-day[data-d="${day}"]`);
    if(dayEl)dayEl.classList.add('cf-sel');
    if(!its.length||!det)return;
    if(lbl)lbl.textContent=`Day ${day} — ${its.length} item${its.length>1?'s':''}`;
    const td=(BP&&BP.state.trackerData&&BP.state.trackerData[tkey])||{};
    const gdu=BP?BP.getDaysUntil:(()=>null);
    det.classList.add('open');
    det.innerHTML=`
      <div class="card-head" style="margin-bottom:10px;">
        <span class="card-title">Day ${day}</span>
        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('cf-det').classList.remove('open');document.getElementById('cf-sel-lbl').textContent=''">✕</button>
      </div>
      ${its.map(it=>{
        const mv=Math.round(toM(it.val,it.freq));
        const key=(it.type==='income'?'inc_':'exp_')+it.id;
        const paid=td[key]!==undefined&&td[key]!=='';
        const d=gdu(it.dueDay);
        const uc=d===0?'var(--danger)':d!==null&&d<=3?'var(--warning)':'var(--text3)';
        const ut=d===null?'':d===0?'TODAY':d+'d';
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
  window.cfPay = function(id,type,tk,btn,val) {
    const BP=window.BudgetPlanner;
    if(!BP)return;
    if(!BP.state.trackerData[tk])BP.state.trackerData[tk]={};
    const key=(type==='income'?'inc_':'exp_')+id;
    if(btn.classList.contains('paid')){
      delete BP.state.trackerData[tk][key];
      btn.classList.remove('paid');btn.textContent='Mark paid';
    } else {
      BP.state.trackerData[tk][key]=val;
      btn.classList.add('paid');btn.textContent='✓ Paid';
    }
    BP.markDirty();
  };
}

function patchBank() {
  if (window._gmBank) return;
  window._gmBank = true;
  // Guard cleared on reload — safe to re-patch
  if (!window.BudgetPlanner) return;
  
  const origRHB = window.BudgetPlanner.renderHistoryBank;
  const origRI  = window.BudgetPlanner.renderInsights;

  function addX() {
    const list = document.getElementById('history-bank-list');
    if (!list) return;
    list.querySelectorAll('.history-bank-item').forEach(card => {
      if (card.querySelector('.bx')) return;
      card.style.position = 'relative';
      let key = null;
      // Try conflict resolve button first
      const resolveBtn = card.querySelector('button[onclick*="openConflictModal"]');
      if (resolveBtn) {
        const m = resolveBtn.getAttribute('onclick').match(/openConflictModal\('([^']+)'\)/);
        if (m) key = m[1];
      }
      // Fall back to month label text match against insightHistory
      if (!key) {
        const span = card.querySelector('span[style*="font-weight"]');
        if (span && window.BudgetPlanner && window.BudgetPlanner.state.insightHistory) {
          const txt = span.textContent.trim();
          const MS  = window.BudgetPlanner.MS;
          key = Object.keys(window.BudgetPlanner.state.insightHistory).find(k=>{
            const [y,mi]=k.split('-');
            return (MS[+mi]+' '+y)===txt;
          });
        }
      }
      if (!key) return;

      const btn = document.createElement('button');
      btn.className = 'bx';
      btn.title = 'Delete this month';
      btn.innerHTML = '✕';
      btn.style.position = 'absolute';
      btn.style.top = '-6px';
      btn.style.right = '-6px';
      btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      btn.style.zIndex = '10';
      
      btn.onclick = ev => { 
        ev.stopPropagation(); 
        if (window.BudgetPlanner) window.BudgetPlanner.deleteHistoryMonth(key); 
      };
      card.appendChild(btn);
    });
  }

  if (origRHB) {
    window.BudgetPlanner.renderHistoryBank = function() { 
      origRHB(); 
      setTimeout(addX, 150); 
    };
  }
  
  if (origRI) {
    window.BudgetPlanner.renderInsights = function() { 
      origRI();  
      setTimeout(() => {
          addStaticIds();
          buildTabGrids();
          lockAllPositions();
          addX();
      }, 80); 
    };
  }
}

function patchShowTab() {
  // Uses BudgetPlanner.onTabSwitch hook — no window.showTab overwrite
  if (window._gmShowTab) return;
  window._gmShowTab = true;
  if (!window.BudgetPlanner) return;
  const origHook = window.BudgetPlanner.onTabSwitch;
  window.BudgetPlanner.onTabSwitch = function(t) {
    if (t === 'cashflow') setTimeout(renderCalendar, 60);
    if (t === 'insights') setTimeout(()=>{
      const list=document.getElementById('history-bank-list');
      if(!list)return;
      const MS=window.BudgetPlanner.MS;
      const insHistory=window.BudgetPlanner.state.insightHistory;
      list.querySelectorAll('.history-bank-item').forEach(card=>{
        if(card.querySelector('.bx'))return;
        const span=card.querySelector('span[style*="font-weight"]');
        const txt=span?span.textContent.trim():'';
        const key=Object.keys(insHistory||{}).find(k=>{
          const [y,mi]=k.split('-');
          return (MS[+mi]+' '+y)===txt;
        });
        if(!key)return;
        const btn=document.createElement('button');
        btn.className='bx';btn.title='Delete this month';btn.innerHTML='✕';
        btn.onclick=ev=>{ev.stopPropagation();window.BudgetPlanner.deleteHistoryMonth(key);};
        card.style.position='relative';
        card.appendChild(btn);
      });
    },400);
    if (godMode) setTimeout(bindDrag, 120);
    if (origHook) origHook(t);
  };
}

function patchState() {
  // Patches captureState/applyState via BudgetPlanner ports
  // so layoutConfig is included in every save and master download.
  if (window._gmCapture) return;
  window._gmCapture = true;
  if (!window.BudgetPlanner) return;
  const origCapture = window.BudgetPlanner.captureState;
  const origApply   = window.BudgetPlanner.applyState;
  window.BudgetPlanner.captureState = function() {
    const s = origCapture();
    s.layoutConfig = layoutConfig;
    return s;
  };
  window.BudgetPlanner.applyState = function(s) {
    origApply(s);
    if (s && s.layoutConfig) {
      layoutConfig = s.layoutConfig;
      buildTabGrids();
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// INIT — runs 200ms after DOMContentLoaded to ensure html
// engine has fully initialised before patch plugs in.
// ═══════════════════════════════════════════════════════════════

function dissolveWrappers() {
  // Remove dead two-col/container divs whose children are already gm-wrapped.
  // This prevents double-nesting which causes clipping.
  ['dash-income-expense-row','dash-chart-global-row','cf-bottom-row'].forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    const parent = el.parentNode;
    // Move all children up to parent level, then remove the wrapper
    Array.from(el.children).forEach(child => parent.insertBefore(child, el));
    el.remove();
  });
  // Fix loose card-head divs in savings and instruments (no id, class=card-head)
  ['gm-grid-savings','gm-grid-instruments'].forEach(gridId=>{
    const grid = document.getElementById(gridId);
    if (!grid) return;
    Array.from(grid.children).forEach(el=>{
      if (el.classList.contains('card-head') && !el.classList.contains('gm-wrap')) {
        // Wrap it so it gets grid placement
        const wrap = document.createElement('div');
        wrap.className = 'gm-wrap';
        wrap.dataset.id = gridId+'-header';
        wrap.dataset.tab = gridId.replace('gm-grid-','');
        el.parentNode.insertBefore(wrap, el);
        wrap.appendChild(el);
      }
    });
  });
  // Wrap loose insights elements (section-title, two-col charts, balance chart)
  const insGrid = document.getElementById('gm-grid-insights');
  if (insGrid) {
    // Find and wrap the charts two-col and standalone chart-card into ins-charts
    if (!document.getElementById('ins-charts')) {
      const loose = Array.from(insGrid.children).filter(el=>
        !el.classList.contains('gm-wrap') &&
        (el.classList.contains('two-col') || el.classList.contains('chart-card') ||
         el.classList.contains('insight-section-title') || (!el.className && !el.id))
      );
      if (loose.length) {
        const wrap = document.createElement('div');
        wrap.id = 'ins-charts';
        insGrid.insertBefore(wrap, loose[0]);
        loose.forEach(el => wrap.appendChild(el));
      }
    }
  }
}

function patchInit() {
  if (!window.BudgetPlanner) {
    console.error('[patch] window.BudgetPlanner not found.');
    return;
  }
  injectStyles();
  loadLayout();
  window.__patchLayoutConfig = layoutConfig;
  
  // Tag timeline first
  const track = document.getElementById('cf-track');
  if (track && track.closest('.card')) { track.closest('.card').id = 'cf-timeline-card'; }
  
  buildCalendarCard();
  addStaticIds();
  dissolveWrappers();
  buildTabGrids();
  
  injectGodUI();
  patchMetricsRender();
  patchBank();
  patchShowTab();
  // Trigger renderHistoryBank after patchBank so addX fires on already-rendered list
  setTimeout(()=>{ if(window.BudgetPlanner)window.BudgetPlanner.renderHistoryBank(); },300);
  patchState();
  
  const origRender = window.BudgetPlanner.onAfterRender;
  window.BudgetPlanner.onAfterRender = function() {
    lockAllPositions();
    if (origRender) origRender();
  };
  
  console.log('[patch final] ✓ loaded — Grid Bounds, Missing Islands, and Red X Fixed');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(patchInit, 200));
} else {
  setTimeout(patchInit, 200);
}

// Safety net — catches mouseup/touchend if pointer leaves window during drag
window.addEventListener('mouseup',  e => { if(dragState)endDrag(e);   if(resizeState)endResize(); });
window.addEventListener('touchend', e => { if(dragState)endDrag(e);   if(resizeState)endResize(); });

// Expose only what external code legitimately needs
window.toggleGodMode = toggleGodMode;
window.resetLayout   = resetLayout;

})();

// ── HISTORY BANK SYNC (monthHistory as source of truth) ─────────
(function(){
  const MS=window.BudgetPlanner?.MS||['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const _origRHB = window.BudgetPlanner.renderHistoryBank;

  function myRenderHistoryBank(){
    const el=document.getElementById('history-bank-list');
    if(!el) return;
    const mh = typeof monthHistory!=='undefined' ? monthHistory : {};
    const ih = typeof insightHistory!=='undefined' ? insightHistory : {};
    const keys = Object.keys(mh).sort().reverse();
    if(!keys.length){
      el.innerHTML='<div style="font-size:12px;color:var(--text3);padding:8px 0;">No bulk imports yet. Use the import section below to upload monthly files.</div>';
      return;
    }
    el.innerHTML = keys.map(key=>{
      const[y,m]=key.split('-');
      const label=(MS[+m]||m)+' '+y;
      const meta=ih[key];
      const fileName=meta?.fileName||'site data';
      return `<div class="history-bank-item" style="display:flex;align-items:center;gap:9px;padding:7px 10px;background:var(--surface2);border-radius:var(--radius);margin-bottom:5px;font-size:12px;">
        <i class="ti ti-calendar-stats" style="color:var(--accent);flex-shrink:0;font-size:14px;"></i>
        <div style="flex:1;"><strong>${label}</strong><span style="font-size:10px;color:var(--text3);margin-left:6px;">${fileName}</span></div>
        <span style="font-size:10px;color:var(--accent);">✓ synced</span>
        <button class="bank-x" data-key="${key}" style="width:20px;height:20px;border-radius:50%;border:1px solid var(--danger);background:transparent;color:var(--danger);cursor:pointer;font-size:13px;font-weight:700;line-height:1;flex-shrink:0;padding:0;display:inline-flex;align-items:center;justify-content:center;opacity:0.5;transition:all .15s;">&times;</button>
      </div>`;
    }).join('');
    el.querySelectorAll('.bank-x').forEach(btn=>{
      btn.onmouseover=()=>{btn.style.opacity='1';btn.style.background='var(--danger-light)';};
      btn.onmouseout=()=>{btn.style.opacity='0.5';btn.style.background='transparent';};
      btn.onclick=e=>{
        e.stopPropagation();
        window.BudgetPlanner.deleteHistoryMonth(btn.getAttribute('data-key'));
      };
    });
  }

  window.renderHistoryBank = myRenderHistoryBank;
  window.BudgetPlanner.renderHistoryBank = myRenderHistoryBank;

  function addGridX(){
    document.querySelectorAll('#history-grid .history-card').forEach(card=>{
      if(card.querySelector('.hg-del')) return;
      const oc=card.getAttribute('onclick')||'';
      const km=oc.match(/loadHistoryDetail\(['"]([^'"]+)['"]/);
      if(!km) return;
      const key=km[1]; const[y,m]=key.split('-');
      const btn=document.createElement('button');
      btn.className='hg-del';
      btn.innerHTML='&times;';
      btn.style.cssText='position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;border:1px solid var(--danger);background:var(--danger-light);color:var(--danger);cursor:pointer;font-size:11px;font-weight:700;line-height:1;padding:0;display:flex;align-items:center;justify-content:center;z-index:10;opacity:0.7;transition:opacity .15s;';
      btn.onmouseover=()=>btn.style.opacity='1';
      btn.onmouseout=()=>btn.style.opacity='0.7';
      btn.onclick=e=>{
        e.stopPropagation();
        window.BudgetPlanner.deleteHistoryMonth(key);
      };
      card.style.position='relative';
      card.appendChild(btn);
    });
  }

  const _origRI = window.renderInsights;
  window.renderInsights = function(){
    if(_origRI) _origRI();
    setTimeout(()=>{ myRenderHistoryBank(); addGridX(); }, 100);
  };
  window.BudgetPlanner.renderInsights = window.renderInsights;

  const _origST = window.showTab;
  window.showTab = function(t){
    if(_origST) _origST(t);
    if(t==='insights') setTimeout(()=>{ myRenderHistoryBank(); addGridX(); }, 200);
  };
  window.BudgetPlanner.showTab = window.showTab;

  myRenderHistoryBank();
  addGridX();
})();

// ── HISTORY BANK SYNC (monthHistory as source of truth) ─────────
(function(){
  const MS=window.BudgetPlanner?.MS||['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const _origRHB = window.BudgetPlanner.renderHistoryBank;

  function myRenderHistoryBank(){
    const el=document.getElementById('history-bank-list');
    if(!el) return;
    const mh = typeof monthHistory!=='undefined' ? monthHistory : {};
    const ih = typeof insightHistory!=='undefined' ? insightHistory : {};
    const keys = Object.keys(mh).sort().reverse();
    if(!keys.length){
      el.innerHTML='<div style="font-size:12px;color:var(--text3);padding:8px 0;">No bulk imports yet. Use the import section below to upload monthly files.</div>';
      return;
    }
    el.innerHTML = keys.map(key=>{
      const[y,m]=key.split('-');
      const label=(MS[+m]||m)+' '+y;
      const meta=ih[key];
      const fileName=meta?.fileName||'site data';
      return `<div class="history-bank-item" style="display:flex;align-items:center;gap:9px;padding:7px 10px;background:var(--surface2);border-radius:var(--radius);margin-bottom:5px;font-size:12px;">
        <i class="ti ti-calendar-stats" style="color:var(--accent);flex-shrink:0;font-size:14px;"></i>
        <div style="flex:1;"><strong>${label}</strong><span style="font-size:10px;color:var(--text3);margin-left:6px;">${fileName}</span></div>
        <span style="font-size:10px;color:var(--accent);">✓ synced</span>
        <button class="bank-x" data-key="${key}" style="width:20px;height:20px;border-radius:50%;border:1px solid var(--danger);background:transparent;color:var(--danger);cursor:pointer;font-size:13px;font-weight:700;line-height:1;flex-shrink:0;padding:0;display:inline-flex;align-items:center;justify-content:center;opacity:0.5;transition:all .15s;">&times;</button>
      </div>`;
    }).join('');
    el.querySelectorAll('.bank-x').forEach(btn=>{
      btn.onmouseover=()=>{btn.style.opacity='1';btn.style.background='var(--danger-light)';};
      btn.onmouseout=()=>{btn.style.opacity='0.5';btn.style.background='transparent';};
      btn.onclick=e=>{
        e.stopPropagation();
        window.BudgetPlanner.deleteHistoryMonth(btn.getAttribute('data-key'));
      };
    });
  }

  window.renderHistoryBank = myRenderHistoryBank;
  window.BudgetPlanner.renderHistoryBank = myRenderHistoryBank;

  function addGridX(){
    document.querySelectorAll('#history-grid .history-card').forEach(card=>{
      if(card.querySelector('.hg-del')) return;
      const oc=card.getAttribute('onclick')||'';
      const km=oc.match(/loadHistoryDetail\(['"]([^'"]+)['"]/);
      if(!km) return;
      const key=km[1]; const[y,m]=key.split('-');
      const btn=document.createElement('button');
      btn.className='hg-del';
      btn.innerHTML='&times;';
      btn.style.cssText='position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;border:1px solid var(--danger);background:var(--danger-light);color:var(--danger);cursor:pointer;font-size:11px;font-weight:700;line-height:1;padding:0;display:flex;align-items:center;justify-content:center;z-index:10;opacity:0.7;transition:opacity .15s;';
      btn.onmouseover=()=>btn.style.opacity='1';
      btn.onmouseout=()=>btn.style.opacity='0.7';
      btn.onclick=e=>{
        e.stopPropagation();
        window.BudgetPlanner.deleteHistoryMonth(key);
      };
      card.style.position='relative';
      card.appendChild(btn);
    });
  }

  const _origRI = window.renderInsights;
  window.renderInsights = function(){
    if(_origRI) _origRI();
    setTimeout(()=>{ myRenderHistoryBank(); addGridX(); }, 100);
  };
  window.BudgetPlanner.renderInsights = window.renderInsights;

  const _origST = window.showTab;
  window.showTab = function(t){
    if(_origST) _origST(t);
    if(t==='insights') setTimeout(()=>{ myRenderHistoryBank(); addGridX(); }, 200);
  };
  window.BudgetPlanner.showTab = window.showTab;

  myRenderHistoryBank();
  addGridX();
})();

// ── RE-RUN dissolveWrappers ON TAB SWITCH ──
// dissolveWrappers() runs at patchInit but insights elements don't exist yet.
// They're only created when renderInsights() fires on first tab visit.
// This hook catches that and wraps them immediately after.
(function(){
  const origOnTab = window.BudgetPlanner && window.BudgetPlanner.onTabSwitch;
  if(!window.BudgetPlanner) return;
  window.BudgetPlanner.onTabSwitch = function(t) {
    if(origOnTab) origOnTab(t);
    if(t === 'insights') {
      setTimeout(function(){
        const insGrid = document.getElementById('gm-grid-insights');
        if(!insGrid) return;
        // Wrap loose elements into ins-charts
        if(!document.getElementById('ins-charts')) {
          const loose = Array.from(insGrid.children).filter(el=>
            !el.classList.contains('gm-wrap') &&
            (el.classList.contains('two-col') || el.classList.contains('chart-card') ||
             el.classList.contains('insight-section-title') || (!el.className && !el.id))
          );
          if(loose.length) {
            const wrap = document.createElement('div');
            wrap.id = 'ins-charts';
            insGrid.insertBefore(wrap, loose[0]);
            loose.forEach(el => wrap.appendChild(el));
            const gmWrap = document.createElement('div');
            gmWrap.className = 'gm-wrap';
            gmWrap.dataset.id = 'ins-charts';
            gmWrap.dataset.tab = 'insights';
            const saved = (window.__LAYOUT_CONFIG__ && window.__LAYOUT_CONFIG__.insights && window.__LAYOUT_CONFIG__.insights['ins-charts']);
            const p = saved || {col:1,row:15,w:24,h:5};
            gmWrap.style.gridColumn = p.col+' / span '+p.w;
            gmWrap.style.gridRow    = p.row+' / span '+p.h;
            gmWrap.style.minHeight  = (p.h*80)+'px';
            wrap.parentNode.insertBefore(gmWrap, wrap);
            gmWrap.appendChild(wrap);
          }
        }
        // Wrap loose card-heads in savings and instruments
        ['gm-grid-savings','gm-grid-instruments'].forEach(gridId=>{
          const grid = document.getElementById(gridId);
          if(!grid) return;
          Array.from(grid.children).filter(el=>
            el.classList.contains('card-head') && !el.classList.contains('gm-wrap')
          ).forEach(el=>{
            const wrap = document.createElement('div');
            wrap.className = 'gm-wrap';
            wrap.dataset.id = gridId+'-header';
            wrap.dataset.tab = gridId.replace('gm-grid-','');
            el.parentNode.insertBefore(wrap, el);
            wrap.appendChild(el);
          });
        });
      }, 150);
    }
  };

// (old broken sync block removed — see direct sync calls instead)

})();

// ══════════════════════════════════════════════════════════════
// TREND CHART — 6-month income / expenses / savings / balance
// Injected into Insights tab before History Bank section
// ══════════════════════════════════════════════════════════════
(function(){
  function buildTrendChart(){
    if(document.getElementById('trend-chart-patch')) return; // already rendered
    const mh = typeof monthHistory!=='undefined' ? monthHistory : {};
    const keys = Object.keys(mh).sort();
    if(!keys.length) return; // no data yet
    const MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels  = keys.map(k=>{ const[y,m]=k.split('-'); return MS[+m]+' '+y; });
    const incData = keys.map(k=>mh[k].totalIncome||0);
    const expData = keys.map(k=>mh[k].totalExpenses||0);
    const savData = keys.map(k=>mh[k].totalSaved||0);
    const balData = keys.map(k=>mh[k].balance||((mh[k].totalIncome||0)-(mh[k].totalExpenses||0)));
    // Find injection point — before "History Bank" section title
    const titles = document.querySelectorAll('.insight-section-title');
    let injectBefore = null;
    titles.forEach(t=>{ if(t.textContent.includes('History Bank')) injectBefore=t; });
    if(!injectBefore) return;
    const wrap = document.createElement('div');
    wrap.id = 'trend-chart-patch';
    wrap.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.07);';
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <span style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.09em;">${keys.length}-month trend — income · expenses · savings</span>
        <div style="display:flex;gap:10px;font-size:11px;color:var(--text2);flex-wrap:wrap;">
          <span><span style="display:inline-block;width:10px;height:3px;background:#1D9E75;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Income</span>
          <span><span style="display:inline-block;width:10px;height:3px;background:#E24B4A;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Expenses</span>
          <span><span style="display:inline-block;width:10px;height:3px;background:#7F77DD;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Savings</span>
          <span><span style="display:inline-block;width:10px;height:3px;background:#BA7517;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Balance</span>
        </div>
      </div>
      <div style="position:relative;height:200px;"><canvas id="trend-chart-canvas"></canvas></div>`;
    injectBefore.parentNode.insertBefore(wrap, injectBefore);
    if(typeof Chart==='undefined') return;
    const ctx = document.getElementById('trend-chart-canvas').getContext('2d');
    new Chart(ctx, {
      type:'line',
      data:{
        labels,
        datasets:[
          { label:'Income',   data:incData, borderColor:'#1D9E75', backgroundColor:'rgba(29,158,117,0.08)', tension:0.3, fill:true,  pointRadius:4, borderWidth:2 },
          { label:'Expenses', data:expData, borderColor:'#E24B4A', backgroundColor:'rgba(226,75,74,0.06)',  tension:0.3, fill:true,  pointRadius:4, borderWidth:2 },
          { label:'Savings',  data:savData, borderColor:'#7F77DD', backgroundColor:'rgba(127,119,221,0.06)',tension:0.3, fill:false, pointRadius:4, borderWidth:2 },
          { label:'Balance',  data:balData, borderColor:'#BA7517', backgroundColor:'transparent',           tension:0.3, fill:false, pointRadius:3, borderWidth:1.5, borderDash:[5,3] },
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:'index', intersect:false },
        plugins:{
          legend:{ display:false },
          tooltip:{ callbacks:{ label: c => c.dataset.label+': '+Math.round(c.raw).toLocaleString('en-LK')+' LKR' } }
        },
        scales:{
          x:{ grid:{ display:false }, ticks:{ font:{ size:10 } } },
          y:{ grid:{ color:'rgba(128,128,128,0.07)' }, ticks:{ callback:v=>Math.round(v/1000)+'k', font:{ size:10 } } }
        }
      }
    });
  }

  // Hook into showTab and renderInsights so chart rebuilds when navigating to Insights
  const _origST = window.showTab;
  window.showTab = function(t){
    if(_origST) _origST(t);
    if(t==='insights') setTimeout(()=>{ const old=document.getElementById('trend-chart-patch'); if(old) old.remove(); buildTrendChart(); }, 200);
  };
  const _origRI = window.renderInsights;
  window.renderInsights = function(){
    if(_origRI) _origRI();
    setTimeout(()=>{ const old=document.getElementById('trend-chart-patch'); if(old) old.remove(); buildTrendChart(); }, 200);
  };

  // Run now if insights tab already active
  if(document.querySelector('#tab-insights.active')) buildTrendChart();
  console.log('patch: trend chart active');
})();

// ══════════════════════════════════════════════════════════════
// AFFORD PREVIEW — inline "can I afford this" in Add Item modal
// ══════════════════════════════════════════════════════════════
(function(){
  const _fmt = n => Math.round(n).toLocaleString('en-LK');
  const _toM = typeof toMonthly==='function' ? toMonthly : v=>v;
  const _cur = ()=> typeof currencySymbol!=='undefined' ? currencySymbol : 'LKR';

  function injectPreview(){
    if(document.getElementById('afford-preview')) return;
    const footer = document.querySelector('#item-overlay .modal-footer');
    if(!footer) return;
    const preview = document.createElement('div');
    preview.id = 'afford-preview';
    preview.style.cssText = 'margin:0 0 14px 0;border-radius:var(--radius);overflow:hidden;transition:all .3s;display:none;';
    footer.parentNode.insertBefore(preview, footer);
  }

  function updatePreview(){
    injectPreview();
    const preview = document.getElementById('afford-preview');
    if(!preview) return;
    const val  = parseFloat(document.getElementById('item-val')?.value) || 0;
    const freq = document.getElementById('item-freq')?.value || 'monthly';
    const name = document.getElementById('item-name')?.value?.trim() || 'this item';
    const isIncome = typeof itemModalType!=='undefined' ? itemModalType==='income' : false;
    if(!val){ preview.style.display='none'; return; }
    preview.style.display='block';
    const mv = Math.round(_toM(val, freq));
    const allItems = typeof items!=='undefined' ? items : [];
    const curInc = allItems.filter(i=>i.type==='income'&&i.on).reduce((s,i)=>s+_toM(i.val,i.freq),0);
    const curExp = allItems.filter(i=>i.type==='expense'&&i.on).reduce((s,i)=>s+_toM(i.val,i.freq),0);
    const purposeEl = document.getElementById('item-purpose');
    const isSaving = purposeEl?.value==='saving';
    const curSav = (typeof totalSavingsTagged==='function' ? totalSavingsTagged() : 0) + (isSaving&&!isIncome ? mv : 0);
    const newInc = isIncome ? curInc+mv : curInc;
    const newExp = isIncome ? curExp    : curExp+mv;
    const newBal = newInc - newExp;
    const curBal = curInc - curExp;
    const balDiff = newBal - curBal;
    const newRate = newInc>0 ? (curSav/newInc)*100 : 0;
    const curRate = curInc>0 ? ((typeof totalSavingsTagged==='function'?totalSavingsTagged():0)/curInc)*100 : 0;
    const rateDiff = newRate - curRate;
    const tightFloor = Math.max(curBal*0.2, 5000);
    const canAfford = newBal>=0;
    const tight = canAfford && newBal<tightFloor;
    const color   = !canAfford?'var(--danger)':tight?'var(--warning)':'var(--accent)';
    const bgColor = !canAfford?'var(--danger-light)':tight?'var(--warning-light)':'var(--accent-light)';
    const icon    = !canAfford?'ti-alert-triangle':tight?'ti-alert-circle':'ti-circle-check';
    const verdict = !canAfford
      ? `Adding <strong>${name}</strong> puts you in <strong>deficit</strong>`
      : tight
      ? `Affordable but tight — only <strong>${_fmt(newBal)} ${_cur()}</strong> left`
      : `✓ You can afford <strong>${name}</strong>`;
    preview.innerHTML = `
      <div style="background:${bgColor};border:1px solid ${color};border-radius:var(--radius);padding:12px 14px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <i class="ti ${icon}" style="color:${color};font-size:15px;flex-shrink:0;"></i>
          <div style="font-size:12px;">${verdict}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <div style="background:rgba(255,255,255,0.08);border-radius:6px;padding:8px;text-align:center;">
            <div style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Monthly cost</div>
            <div style="font-size:13px;font-weight:700;color:${color};">${_fmt(mv)}</div>
            <div style="font-size:9px;color:var(--text3);">${freq==='annual'?_fmt(Math.round(mv*12))+'/yr':freq==='weekly'?_fmt(Math.round(mv*52))+'/yr':'/mo'}</div>
          </div>
          <div style="background:rgba(255,255,255,0.08);border-radius:6px;padding:8px;text-align:center;">
            <div style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">New balance</div>
            <div style="font-size:13px;font-weight:700;color:${newBal>=0?'var(--accent)':'var(--danger)'};">${_fmt(newBal)}</div>
            <div style="font-size:9px;color:${balDiff>=0?'var(--accent)':'var(--danger)'};">${balDiff>=0?'+':''}${_fmt(balDiff)} vs now</div>
          </div>
          <div style="background:rgba(255,255,255,0.08);border-radius:6px;padding:8px;text-align:center;">
            <div style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Savings rate</div>
            <div style="font-size:13px;font-weight:700;">${newRate.toFixed(1)}%</div>
            <div style="font-size:9px;color:${rateDiff>=0?'var(--accent)':'var(--danger)'};">${rateDiff>=0?'+':''}${rateDiff.toFixed(1)}% vs now</div>
          </div>
        </div>
      </div>`;
  }

  function hookInputs(){
    ['item-val','item-freq','item-name','item-purpose'].forEach(id=>{
      const el=document.getElementById(id);
      if(el&&!el._affordHooked){
        el.addEventListener(id==='item-freq'||id==='item-purpose'?'change':'input', updatePreview);
        el._affordHooked=true;
      }
    });
  }

  const _origOpen = window.openItemModal;
  window.openItemModal = function(editId){
    if(_origOpen) _origOpen(editId);
    setTimeout(()=>{ injectPreview(); hookInputs(); updatePreview(); }, 150);
  };
  const _origSIT = window.setItemType;
  window.setItemType = function(t){
    if(_origSIT) _origSIT(t);
    setTimeout(updatePreview, 50);
  };
  if(document.getElementById('item-overlay')?.classList.contains('open')){
    injectPreview(); hookInputs(); updatePreview();
  }
  console.log('patch: afford preview active');
})();