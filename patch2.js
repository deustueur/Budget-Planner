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
  if (!window.BudgetPlanner) return;
  
  const origRHB = window.BudgetPlanner.renderHistoryBank;
  const origRI  = window.BudgetPlanner.renderInsights;

  function addX() {
    const grid = document.getElementById('history-grid');
    if (!grid) return;
    
    grid.querySelectorAll('.history-card').forEach(card => {
      if (card.querySelector('.bx')) return; 
      
      card.style.position = 'relative'; 
      
      let key = null;
      const onclickAttr = card.getAttribute('onclick') || '';
      const m = onclickAttr.match(/loadHistoryDetail\('([^']+)'/);
      if (m) key = m[1];
      
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
function patchInit() {
  if (!window.BudgetPlanner) {
    console.error('[patch] window.BudgetPlanner not found.');
    return;
  }
  injectStyles();
  loadLayout();
  
  // Tag timeline first
  const track = document.getElementById('cf-track');
  if (track && track.closest('.card')) { track.closest('.card').id = 'cf-timeline-card'; }
  
  buildCalendarCard(); 
  addStaticIds();      
  buildTabGrids();     
  
  injectGodUI();
  patchMetricsRender();
  patchBank();
  patchShowTab();
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
