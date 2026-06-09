Write the complete fixed patch.js
bash

cat > /home/claude/patch.js << 'PATCHEOF'
// ==========================================
// patch.js — Dynamic Budget Planner (v7 - Fixed)
// Working: bulk upload, sheet rebuild, compounding history,
//          localStorage persistence, purpose badges, sheet formulas.
// Fixed:   layout 40/60 split, delete X on history cards,
//          sheet overwrite full delete, notification clear,
//          purpose tags restored.
// ==========================================
console.log('Patch v7 loaded.');

// ══════════════════════════════════════════════════════════════
// 1. PROFILE SAVE
// ══════════════════════════════════════════════════════════════
const _origLsSave_v7 = window.lsSave;
window.lsSave = function() {
  if (typeof _origLsSave_v7 === 'function') _origLsSave_v7();
  try { localStorage.setItem('bp_active_profile', typeof activeProfile !== 'undefined' ? activeProfile : 'trevin'); } catch(e) {}
};

// ══════════════════════════════════════════════════════════════
// 2. MASTER DATABASE BUTTON + MODAL
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  const syncBar = document.querySelector('.sync-bar');
  if (syncBar && !document.getElementById('btn-master-format')) {
    const btn = document.createElement('button');
    btn.id = 'btn-master-format';
    btn.className = 'btn btn-sm';
    btn.innerHTML = '<i class="ti ti-database"></i> Master Site Database';
    btn.onclick = openFormatManager;
    syncBar.appendChild(btn);
  }
  if (!document.getElementById('format-manager-overlay')) {
    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="format-manager-overlay" onclick="if(event.target===this) this.classList.remove('open')">
      <div class="modal">
        <div class="modal-head">
          <span class="modal-title"><i class="ti ti-database" style="color:var(--danger);"></i> Master Database Control</span>
          <button class="modal-close" onclick="document.getElementById('format-manager-overlay').classList.remove('open')"><i class="ti ti-x"></i></button>
        </div>
        <div style="padding:16px;font-size:13px;color:var(--text2);line-height:1.5;">
          <p style="margin-bottom:12px;">Download your current site state as a multi-tab Excel workbook. Audit or adjust anything in Excel, then upload it back to completely overwrite the site.</p>
          <button class="btn btn-sm" style="margin-bottom:16px;width:100%;justify-content:center;background:var(--info-light);color:var(--info);border-color:var(--info);" onclick="downloadMasterTemplate()">
            <i class="ti ti-download"></i> Download Site Master (.xlsx)
          </button>
          <div style="border:2px dashed var(--danger);border-radius:var(--radius);padding:30px 20px;text-align:center;cursor:pointer;transition:all 0.2s;" onclick="document.getElementById('master-upload-file').click()">
            <i class="ti ti-upload" style="font-size:28px;margin-bottom:8px;display:block;color:var(--danger);"></i>
            Upload Master File to Overwrite Site<br>
            <span style="font-size:10px;opacity:0.7;">Must be the exported .xlsx format</span>
          </div>
          <input type="file" id="master-upload-file" accept=".xlsx" style="display:none;" onchange="handleMasterUpload(event)">
          <div id="master-upload-status" style="margin-top:12px;font-weight:600;text-align:center;"></div>
        </div>
      </div>
    </div>`);
  }
});

window.openFormatManager = function() {
  document.getElementById('format-manager-overlay').classList.add('open');
  document.getElementById('master-upload-status').innerHTML = '';
};

// ══════════════════════════════════════════════════════════════
// 3. MASTER EXCEL DOWNLOAD
// ══════════════════════════════════════════════════════════════
window.downloadMasterTemplate = function() {
  if (typeof XLSX === 'undefined') { alert('Excel library loading, try again.'); return; }
  const wb = XLSX.utils.book_new();
  const itemsExp = items.map(i => ({
    ID: i.id, Type: i.type, Name: i.name, Amount: i.val, Frequency: i.freq,
    Category: i.cat || '', BudgetTag: i.tag || '', Purpose: i.purpose || '',
    Owner: i.owner, Active: i.on, DueDay: i.dueDay || 0, BufferDays: i.bufferDays || 0,
    SplitTrevin: i.splitRatio?.trevin || 0, SplitDulini: i.splitRatio?.dulini || 0,
    LinkedInstrument: i.instrumentLink || ''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsExp.length ? itemsExp : [{}]), 'Items');
  const trackerRows = [];
  Object.keys(trackerData).forEach(my => {
    Object.keys(trackerData[my]).forEach(k => {
      if (k !== 'routes') trackerRows.push({ MonthYear: my, ItemKey: k, ActualValue: trackerData[my][k] });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trackerRows.length ? trackerRows : [{ MonthYear:'', ItemKey:'', ActualValue:'' }]), 'TrackerActuals');
  const savExp = savingsStreams.map(s => ({ ID: s.id, Name: s.name, Balance: s.balance, Goal: s.goal || 0, Owner: s.owner, Color: s.color || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(savExp.length ? savExp : [{}]), 'Savings');
  const instExp = instruments.map(i => ({ ID: i.id, Name: i.name, Type: i.type, Capital: i.capital || 0, Rate: i.rate || 0, Period: i.period || 0, Monthly: i.monthly || 0, Start: i.start || '', Units: i.units || 0, Price: i.price || 0, Owner: i.owner, Notes: i.notes || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(instExp.length ? instExp : [{}]), 'Instruments');
  const evtExp = txEvents.map(e => ({ ID: e.id, SourceKey: e.sourceKey || '', SourceItem: e.sourceItem || '', Amount: e.amount || 0, Month: e.month, Year: e.year, Status: e.status || '', RouteType: e.routeType || '', RouteTarget: e.routeTarget || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evtExp.length ? evtExp : [{}]), 'Events');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ key: 'accountBalance', value: accountBalance }]), 'Config');
  XLSX.writeFile(wb, 'Budget_Site_Master.xlsx');
};

// ══════════════════════════════════════════════════════════════
// 4. MASTER UPLOAD — overwrite site + prompt sheet rebuild
// ══════════════════════════════════════════════════════════════
window.handleMasterUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('master-upload-status');
  statusEl.innerHTML = '<span style="color:var(--text2);"><i class="ti ti-loader"></i> Rebuilding site...</span>';
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      if (wb.Sheets['Items']) {
        items = XLSX.utils.sheet_to_json(wb.Sheets['Items']).filter(r => r.Name).map(r => ({
          id: r.ID || (typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2)),
          type: r.Type, name: r.Name, val: parseFloat(r.Amount) || 0,
          freq: r.Frequency || 'monthly', cat: r.Category || '',
          tag: r.BudgetTag || '', purpose: r.Purpose || '',
          owner: r.Owner || 'shared',
          on: String(r.Active).toLowerCase() === 'true' || r.Active === true,
          dueDay: parseInt(r.DueDay) || 0, bufferDays: parseInt(r.BufferDays) || 0,
          splitRatio: { trevin: parseFloat(r.SplitTrevin) || 0, dulini: parseFloat(r.SplitDulini) || 0 },
          instrumentLink: r.LinkedInstrument || '', history: [], calEventId: null
        }));
      }
      if (wb.Sheets['Savings']) {
        savingsStreams = XLSX.utils.sheet_to_json(wb.Sheets['Savings']).filter(r => r.Name).map(r => ({
          id: r.ID || (typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2)),
          name: r.Name, balance: parseFloat(r.Balance) || 0,
          goal: parseFloat(r.Goal) || 0, owner: r.Owner || 'shared',
          color: r.Color || 'var(--accent)', history: []
        }));
      }
      if (wb.Sheets['Instruments']) {
        instruments = XLSX.utils.sheet_to_json(wb.Sheets['Instruments']).filter(r => r.Name).map(r => ({
          id: r.ID || (typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2)),
          name: r.Name, type: r.Type || 'loan',
          capital: parseFloat(r.Capital) || 0, rate: parseFloat(r.Rate) || 0,
          period: parseInt(r.Period) || 0, monthly: parseFloat(r.Monthly) || 0,
          start: r.Start || '', units: parseFloat(r.Units) || 0,
          price: parseFloat(r.Price) || 0, owner: r.Owner || 'shared', notes: r.Notes || ''
        }));
      }
      if (wb.Sheets['TrackerActuals']) {
        trackerData = {};
        XLSX.utils.sheet_to_json(wb.Sheets['TrackerActuals']).forEach(r => {
          if (r.MonthYear && r.ItemKey) {
            if (!trackerData[r.MonthYear]) trackerData[r.MonthYear] = {};
            trackerData[r.MonthYear][r.ItemKey] = parseFloat(r.ActualValue) || 0;
          }
        });
      }
      if (wb.Sheets['Events']) {
        txEvents = XLSX.utils.sheet_to_json(wb.Sheets['Events']).filter(r => r.Month && r.Year).map(r => ({
          id: r.ID || (typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2)),
          sourceKey: r.SourceKey || '', sourceItem: r.SourceItem || '',
          amount: parseFloat(r.Amount) || 0, month: parseInt(r.Month), year: parseInt(r.Year),
          dateLabel: (typeof MS !== 'undefined' ? MS[parseInt(r.Month)] : '') + ' ' + r.Year,
          status: r.Status || 'untagged', routeType: r.RouteType || '',
          routeTarget: r.RouteTarget || '', chain: []
        }));
      }
      if (wb.Sheets['Config']) {
        const conf = XLSX.utils.sheet_to_json(wb.Sheets['Config']);
        const balRow = conf.find(c => c.key === 'accountBalance');
        if (balRow) accountBalance = parseFloat(balRow.value) || 0;
      }
      if (typeof recalc === 'function') recalc();
      if (typeof renderTracker === 'function') renderTracker();
      window.lsSave();
      statusEl.innerHTML = '<span style="color:var(--accent);"><i class="ti ti-check"></i> OVERWRITE COMPLETE. Site database synchronized.</span>';
      setTimeout(() => {
        document.getElementById('format-manager-overlay').classList.remove('open');
        event.target.value = '';
        if (typeof accessToken !== 'undefined' && accessToken) {
          if (confirm('Site updated from master file.\n\nOverwrite the Google Sheet to match the site now?\n\nThis fully rebuilds the sheet with formulas.')) {
            executeFullSheetRebuild();
          }
        }
      }, 1500);
    } catch(err) {
      statusEl.innerHTML = '<span style="color:var(--danger);"><i class="ti ti-alert-triangle"></i> Error: ensure you uploaded the exact .xlsx format.</span>';
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
};

// ══════════════════════════════════════════════════════════════
// 5. PURPOSE BADGE — open free-text tags (all tags from v6 restored)
// ══════════════════════════════════════════════════════════════
const PURPOSE_COLOR_MAP = {
  saving:        { bg:'var(--accent-light)',  color:'var(--accent-dark)', border:'var(--accent)'   },
  investment:    { bg:'var(--gold-light)',    color:'var(--gold)',        border:'var(--gold)'     },
  loan:          { bg:'var(--danger-light)',  color:'var(--danger)',      border:'var(--danger)'   },
  fd:            { bg:'var(--info-light)',    color:'var(--info)',        border:'var(--info)'     },
  fund:          { bg:'var(--gold-light)',    color:'var(--gold)',        border:'var(--gold)'     },
  earning:       { bg:'var(--info-light)',    color:'var(--info)',        border:'var(--info)'     },
  living:        { bg:'var(--purple-light)',  color:'var(--purple)',      border:'var(--purple)'   },
  vehicle:       { bg:'var(--warning-light)', color:'var(--warning)',     border:'var(--warning)'  },
  entertainment: { bg:'var(--pink-light)',    color:'var(--pink)',        border:'var(--pink)'     },
};

window.purposeBadgeHtml = function(purposeVal, itemId) {
  if (!purposeVal || !purposeVal.trim()) {
    return `<span class="purpose-badge add" onclick="promptSetPurpose('${itemId}')" title="Add a purpose tag">+ tag</span>`;
  }
  const key = purposeVal.trim().toLowerCase();
  const s = PURPOSE_COLOR_MAP[key] || { bg:'var(--surface3)', color:'var(--text2)', border:'var(--border)' };
  return `<span style="font-size:9px;padding:1px 6px;border-radius:99px;cursor:pointer;flex-shrink:0;border:1px solid ${s.border};background:${s.bg};color:${s.color};" onclick="promptSetPurpose('${itemId}')" title="Click to change">${purposeVal.trim()}</span>`;
};

// Both names work — promptSetPurpose and patchPromptPurpose
window.promptSetPurpose = window.patchPromptPurpose = function(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  const v = prompt('Purpose tag (saving, earning, living, vehicle, entertainment, or any word).\nLeave blank to remove.', item.purpose || '');
  if (v === null) return;
  item.purpose = v.trim().toLowerCase();
  if (typeof markDirty === 'function') markDirty();
  if (typeof recalc === 'function') recalc();
};

window.addEventListener('load', () => {
  // Patch buildItemRow for open purpose badges
  if (typeof buildItemRow === 'function') {
    const _orig = window.buildItemRow;
    window.buildItemRow = function(item) {
      const el = _orig(item);
      if (el && el.querySelector) {
        const existing = el.querySelector('.purpose-badge, [onclick*="cyclePurpose"], [onclick*="promptSetPurpose"], [onclick*="patchPromptPurpose"]');
        if (existing) {
          const tmp = document.createElement('span');
          tmp.innerHTML = window.purposeBadgeHtml(item.purpose, item.id);
          if (tmp.firstChild) existing.replaceWith(tmp.firstChild);
        }
      }
      return el;
    };
    console.log('patch v7: buildItemRow patched');
  }

  // Patch renderGlobalTable — purpose as free text input
  if (typeof renderGlobalTable === 'function') {
    const _origRGT = window.renderGlobalTable;
    window.renderGlobalTable = function() {
      _origRGT();
      const tbody = document.getElementById('global-tbody');
      if (!tbody) return;
      tbody.querySelectorAll('tr').forEach((row, idx) => {
        const item = items[idx];
        if (!item) return;
        row.querySelectorAll('select').forEach(sel => {
          const vals = Array.from(sel.options).map(o => o.value);
          if (vals.includes('saving') && vals.includes('loan')) {
            const inp = document.createElement('input');
            inp.type = 'text'; inp.value = item.purpose || ''; inp.placeholder = 'any tag';
            inp.style.cssText = 'width:80px;padding:2px 4px;border:1px solid var(--border);border-radius:3px;background:var(--surface2);color:var(--text);font-size:10px;font-family:inherit;';
            inp.onchange = () => { item.purpose = inp.value.trim().toLowerCase(); if (typeof markDirty === 'function') markDirty(); if (typeof recalc === 'function') recalc(); };
            sel.replaceWith(inp);
          }
        });
      });
    };
    console.log('patch v7: renderGlobalTable patched');
  }
});

// ══════════════════════════════════════════════════════════════
// 6. FULL LOCALSTORAGE PERSISTENCE
// ══════════════════════════════════════════════════════════════
window.lsSave = function() {
  try {
    localStorage.setItem('bp_state_v7', JSON.stringify({
      items, trackerData, savingsStreams, instruments, txEvents, monthHistory,
      monthNotes:        typeof monthNotes        !== 'undefined' ? monthNotes        : {},
      accountBalance:    typeof accountBalance    !== 'undefined' ? accountBalance    : 0,
      templates:         typeof templates         !== 'undefined' ? templates         : [],
      settlementHistory: typeof settlementHistory !== 'undefined' ? settlementHistory : [],
      currencySymbol:    typeof currencySymbol    !== 'undefined' ? currencySymbol    : 'LKR',
      currencyLocale:    typeof currencyLocale    !== 'undefined' ? currencyLocale    : 'en-LK',
      isDarkTheme:       typeof isDarkTheme       !== 'undefined' ? isDarkTheme       : false,
      activeProfile:     typeof activeProfile     !== 'undefined' ? activeProfile     : 'trevin',
      connections:       typeof connections       !== 'undefined' ? connections.map(c=>({...c,active:false})) : [],
      insightHistory:    window._insightHistory   || {},
      suppressedNotifs:  window._suppressedNotifs ? Array.from(window._suppressedNotifs) : [],
      _v: 7, _ts: Date.now()
    }));
  } catch(e) { console.warn('lsSave failed:', e); }
};

window.lsLoad = function() {
  try {
    const raw = localStorage.getItem('bp_state_v7') || localStorage.getItem('bp_state_v6');
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s) return false;
    if (Array.isArray(s.items) && s.items.length)
      items = s.items.map(i => ({ ...i, history: i.history || [], calEventId: i.calEventId || null }));
    if (s.trackerData)    trackerData    = s.trackerData;
    if (Array.isArray(s.savingsStreams))
      savingsStreams = s.savingsStreams.map(x => ({ ...x, history: x.history || [] }));
    if (Array.isArray(s.instruments))   instruments    = s.instruments;
    if (Array.isArray(s.txEvents))      txEvents       = s.txEvents.map(e => ({ ...e, chain: e.chain || [] }));
    if (s.monthHistory)   monthHistory   = s.monthHistory;
    if (s.monthNotes)     monthNotes     = s.monthNotes;
    if (typeof s.accountBalance === 'number') accountBalance = s.accountBalance;
    if (Array.isArray(s.templates))     templates      = s.templates;
    if (Array.isArray(s.settlementHistory)) settlementHistory = s.settlementHistory;
    if (s.currencySymbol) currencySymbol = s.currencySymbol;
    if (s.currencyLocale) currencyLocale = s.currencyLocale;
    if (typeof s.isDarkTheme === 'boolean') isDarkTheme = s.isDarkTheme;
    if (s.activeProfile)  activeProfile  = s.activeProfile;
    if (Array.isArray(s.connections) && s.connections.length) {
      connections = s.connections;
      const def = connections.find(c => c.id === 'default');
      if (def) {
        if (typeof DEFAULT_CLIENT_ID  !== 'undefined') def.clientId  = DEFAULT_CLIENT_ID;
        if (typeof SPREADSHEET_ID     !== 'undefined') def.sheetId   = SPREADSHEET_ID;
        if (typeof DEFAULT_SHEET_NAME !== 'undefined') def.sheetName = DEFAULT_SHEET_NAME;
      }
      if (typeof activeConn !== 'undefined') activeConn = connections[0];
    }
    if (s.insightHistory) window._insightHistory = s.insightHistory;
    if (Array.isArray(s.suppressedNotifs)) window._suppressedNotifs = new Set(s.suppressedNotifs);
    console.log('patch v7: state restored', new Date(s._ts).toLocaleTimeString());
    return true;
  } catch(e) { console.warn('lsLoad failed:', e); return false; }
};

window.addEventListener('load', () => {
  if (window.lsLoad()) {
    if (typeof applyTheme        === 'function') applyTheme();
    if (typeof recalc            === 'function') recalc();
    if (typeof updateEventsBadge === 'function') updateEventsBadge();
    if (typeof buildNotifications=== 'function') buildNotifications();
    if (typeof renderTemplates   === 'function') renderTemplates();
    if (typeof setProfile        === 'function') setProfile(activeProfile || 'trevin');
  }
  if (typeof markDirty === 'function') {
    const _origMD = window.markDirty;
    window.markDirty = function(dirty) {
      _origMD(dirty);
      if (dirty !== false) window.lsSave();
    };
  } else {
    setInterval(window.lsSave, 8000);
  }
  window.addEventListener('beforeunload', window.lsSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') window.lsSave();
  });
  // Restore profile
  const savedProfile = localStorage.getItem('bp_active_profile');
  if (savedProfile && typeof setProfile === 'function') setProfile(savedProfile);
  console.log('patch v7: persistence hooks installed');
});

// ══════════════════════════════════════════════════════════════
// 7. NOTIFICATION CLEAR — persistent suppression
// ══════════════════════════════════════════════════════════════
if (!window._suppressedNotifs) window._suppressedNotifs = new Set();

// Override clearNotifs to actually persist the suppression
window.clearNotifs = function() {
  // Suppress all current notification types
  if (typeof notifications !== 'undefined') {
    notifications.forEach(n => {
      const key = n.type + '|' + (n.title || '');
      window._suppressedNotifs.add(key);
    });
  }
  // Also suppress by category
  ['due','event','goal','loan','cal','success'].forEach(t => window._suppressedNotifs.add(t + '|suppress_all'));
  // Clear the array and update UI
  if (typeof notifications !== 'undefined') notifications = [];
  const list = document.getElementById('notif-list');
  if (list) list.innerHTML = '<div style="padding:14px;font-size:12px;color:var(--text3);text-align:center;">All clear!</div>';
  const dd = document.getElementById('notif-dropdown');
  if (dd) dd.style.display = 'none';
  const bell = document.getElementById('notif-bell');
  const countEl = bell ? bell.querySelector('.notif-count') : null;
  if (countEl) countEl.style.display = 'none';
  window.lsSave();
};

// Patch buildNotifications to respect suppression
window.addEventListener('load', () => {
  if (typeof buildNotifications === 'function') {
    const _origBN = window.buildNotifications;
    window.buildNotifications = function() {
      _origBN();
      // Filter out suppressed notifications
      if (typeof notifications !== 'undefined' && window._suppressedNotifs.size > 0) {
        // Check if all types suppressed
        const allSuppressed = ['due','event','goal','loan','cal','success'].every(t =>
          window._suppressedNotifs.has(t + '|suppress_all')
        );
        if (allSuppressed) {
          notifications = [];
          const bell = document.getElementById('notif-bell');
          const countEl = bell ? bell.querySelector('.notif-count') : null;
          if (countEl) countEl.style.display = 'none';
          const list = document.getElementById('notif-list');
          if (list) list.innerHTML = '<div style="padding:14px;font-size:12px;color:var(--text3);text-align:center;">All clear!</div>';
        } else {
          // Filter individual suppressed keys
          notifications = notifications.filter(n => {
            const key = n.type + '|' + (n.title || '');
            return !window._suppressedNotifs.has(key);
          });
        }
      }
    };
  }
  // Add a "Resume notifications" button to the dropdown
  setTimeout(() => {
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown && !document.getElementById('notif-resume-btn')) {
      const footer = document.createElement('div');
      footer.style.cssText = 'padding:8px 14px;border-top:1px solid var(--border);text-align:center;';
      footer.innerHTML = '<button id="notif-resume-btn" class="btn btn-sm btn-ghost" onclick="resumeNotifs()" style="font-size:11px;width:100%;">Resume notifications</button>';
      dropdown.appendChild(footer);
    }
  }, 800);
});

window.resumeNotifs = function() {
  window._suppressedNotifs = new Set();
  window.lsSave();
  if (typeof buildNotifications === 'function') buildNotifications();
};

// ══════════════════════════════════════════════════════════════
// 8. DASHBOARD LAYOUT — 40/60 split, all within progress bar width
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  setTimeout(() => {
    // Inject layout CSS
    const style = document.createElement('style');
    style.id = 'patch-v7-layout';
    style.textContent = `
      /* ── Dashboard layout override ───────────────────── */
      /* Force everything to sit within the progress bar boundary */
      #tab-dashboard .main,
      #tab-dashboard > * {
        max-width: 100%;
      }

      /* The bbar-card is 100% — everything below aligns to it */
      .bbar-card {
        width: 100%;
      }

      /* Remove the old two-col grid that split income/expenses 50/50 */
      .two-col {
        display: grid !important;
        grid-template-columns: 40fr 60fr !important;
        gap: 14px;
        margin-bottom: 14px;
        align-items: start;
        width: 100%;
      }

      /* Tagged savings panel — full width of its column (40%) */
      #dash-savings-panel {
        width: 100%;
        margin-bottom: 14px;
      }

      /* Spending by category chart — sits in the left column */
      /* We move it into the layout via JS below */
      #patch-cat-chart-wrap {
        width: 100%;
      }

      /* Left column wrapper — holds savings + income + chart */
      #patch-left-col {
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-width: 0;
      }

      /* Right column — expenses full height */
      #income-card,
      #expense-card {
        min-height: unset !important;
      }

      /* Chart card inside left column — no extra margin */
      #patch-cat-chart-wrap .chart-card {
        margin-bottom: 0 !important;
        width: 100%;
      }

      /* Responsive: stack on mobile */
      @media (max-width: 720px) {
        .two-col {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);

    // Now restructure the DOM of the dashboard
    // Target elements
    const dashboard = document.getElementById('tab-dashboard');
    if (!dashboard) return;

    const savingsPanel  = document.getElementById('dash-savings-panel');
    const incomeCard    = document.getElementById('income-card');
    const expenseCard   = document.getElementById('expense-card');
    const twoCol        = dashboard.querySelector('.two-col');

    // Find the chart card containing catChart
    let catChartCard = null;
    dashboard.querySelectorAll('.chart-card').forEach(el => {
      if (el.querySelector('#catChart')) catChartCard = el;
    });

    if (!twoCol || !incomeCard || !expenseCard) {
      console.warn('patch v7: layout elements not found');
      return;
    }

    // Build left column wrapper if not already done
    if (!document.getElementById('patch-left-col')) {
      const leftCol = document.createElement('div');
      leftCol.id = 'patch-left-col';

      // Move savings panel into left col (it's currently above the two-col)
      if (savingsPanel && savingsPanel.parentNode) {
        savingsPanel.parentNode.removeChild(savingsPanel);
        leftCol.appendChild(savingsPanel);
      }

      // Move income card into left col
      leftCol.appendChild(incomeCard);

      // Move chart card into left col
      if (catChartCard && catChartCard.parentNode) {
        catChartCard.parentNode.removeChild(catChartCard);
        catChartCard.style.marginBottom = '0';
        const chartWrap = document.createElement('div');
        chartWrap.id = 'patch-cat-chart-wrap';
        chartWrap.appendChild(catChartCard);
        leftCol.appendChild(chartWrap);
      }

      // The two-col now becomes our grid container
      // Clear it and put left col + expense card in it
      twoCol.innerHTML = '';
      twoCol.style.cssText = 'display:grid;grid-template-columns:40fr 60fr;gap:14px;margin-bottom:14px;align-items:start;width:100%;';
      twoCol.appendChild(leftCol);
      twoCol.appendChild(expenseCard);
    }

    console.log('patch v7: dashboard layout applied');
  }, 500);
});

// ══════════════════════════════════════════════════════════════
// 9. COMPOUNDING HISTORY — persistent storage + delete with working X
// ══════════════════════════════════════════════════════════════
if (!window._insightHistory) window._insightHistory = {};

window.addEventListener('load', () => {
  setTimeout(() => { _patchImportModal(); }, 700);
});

function _patchImportModal() {
  const importOverlay = document.getElementById('import-overlay');
  if (!importOverlay) return;

  // Add Download History Bank button to modal header
  const modalHead = importOverlay.querySelector('.modal-head');
  if (modalHead && !document.getElementById('btn-dl-history-bank')) {
    const dlBtn = document.createElement('button');
    dlBtn.id = 'btn-dl-history-bank';
    dlBtn.className = 'btn btn-sm';
    dlBtn.style.cssText = 'background:var(--info-light);color:var(--info);border-color:var(--info);margin-right:8px;';
    dlBtn.innerHTML = '<i class="ti ti-download"></i> History Bank';
    dlBtn.onclick = downloadHistoryBank;
    modalHead.insertBefore(dlBtn, modalHead.lastElementChild);
  }

  // Inject stored history panel
  if (!document.getElementById('history-bank-panel')) {
    const localPanel = document.getElementById('import-panel-local');
    if (localPanel) {
      const bankEl = document.createElement('div');
      bankEl.id = 'history-bank-panel';
      bankEl.style.cssText = 'margin-top:14px;border-top:1px solid var(--border);padding-top:12px;';
      bankEl.innerHTML = `
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">Stored History Files</div>
        <div id="history-bank-list"></div>`;
      localPanel.appendChild(bankEl);
    }
  }
  renderHistoryBankList();
}

function renderHistoryBankList() {
  const el = document.getElementById('history-bank-list');
  if (!el) return;
  const keys = Object.keys(window._insightHistory).sort().reverse();
  if (!keys.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:8px 0;">No history files stored yet. Upload files above to build your history.</div>';
    return;
  }
  // Use inline onclick with data attribute — avoids icon font issues with the X button
  el.innerHTML = keys.map(key => {
    const entry = window._insightHistory[key];
    const [y, m] = key.split('-');
    const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    const uploadDate = entry.uploadedAt ? new Date(entry.uploadedAt).toLocaleDateString() : '—';
    // Use × (HTML entity) instead of icon font for the delete button — always renders
    return `<div style="display:flex;align-items:center;gap:9px;padding:7px 10px;background:var(--surface2);border-radius:var(--radius);margin-bottom:5px;font-size:12px;">
      <i class="ti ti-calendar-stats" style="color:var(--accent);flex-shrink:0;font-size:14px;"></i>
      <div style="flex:1;">
        <strong>${label}</strong>
        <span style="font-size:10px;color:var(--text3);margin-left:6px;">uploaded ${uploadDate} &middot; ${entry.fileName || 'file'}</span>
      </div>
      <button
        onclick="window.deleteHistoryEntry('${key}')"
        title="Remove from history bank"
        style="width:22px;height:22px;border-radius:99px;border:1px solid var(--danger);background:var(--danger-light);color:var(--danger);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;line-height:1;flex-shrink:0;padding:0;font-family:inherit;">
        &times;
      </button>
    </div>`;
  }).join('');
}

window.deleteHistoryEntry = function(key) {
  if (!confirm('Remove ' + key + ' from history bank?')) return;
  delete window._insightHistory[key];
  if (typeof monthHistory !== 'undefined') delete monthHistory[key];
  if (typeof trackerData !== 'undefined') delete trackerData[key];
  window.lsSave();
  renderHistoryBankList();
  if (typeof renderInsights === 'function') renderInsights();
};

// Intercept confirmImport to store in history bank
window.addEventListener('load', () => {
  setTimeout(() => {
    if (typeof confirmImport === 'function') {
      const _origCI = window.confirmImport;
      window.confirmImport = async function() {
        await _origCI();
        if (typeof importQueue !== 'undefined') {
          importQueue.forEach(f => {
            if (!f.monthKey || f.error) return;
            window._insightHistory[f.monthKey] = {
              fileName: f.filename,
              uploadedAt: Date.now(),
              monthKey: f.monthKey,
              snapshot: monthHistory[f.monthKey] ? JSON.parse(JSON.stringify(monthHistory[f.monthKey])) : null,
              trackerSnapshot: trackerData[f.monthKey] ? JSON.parse(JSON.stringify(trackerData[f.monthKey])) : null
            };
          });
        }
        window.lsSave();
        renderHistoryBankList();
      };
    }
  }, 900);
});

// Download history bank as compounding xlsx
window.downloadHistoryBank = function() {
  if (typeof XLSX === 'undefined') { alert('Excel library not ready.'); return; }
  const wb = XLSX.utils.book_new();
  const summaryRows = [['Month','Total Income','Total Expenses','Balance','Saved','Trevin Expenses','Dulini Expenses','Source File','Uploaded']];
  Object.keys(window._insightHistory).sort().forEach(key => {
    const e = window._insightHistory[key];
    const h = e.snapshot || monthHistory[key] || {};
    const [y, m] = key.split('-');
    const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    summaryRows.push([label, h.totalIncome||0, h.totalExpenses||0, (h.totalIncome||0)-(h.totalExpenses||0), h.totalSaved||0, h.perPerson?.trevin?.expenses||0, h.perPerson?.dulini?.expenses||0, e.fileName||'', e.uploadedAt ? new Date(e.uploadedAt).toLocaleDateString() : '']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
  Object.keys(window._insightHistory).sort().forEach(key => {
    const e = window._insightHistory[key];
    const td = e.trackerSnapshot || trackerData[key] || {};
    const [y, m] = key.split('-');
    const label = ((typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y).replace(/[^a-zA-Z0-9 ]/g,'').slice(0,31);
    const rows = [['ItemKey','ActualValue','MonthYear']];
    Object.entries(td).forEach(([k,v]) => { if (k !== 'routes') rows.push([k,v,key]); });
    try { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), label); } catch(e2) {}
  });
  const itemsExp = items.map(i => ({ ID:i.id, Type:i.type, Name:i.name, Amount:i.val, Frequency:i.freq, Category:i.cat||'', BudgetTag:i.tag||'', Purpose:i.purpose||'', Owner:i.owner, Active:i.on, DueDay:i.dueDay||0, BufferDays:i.bufferDays||0, SplitTrevin:i.splitRatio?.trevin||0, SplitDulini:i.splitRatio?.dulini||0 }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsExp.length ? itemsExp : [{}]), 'Items');
  XLSX.writeFile(wb, 'Budget_History_Bank.xlsx');
};

// ══════════════════════════════════════════════════════════════
// 10. FULL SHEET REBUILD WITH FORMULAS + FULL DELETE BEFORE WRITE
// ══════════════════════════════════════════════════════════════
window.executeFullSheetRebuild = async function() {
  if (typeof accessToken === 'undefined' || !accessToken) { alert('Connect to Google first.'); return; }
  const sheetId = (typeof activeConn !== 'undefined') ? activeConn.sheetId : (typeof SPREADSHEET_ID !== 'undefined' ? SPREADSHEET_ID : null);
  if (!sheetId) { alert('No sheet ID found.'); return; }
  const sheetName = (typeof activeConn !== 'undefined') ? activeConn.sheetName : (typeof DEFAULT_SHEET_NAME !== 'undefined' ? DEFAULT_SHEET_NAME : 'Dynamic Budget Planner');
  if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Full sheet rebuild...');

  try {
    const _api = window.apiCall || async function(method, url, body) {
      const opts = { method, headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' } };
      if (body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    };

    // Get existing sheets
    const meta = await _api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`);
    const existingSheets = meta.sheets.map(s => ({ title: s.properties.title, id: s.properties.sheetId }));
    const needed = [sheetName, 'Tracker', 'Savings', 'Instruments', 'Events', 'Data'];

    // FIX: Delete ALL existing sheets by replacing with fresh ones
    // We keep exactly one sheet (can't delete all), rename it, then delete the rest and add fresh
    const batchReqs = [];

    // Rename first sheet to a temp name so we can cleanly add all needed tabs
    batchReqs.push({ updateSheetProperties: { properties: { sheetId: existingSheets[0].id, title: '__temp_keep__' }, fields: 'title' } });
    // Delete all other existing sheets
    existingSheets.slice(1).forEach(s => batchReqs.push({ deleteSheet: { sheetId: s.id } }));
    // Add all needed tabs fresh
    needed.forEach(title => batchReqs.push({ addSheet: { properties: { title } } }));

    await _api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, { requests: batchReqs });

    // Now delete the temp sheet (it's no longer needed)
    const meta2 = await _api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`);
    const tempSheet = meta2.sheets.find(s => s.properties.title === '__temp_keep__');
    if (tempSheet) {
      await _api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        requests: [{ deleteSheet: { sheetId: tempSheet.properties.sheetId } }]
      });
    }

    const inc = items.filter(i => i.type === 'income');
    const exp = items.filter(i => i.type === 'expense');
    const cur = (typeof currencySymbol !== 'undefined') ? currencySymbol : 'LKR';
    const toMo = (typeof toMonthly === 'function') ? toMonthly : (v) => v;

    // ── DASHBOARD TAB ─────────────────────────────────────────
    const dashRows = [];
    dashRows.push(['TREVIN & DULINI — BUDGET PLANNER', '', '', '', new Date().toLocaleDateString()]);
    dashRows.push(['', '', '', '', '']);
    const incStartRow = dashRows.length + 1;
    dashRows.push(['INCOME', 'Budget (' + cur + ')', 'Owner', 'Purpose', '']);
    inc.forEach(i => dashRows.push([i.name, i.on ? Math.round(toMo(i.val, i.freq)) : 0, i.owner, i.purpose || '', '']));
    const incEndRow = dashRows.length;
    dashRows.push(['Total Income', `=SUM(B${incStartRow + 1}:B${incEndRow})`, '', '', '']);
    const totalIncRow = dashRows.length;
    dashRows.push(['', '', '', '', '']);
    const expStartRow = dashRows.length + 1;
    dashRows.push(['EXPENSES', 'Budget (' + cur + ')', 'Category', 'Purpose', '']);
    exp.forEach(i => dashRows.push([i.name, i.on ? Math.round(toMo(i.val, i.freq)) : 0, i.cat || '', i.purpose || '', '']));
    const expEndRow = dashRows.length;
    dashRows.push(['Total Expenses', `=SUM(B${expStartRow + 1}:B${expEndRow})`, '', '', '']);
    const totalExpRow = dashRows.length;
    dashRows.push(['', '', '', '', '']);
    dashRows.push(['Monthly Balance', `=B${totalIncRow}-B${totalExpRow}`, '', '', `=IF(B${dashRows.length}>0,"✅ SURPLUS","⚠️ DEFICIT")`]);
    const balanceRow = dashRows.length;
    dashRows.push(['Savings Rate', `=IFERROR(SUMIF(D${incStartRow+1}:D${expEndRow},"saving",B${incStartRow+1}:B${expEndRow})/B${totalIncRow}*100,0)&"%"`, '', '', '']);
    dashRows.push(['Daily Budget', `=IFERROR(B${balanceRow}/30,0)`, '', '', '']);

    await _api('PUT', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'"+sheetName+"'!A1")}?valueInputOption=USER_ENTERED`, { values: dashRows });

    // ── TRACKER TAB ───────────────────────────────────────────
    const now = new Date();
    const tkey = now.getFullYear() + '-' + now.getMonth();
    const td = (typeof trackerData !== 'undefined' && trackerData[tkey]) ? trackerData[tkey] : {};
    const trackerRows = [];
    trackerRows.push([`TRACKER — ${typeof MS !== 'undefined' ? MS[now.getMonth()] : ''} ${now.getFullYear()}`, '', '', '', '', '']);
    trackerRows.push(['Item', 'Budget', 'Actual', 'Variance', 'Owner', 'Purpose']);
    trackerRows.push(['INCOME', '', '', '', '', '']);
    const tIncStart = trackerRows.length;
    inc.forEach(i => {
      const b = i.on ? Math.round(toMo(i.val, i.freq)) : 0;
      const a = td['inc_' + i.id] !== undefined && td['inc_' + i.id] !== '' ? td['inc_' + i.id] : '';
      const row = trackerRows.length + 1;
      trackerRows.push([i.name, b, a !== '' ? a : '', a !== '' ? `=C${row}-B${row}` : '', i.owner, i.purpose || '']);
    });
    const tIncEnd = trackerRows.length;
    trackerRows.push(['Total Income', `=SUM(B${tIncStart+1}:B${tIncEnd})`, `=SUM(C${tIncStart+1}:C${tIncEnd})`, `=C${trackerRows.length+1}-B${trackerRows.length+1}`, '', '']);
    const tTotalIncRow = trackerRows.length;
    trackerRows.push(['', '', '', '', '', '']);
    trackerRows.push(['EXPENSES', '', '', '', '', '']);
    const tExpStart = trackerRows.length;
    exp.forEach(i => {
      const b = i.on ? Math.round(toMo(i.val, i.freq)) : 0;
      const a = td['exp_' + i.id] !== undefined && td['exp_' + i.id] !== '' ? td['exp_' + i.id] : '';
      const row = trackerRows.length + 1;
      trackerRows.push([i.name, b, a !== '' ? a : '', a !== '' ? `=B${row}-C${row}` : '', i.owner, i.purpose || '']);
    });
    const tExpEnd = trackerRows.length;
    trackerRows.push(['Total Expenses', `=SUM(B${tExpStart+1}:B${tExpEnd})`, `=SUM(C${tExpStart+1}:C${tExpEnd})`, `=B${trackerRows.length+1}-C${trackerRows.length+1}`, '', '']);
    const tTotalExpRow = trackerRows.length;
    trackerRows.push(['', '', '', '', '', '']);
    trackerRows.push(['Net Balance', `=B${tTotalIncRow}-B${tTotalExpRow}`, `=C${tTotalIncRow}-C${tTotalExpRow}`, `=C${trackerRows.length+1}-B${trackerRows.length+1}`, '', '']);
    await _api('PUT', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Tracker'!A1")}?valueInputOption=USER_ENTERED`, { values: trackerRows });

    // ── SAVINGS TAB ───────────────────────────────────────────
    const savRows = [['SAVINGS STREAMS','','','',''],['Name','Balance ('+cur+')','Goal ('+cur+')','Progress','Owner']];
    if (typeof savingsStreams !== 'undefined') {
      savingsStreams.forEach(s => {
        const row = savRows.length + 1;
        savRows.push([s.name, s.balance, s.goal||0, s.goal>0?`=IFERROR(B${row}/C${row}*100,0)&"%"`:'—', s.owner]);
      });
    }
    savRows.push(['','','','','']);
    savRows.push(['Total Saved', `=SUM(B3:B${savRows.length-1})`, '','','']);
    await _api('PUT', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Savings'!A1")}?valueInputOption=USER_ENTERED`, { values: savRows });

    // ── INSTRUMENTS TAB ───────────────────────────────────────
    const instrRows = [['FINANCIAL INSTRUMENTS','','','','','','','','',''],['Name','Type','Capital ('+cur+')','Rate (%)','Period (mo)','Monthly ('+cur+')','Owner','Start','Total Cost','Total Interest']];
    if (typeof instruments !== 'undefined') {
      instruments.forEach(i => {
        const row = instrRows.length + 1;
        instrRows.push([i.name, i.type, i.capital||0, i.rate||0, i.period||0, i.monthly||0, i.owner, i.start||'', i.type==='loan'?`=F${row}*E${row}`:'', i.type==='loan'?`=I${row}-C${row}`:'']);
      });
    }
    await _api('PUT', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Instruments'!A1")}?valueInputOption=USER_ENTERED`, { values: instrRows });

    // ── EVENTS TAB ────────────────────────────────────────────
    const evtRows = [['TRANSACTION EVENTS','','','','','',''],['Source Item','Amount ('+cur+')','Month','Year','Status','Routed To','Date']];
    if (typeof txEvents !== 'undefined') {
      txEvents.forEach(e => evtRows.push([e.sourceItem||'', e.amount||0, e.month, e.year, e.status||'', e.routeTargetName||'', e.dateLabel||'']));
    }
    evtRows.push(['','','','','','','']);
    evtRows.push(['Total surplus routed', `=SUMIF(E3:E${evtRows.length-1},"tagged",B3:B${evtRows.length-1})`, '','','','','']);
    await _api('PUT', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Events'!A1")}?valueInputOption=USER_ENTERED`, { values: evtRows });

    // ── DATA TAB (sync source for pull) ──────────────────────
    const dataRows = [
      ['##META','version=3','Full rebuild by Budget Planner v7', new Date().toISOString()],
      ['##INCOME',''],
      ...inc.map(i => [i.name, i.on?Math.round(toMo(i.val,i.freq)):0, i.owner, i.purpose||'', i.dueDay||'']),
      ['##EXPENSE',''],
      ...exp.map(i => [i.name, i.on?Math.round(toMo(i.val,i.freq)):0, i.owner, i.purpose||'', i.dueDay||''])
    ];
    await _api('PUT', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Data'!A1")}?valueInputOption=USER_ENTERED`, { values: dataRows });

    // ── CONDITIONAL FORMATTING ────────────────────────────────
    const meta3 = await _api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`);
    const sheetMap = {};
    meta3.sheets.forEach(s => { sheetMap[s.properties.title] = s.properties.sheetId; });
    const fmtReqs = [];
    // Freeze headers
    [sheetName, 'Tracker'].forEach(tab => {
      if (sheetMap[tab] !== undefined) {
        fmtReqs.push({ updateSheetProperties: { properties: { sheetId: sheetMap[tab], gridProperties: { frozenRowCount: 2 } }, fields: 'gridProperties.frozenRowCount' } });
      }
    });
    // Balance green/red
    if (sheetMap[sheetName] !== undefined) {
      const bri = balanceRow - 1;
      fmtReqs.push({ addConditionalFormatRule: { rule: { ranges: [{ sheetId: sheetMap[sheetName], startRowIndex: bri, endRowIndex: bri+1, startColumnIndex: 1, endColumnIndex: 2 }], booleanRule: { condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '0' }] }, format: { backgroundColor: { red:0.85,green:0.96,blue:0.88 }, textFormat: { foregroundColor: { red:0.05,green:0.49,blue:0.27 }, bold: true } } } }, index: 0 } });
      fmtReqs.push({ addConditionalFormatRule: { rule: { ranges: [{ sheetId: sheetMap[sheetName], startRowIndex: bri, endRowIndex: bri+1, startColumnIndex: 1, endColumnIndex: 2 }], booleanRule: { condition: { type: 'NUMBER_LESS', values: [{ userEnteredValue: '0' }] }, format: { backgroundColor: { red:0.99,green:0.91,blue:0.91 }, textFormat: { foregroundColor: { red:0.89,green:0.18,blue:0.18 }, bold: true } } } }, index: 1 } });
    }
    // Tracker variance green/red
    if (sheetMap['Tracker'] !== undefined) {
      fmtReqs.push({ addConditionalFormatRule: { rule: { ranges: [{ sheetId: sheetMap['Tracker'], startRowIndex: 2, endRowIndex: 200, startColumnIndex: 3, endColumnIndex: 4 }], booleanRule: { condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '0' }] }, format: { textFormat: { foregroundColor: { red:0.05,green:0.49,blue:0.27 }, bold: true } } } }, index: 0 } });
      fmtReqs.push({ addConditionalFormatRule: { rule: { ranges: [{ sheetId: sheetMap['Tracker'], startRowIndex: 2, endRowIndex: 200, startColumnIndex: 3, endColumnIndex: 4 }], booleanRule: { condition: { type: 'NUMBER_LESS', values: [{ userEnteredValue: '0' }] }, format: { textFormat: { foregroundColor: { red:0.89,green:0.18,blue:0.18 }, bold: true } } } }, index: 1 } });
    }
    if (fmtReqs.length) await _api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, { requests: fmtReqs });

    if (typeof setSyncStatus === 'function') setSyncStatus('connected', 'Sheet fully rebuilt');
    if (typeof setLastSync === 'function') setLastSync();
    alert('✅ Google Sheet fully rebuilt!\n\nAll old data deleted. Fresh tabs with live formulas:\n• Dashboard, Tracker, Savings, Instruments, Events, Data\n\nConditional formatting applied.');
  } catch(err) {
    if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Rebuild failed: ' + err.message.slice(0,40));
    console.error('Sheet rebuild failed:', err);
    alert('Sheet rebuild failed: ' + err.message);
  }
};

// ══════════════════════════════════════════════════════════════
// 11. WIRE Overwrite Sheet button to full rebuild
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  setTimeout(() => {
    const owBtn = document.querySelector('[onclick="executeOverwrite()"]');
    if (owBtn) {
      owBtn.onclick = function() {
        const sid = document.getElementById('ow-sheet-id');
        const sn  = document.getElementById('ow-sheet-name');
        if (sid?.value && typeof activeConn !== 'undefined') activeConn.sheetId   = sid.value.trim();
        if (sn?.value  && typeof activeConn !== 'undefined') activeConn.sheetName = sn.value.trim();
        const overlay = document.getElementById('overwrite-overlay');
        if (overlay) overlay.classList.remove('open');
        executeFullSheetRebuild();
      };
    }
  }, 600);
});

// ══════════════════════════════════════════════════════════════
// 12. STOP AUTO-PUSH on recalc
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  if (typeof debouncePush === 'function') {
    window.debouncePush = function() {};
    console.log('patch v7: auto-push disabled');
  }
});

// ══════════════════════════════════════════════════════════════
// 13. OPEN CATEGORY COLOURS
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  window.getCatColor = function(cat) {
    const map = typeof CAT_COLORS !== 'undefined' ? CAT_COLORS : {};
    return map[cat] || '#888780';
  };
});

console.log('patch v7: all features registered.');
PATCHEOF
