// ==========================================
// patch.js — Dynamic Budget Planner Overrides (v6 - Complete)
// ==========================================
console.log("Patch v6 loaded.");

// ══════════════════════════════════════════════════════════════
// 1. PROFILE REFRESH FIX
// ══════════════════════════════════════════════════════════════
const _origLsSave = window.lsSave;
window.lsSave = function() {
  if (typeof _origLsSave === 'function') _origLsSave();
  try { localStorage.setItem('bp_active_profile', activeProfile); } catch(e) {}
};

window.addEventListener('load', () => {
  const saved = localStorage.getItem('bp_active_profile');
  if (saved && typeof setProfile === 'function') setProfile(saved);
});

// ══════════════════════════════════════════════════════════════
// 2. MASTER DATABASE BUTTON + MODAL (injected into sync-bar)
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {

  // Inject button into sync-bar
  const syncBar = document.querySelector('.sync-bar');
  if (syncBar && !document.getElementById('btn-master-format')) {
    const btn = document.createElement('button');
    btn.id = 'btn-master-format';
    btn.className = 'btn btn-sm';
    btn.innerHTML = '<i class="ti ti-database"></i> Master Site Database';
    btn.onclick = openFormatManager;
    syncBar.appendChild(btn);
  }

  // Inject modal if not present
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

// ══════════════════════════════════════════════════════════════
// 3. MASTER EXCEL DOWNLOAD
// ══════════════════════════════════════════════════════════════
function openFormatManager() {
  document.getElementById('format-manager-overlay').classList.add('open');
  document.getElementById('master-upload-status').innerHTML = '';
}

function downloadMasterTemplate() {
  if (typeof XLSX === 'undefined') { alert('Excel library loading, try again in a second.'); return; }

  const wb = XLSX.utils.book_new();

  // Items
  const itemsExp = items.map(i => ({
    ID: i.id, Type: i.type, Name: i.name, Amount: i.val, Frequency: i.freq,
    Category: i.cat || '', BudgetTag: i.tag || '', Purpose: i.purpose || '',
    Owner: i.owner, Active: i.on, DueDay: i.dueDay || 0, BufferDays: i.bufferDays || 0,
    SplitTrevin: i.splitRatio?.trevin || 0, SplitDulini: i.splitRatio?.dulini || 0,
    LinkedInstrument: i.instrumentLink || ''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsExp.length ? itemsExp : [{}]), 'Items');

  // Tracker actuals
  const trackerRows = [];
  Object.keys(trackerData).forEach(my => {
    Object.keys(trackerData[my]).forEach(k => {
      if (k !== 'routes') trackerRows.push({ MonthYear: my, ItemKey: k, ActualValue: trackerData[my][k] });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trackerRows.length ? trackerRows : [{ MonthYear:'', ItemKey:'', ActualValue:'' }]), 'TrackerActuals');

  // Savings
  const savExp = savingsStreams.map(s => ({ ID: s.id, Name: s.name, Balance: s.balance, Goal: s.goal || 0, Owner: s.owner, Color: s.color || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(savExp.length ? savExp : [{}]), 'Savings');

  // Instruments
  const instExp = instruments.map(i => ({ ID: i.id, Name: i.name, Type: i.type, Capital: i.capital || 0, Rate: i.rate || 0, Period: i.period || 0, Monthly: i.monthly || 0, Start: i.start || '', Units: i.units || 0, Price: i.price || 0, Owner: i.owner, Notes: i.notes || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(instExp.length ? instExp : [{}]), 'Instruments');

  // Events
  const evtExp = txEvents.map(e => ({ ID: e.id, SourceKey: e.sourceKey || '', SourceItem: e.sourceItem || '', Amount: e.amount || 0, Month: e.month, Year: e.year, Status: e.status || '', RouteType: e.routeType || '', RouteTarget: e.routeTarget || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evtExp.length ? evtExp : [{}]), 'Events');

  // Config
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ key: 'accountBalance', value: accountBalance }]), 'Config');

  XLSX.writeFile(wb, 'Budget_Site_Master.xlsx');
}

// ══════════════════════════════════════════════════════════════
// 4. MASTER EXCEL UPLOAD — overwrite site state
// ══════════════════════════════════════════════════════════════
function handleMasterUpload(event) {
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
      }, 2000);

    } catch(err) {
      statusEl.innerHTML = '<span style="color:var(--danger);"><i class="ti ti-alert-triangle"></i> Error: ensure you uploaded the exact .xlsx format.</span>';
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ══════════════════════════════════════════════════════════════
// 5. PURPOSE BADGE — open free-text tags
// ══════════════════════════════════════════════════════════════
const PURPOSE_COLOR_MAP = {
  saving:       { bg:'var(--accent-light)',  color:'var(--accent-dark)', border:'var(--accent)'   },
  investment:   { bg:'var(--gold-light)',    color:'var(--gold)',        border:'var(--gold)'     },
  loan:         { bg:'var(--danger-light)',  color:'var(--danger)',      border:'var(--danger)'   },
  fd:           { bg:'var(--info-light)',    color:'var(--info)',        border:'var(--info)'     },
  fund:         { bg:'var(--gold-light)',    color:'var(--gold)',        border:'var(--gold)'     },
  earning:      { bg:'var(--info-light)',    color:'var(--info)',        border:'var(--info)'     },
  living:       { bg:'var(--purple-light)',  color:'var(--purple)',      border:'var(--purple)'   },
  vehicle:      { bg:'var(--warning-light)', color:'var(--warning)',     border:'var(--warning)'  },
  entertainment:{ bg:'var(--pink-light)',    color:'var(--pink)',        border:'var(--pink)'     },
};

window.purposeBadgeHtml = function(purposeVal, itemId) {
  if (!purposeVal || !purposeVal.trim()) {
    return `<span class="purpose-badge add" onclick="promptSetPurpose('${itemId}')" title="Add a purpose tag">+ tag</span>`;
  }
  const key = purposeVal.trim().toLowerCase();
  const s = PURPOSE_COLOR_MAP[key] || { bg:'var(--surface3)', color:'var(--text2)', border:'var(--border)' };
  return `<span style="font-size:9px;padding:1px 6px;border-radius:99px;cursor:pointer;flex-shrink:0;border:1px solid ${s.border};background:${s.bg};color:${s.color};" onclick="promptSetPurpose('${itemId}')" title="Click to change">${purposeVal.trim()}</span>`;
};

window.promptSetPurpose = function(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  const v = prompt('Purpose tag (any word — saving, earning, living, vehicle, entertainment, or anything).\nLeave blank to remove.', item.purpose || '');
  if (v === null) return;
  item.purpose = v.trim().toLowerCase();
  if (typeof markDirty === 'function') markDirty();
  if (typeof recalc === 'function') recalc();
};

window.addEventListener('load', () => {
  // Patch buildItemRow to use open purpose badge
  if (typeof buildItemRow === 'function') {
    const _orig = window.buildItemRow;
    window.buildItemRow = function(item) {
      const el = _orig(item);
      if (el && el.querySelector) {
        const existing = el.querySelector('.purpose-badge, [onclick*="cyclePurpose"], [onclick*="promptSetPurpose"]');
        if (existing) {
          const tmp = document.createElement('span');
          tmp.innerHTML = window.purposeBadgeHtml(item.purpose, item.id);
          existing.replaceWith(tmp.firstChild);
        }
      }
      return el;
    };
    console.log('patch v6: buildItemRow patched for open purpose tags');
  }

  // Patch renderGlobalTable to use free-text input for purpose
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
            inp.type = 'text';
            inp.value = item.purpose || '';
            inp.placeholder = 'any tag';
            inp.style.cssText = 'width:80px;padding:2px 4px;border:1px solid var(--border);border-radius:3px;background:var(--surface2);color:var(--text);font-size:10px;font-family:inherit;';
            inp.onchange = () => {
              item.purpose = inp.value.trim().toLowerCase();
              if (typeof markDirty === 'function') markDirty();
              if (typeof recalc === 'function') recalc();
            };
            sel.replaceWith(inp);
          }
        });
      });
    };
    console.log('patch v6: renderGlobalTable patched — purpose is free text');
  }
});

// ══════════════════════════════════════════════════════════════
// 6. FULL LOCALSTORAGE PERSISTENCE
// ══════════════════════════════════════════════════════════════
window.lsSave = function() {
  try {
    localStorage.setItem('bp_state_v6', JSON.stringify({
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
      _v: 6, _ts: Date.now()
    }));
  } catch(e) { console.warn('lsSave failed:', e); }
};

window.lsLoad = function() {
  try {
    const raw = localStorage.getItem('bp_state_v6');
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || s._v !== 6) return false;

    if (Array.isArray(s.items) && s.items.length)
      items = s.items.map(i => ({ ...i, history: i.history || [], calEventId: i.calEventId || null }));
    if (s.trackerData)    trackerData    = s.trackerData;
    if (Array.isArray(s.savingsStreams))
      savingsStreams = s.savingsStreams.map(x => ({ ...x, history: x.history || [] }));
    if (Array.isArray(s.instruments))   instruments   = s.instruments;
    if (Array.isArray(s.txEvents))      txEvents      = s.txEvents.map(e => ({ ...e, chain: e.chain || [] }));
    if (s.monthHistory)   monthHistory   = s.monthHistory;
    if (s.monthNotes)     monthNotes     = s.monthNotes;
    if (typeof s.accountBalance === 'number') accountBalance = s.accountBalance;
    if (Array.isArray(s.templates))     templates     = s.templates;
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
    console.log('patch v6: state restored', new Date(s._ts).toLocaleTimeString());
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

  // Hook lsSave into markDirty
  if (typeof markDirty === 'function') {
    const _origMD = window.markDirty;
    window.markDirty = function(dirty) {
      _origMD(dirty);
      if (dirty !== false) window.lsSave();
    };
  } else {
    setInterval(window.lsSave, 10000);
  }

  window.addEventListener('beforeunload', window.lsSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') window.lsSave();
  });

  // Post-upload save hook
  if (typeof handleMasterUpload === 'function') {
    const _origHMU = window.handleMasterUpload;
    window.handleMasterUpload = function(event) {
      _origHMU(event);
      setTimeout(window.lsSave, 500);
    };
  }

  console.log('patch v6: all hooks installed');
});

// ══════════════════════════════════════════════════════════════
// 7. OPEN CATEGORY COLOURS
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  window.getCatColor = function(cat) {
    const map = typeof CAT_COLORS !== 'undefined' ? CAT_COLORS : {};
    return map[cat] || '#888780';
  }; // <--- THESE CLOSING BRACKETS WERE MISSING
});  // <--- THESE CLOSING BRACKETS WERE MISSING

// ══════════════════════════════════════════════════════════════
// 8. DASHBOARD LAYOUT RE-STRUCTURING
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  // Find the exact elements in your HTML
  const twoCol = document.querySelector('#tab-dashboard .two-col');
  const incomeCard = document.getElementById('income-card');
  const catChartCanvas = document.getElementById('catChart');
  
  if (twoCol && incomeCard && catChartCanvas) {
    const chartCard = catChartCanvas.closest('.chart-card');
    
    // 1. Create a new vertical wrapper for the left side
    const leftColumn = document.createElement('div');
    leftColumn.style.display = 'flex';
    leftColumn.style.flexDirection = 'column';
    leftColumn.style.gap = '14px'; // Matches your site's standard spacing
    
    // 2. Inject the wrapper into the grid, and move Income inside it
    twoCol.insertBefore(leftColumn, incomeCard);
    leftColumn.appendChild(incomeCard);
    
    // 3. Pull the Chart up from the bottom and place it right under Income
    leftColumn.appendChild(chartCard);
    
    // 4. Force the chart to shrink and fit its new, narrower home
    catChartCanvas.style.width = '100%';
    
    // Tell Chart.js to recalculate its size so it doesn't break out of the box
    setTimeout(() => {
        if (typeof catChart !== 'undefined' && catChart.resize) {
            catChart.resize();
        }
    }, 100);
  }
});

// ══════════════════════════════════════════════════════════════
// 9. CHART NORMALIZATION (Make small expenses visible)
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  setTimeout(() => {
    if (typeof updateCatChart === 'function') {
      const _origUCC = window.updateCatChart;
      window.updateCatChart = function() {
        _origUCC(); // Run the original chart calculation
        
        // Now tweak the visuals
        if (typeof catChart !== 'undefined' && catChart) {
          // Hide the bottom numbers to save space, make side text smaller
          catChart.options.scales.x.ticks = { display: false };
          catChart.options.scales.y.ticks = { font: { size: 9 } };
          
          // Boost the tiny bars so they don't disappear
          const data = catChart.data.datasets[0].data;
          if (data && data.length) {
            const maxVal = Math.max(...data);
            catChart.data.datasets[0].data = data.map(v => {
              if (v === 0) return 0;
              const norm = v / maxVal;
              return maxVal * Math.max(0.15, norm); // Floor at 15% of max width
            });
          }
          catChart.update('none');
        }
      };
    }
  }, 400); // Wait a split second for the site to load before patching
});
