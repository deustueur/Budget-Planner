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

// ══════════════════════════════════════════════════════════════
// 10. FULL SHEET REBUILD ENGINE (Live Formulas & Formatting)
// ══════════════════════════════════════════════════════════════

// 1. Wire the "Overwrite now" button from your UI to the Rebuild Engine
window.executeOverwrite = async function() {
  if (typeof accessToken === 'undefined' || !accessToken) { alert('Connect to Google first.'); return; }
  
  const sheetIdEl = document.getElementById('ow-sheet-id');
  const sheetNameEl = document.getElementById('ow-sheet-name');
  
  if (sheetIdEl && sheetIdEl.value && typeof activeConn !== 'undefined') {
    activeConn.sheetId = sheetIdEl.value.trim();
  }
  if (sheetNameEl && sheetNameEl.value && typeof activeConn !== 'undefined') {
    activeConn.sheetName = sheetNameEl.value.trim();
  }
  
  const overlay = document.getElementById('overwrite-overlay');
  if (overlay) overlay.classList.remove('open');
  
  window.executeFullSheetRebuild();
};

// 2. Intercept the Master Upload to prompt the Rebuild Engine
if (typeof window.handleMasterUpload === 'function') {
  const _origHMU = window.handleMasterUpload;
  window.handleMasterUpload = function(event) {
    _origHMU(event); // Run the standard upload and memory replacement
    
    // Wait 2.1 seconds for the original upload's UI closing animation to finish, then prompt
    setTimeout(() => {
      if (typeof accessToken !== 'undefined' && accessToken) {
        if (confirm('Site updated from master file.\n\nOverwrite the Google Sheet to match the site now?\n\nThis fully rebuilds the sheet with formulas.')) {
          window.executeFullSheetRebuild();
        }
      }
    }, 2100); 
  };
}

// 3. The Core Rebuild Engine
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
    const batchReqs = [];

    // Delete ALL existing sheets by renaming the first one, deleting the rest, and adding fresh ones
    batchReqs.push({ updateSheetProperties: { properties: { sheetId: existingSheets[0].id, title: '__temp_keep__' }, fields: 'title' } });
    existingSheets.slice(1).forEach(s => batchReqs.push({ deleteSheet: { sheetId: s.id } }));
    needed.forEach(title => batchReqs.push({ addSheet: { properties: { title } } }));
    
    await _api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, { requests: batchReqs });

    // Now delete the temp sheet
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
// 11. COMPOUNDING HISTORY BANK (Store, view, delete, download)
// ══════════════════════════════════════════════════════════════

// 1. Initialize the History Bank from local storage
if (!window._insightHistory) {
  try {
    const stored = localStorage.getItem('bp_history_bank');
    window._insightHistory = stored ? JSON.parse(stored) : {};
  } catch(e) { window._insightHistory = {}; }
}

// 2. Patch lsSave to always save the History Bank
const _origLsSaveHist = window.lsSave;
window.lsSave = function() {
  if (typeof _origLsSaveHist === 'function') _origLsSaveHist();
  try { localStorage.setItem('bp_history_bank', JSON.stringify(window._insightHistory)); } catch(e) {}
};

window.addEventListener('load', () => {
  setTimeout(() => {
    // 3. Inject UI into the Import Modal
    const importOverlay = document.getElementById('import-overlay');
    if (importOverlay) {
      const modalHead = importOverlay.querySelector('.modal-head');
      if (modalHead && !document.getElementById('btn-dl-history-bank')) {
        const dlBtn = document.createElement('button');
        dlBtn.id = 'btn-dl-history-bank';
        dlBtn.className = 'btn btn-sm';
        dlBtn.style.cssText = 'background:var(--info-light);color:var(--info);border-color:var(--info);margin-right:8px;';
        dlBtn.innerHTML = '<i class="ti ti-download"></i> Download History Bank';
        dlBtn.onclick = window.downloadHistoryBank;
        modalHead.insertBefore(dlBtn, modalHead.lastElementChild);
      }

      const localPanel = document.getElementById('import-panel-local');
      if (localPanel && !document.getElementById('history-bank-panel')) {
        const bankEl = document.createElement('div');
        bankEl.id = 'history-bank-panel';
        bankEl.style.cssText = 'margin-top:14px;border-top:1px solid var(--border);padding-top:12px;';
        bankEl.innerHTML = `
          <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">
            Stored History Files
          </div>
          <div id="history-bank-list"></div>`;
        localPanel.appendChild(bankEl);
      }
      window.renderHistoryBankList();
    }

    // 4. Intercept the Import function to save files to the Bank
    if (typeof confirmImport === 'function' && !window._origConfirmImportPatched) {
      const _origCI = window.confirmImport;
      window._origConfirmImportPatched = true;
      window.confirmImport = async function() {
        await _origCI(); // Run original import
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
        window.renderHistoryBankList();
      };
    }
  }, 800);
});

// 5. Render the list of files with Delete buttons
window.renderHistoryBankList = function() {
  const el = document.getElementById('history-bank-list');
  if (!el) return;
  const keys = Object.keys(window._insightHistory).sort().reverse();
  if (!keys.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:8px 0;">No history files stored yet. Upload files above to build your history.</div>';
    return;
  }
  
  el.innerHTML = keys.map(key => {
    const entry = window._insightHistory[key];
    const [y, m] = key.split('-');
    const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    const uploadDate = entry.uploadedAt ? new Date(entry.uploadedAt).toLocaleDateString() : '—';
    return `<div style="display:flex;align-items:center;gap:9px;padding:7px 10px;background:var(--surface2);border-radius:var(--radius);margin-bottom:5px;font-size:12px;">
      <i class="ti ti-calendar-stats" style="color:var(--accent);flex-shrink:0;font-size:14px;"></i>
      <div style="flex:1;">
        <strong>${label}</strong>
        <span style="font-size:10px;color:var(--text3);margin-left:6px;">uploaded ${uploadDate} &middot; ${entry.fileName || 'file'}</span>
      </div>
      <button onclick="window.deleteHistoryEntry('${key}')" style="width:22px;height:22px;border-radius:99px;border:1px solid var(--danger);background:var(--danger-light);color:var(--danger);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;line-height:1;flex-shrink:0;padding:0;" title="Remove from history bank">
        &times;
      </button>
    </div>`;
  }).join('');
};

// 6. Delete a file from the bank
window.deleteHistoryEntry = function(key) {
  if (!confirm(`Remove ${key} from history bank?`)) return;
  delete window._insightHistory[key];
  if (typeof monthHistory !== 'undefined') delete monthHistory[key];
  if (typeof trackerData !== 'undefined') delete trackerData[key];
  window.lsSave();
  window.renderHistoryBankList();
  if (typeof renderInsights === 'function') renderInsights();
};

// 7. Compile and Download the History Bank
window.downloadHistoryBank = function() {
  if (typeof XLSX === 'undefined') { alert('Excel library not ready.'); return; }
  const wb = XLSX.utils.book_new();
  
  const summaryRows = [['Month', 'Total Income', 'Total Expenses', 'Balance', 'Saved', 'Trevin Expenses', 'Dulini Expenses', 'Source File', 'Uploaded']];
  Object.keys(window._insightHistory).sort().forEach(key => {
    const e = window._insightHistory[key];
    const h = e.snapshot || monthHistory[key] || {};
    const [y, m] = key.split('-');
    const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    summaryRows.push([label, h.totalIncome || 0, h.totalExpenses || 0, (h.totalIncome || 0) - (h.totalExpenses || 0), h.totalSaved || 0, h.perPerson?.trevin?.expenses || 0, h.perPerson?.dulini?.expenses || 0, e.fileName || '', e.uploadedAt ? new Date(e.uploadedAt).toLocaleDateString() : '']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

  Object.keys(window._insightHistory).sort().forEach(key => {
    const e = window._insightHistory[key];
    const td = e.trackerSnapshot || trackerData[key] || {};
    const [y, m] = key.split('-');
    const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    const rows = [['ItemKey', 'ActualValue', 'MonthYear']];
    Object.entries(td).forEach(([k, v]) => { if (k !== 'routes') rows.push([k, v, key]); });
    try { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), label.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 31)); } catch(e2) {}
  });

  const itemsExp = items.map(i => ({ ID: i.id, Type: i.type, Name: i.name, Amount: i.val, Frequency: i.freq, Category: i.cat || '', BudgetTag: i.tag || '', Purpose: i.purpose || '', Owner: i.owner, Active: i.on, DueDay: i.dueDay || 0, BufferDays: i.bufferDays || 0, SplitTrevin: i.splitRatio?.trevin || 0, SplitDulini: i.splitRatio?.dulini || 0 }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsExp.length ? itemsExp : [{}]), 'Items');
  XLSX.writeFile(wb, 'Budget_History_Bank.xlsx');
};

// ══════════════════════════════════════════════════════════════
// COMPREHENSIVE HISTORY BANK DOWNLOAD
// ══════════════════════════════════════════════════════════════
window.downloadHistoryBank = function() {
  if (typeof XLSX === 'undefined') { alert('Excel library not ready.'); return; }
  const wb = XLSX.utils.book_new();
  
  const summaryRows = [['Month', 'Total Income', 'Total Expenses', 'Balance', 'Saved', 'Trevin Expenses', 'Dulini Expenses', 'Source File', 'Uploaded']];
  
  // Combine all known months from all site memory layers
  const allKeys = new Set([
    ...Object.keys(window._insightHistory || {}),
    ...Object.keys(window.monthHistory || {}),
    ...Object.keys(window.trackerData || {})
  ]);

  Array.from(allKeys).sort().forEach(key => {
    const e = (window._insightHistory && window._insightHistory[key]) || {};
    const h = e.snapshot || (window.monthHistory && window.monthHistory[key]) || {};
    const td = e.trackerSnapshot || (window.trackerData && window.trackerData[key]) || {};
    
    // Skip completely blank internal scaffolding months
    if (!h.totalIncome && !h.totalExpenses && Object.keys(td).length === 0) return;

    const [y, m] = key.split('-');
    const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    summaryRows.push([
      label,
      h.totalIncome || 0, h.totalExpenses || 0,
      (h.totalIncome || 0) - (h.totalExpenses || 0),
      h.totalSaved || 0,
      h.perPerson?.trevin?.expenses || 0,
      h.perPerson?.dulini?.expenses || 0,
      e.fileName || 'Site Memory', e.uploadedAt ? new Date(e.uploadedAt).toLocaleDateString() : '—'
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

  // Per-month tracker actuals sheets (for ALL memory)
  Array.from(allKeys).sort().forEach(key => {
    const e = (window._insightHistory && window._insightHistory[key]) || {};
    const td = e.trackerSnapshot || (window.trackerData && window.trackerData[key]) || {};
    if (Object.keys(td).length === 0) return;

    const [y, m] = key.split('-');
    const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    const rows = [['ItemKey', 'ActualValue', 'MonthYear']];
    Object.entries(td).forEach(([k, v]) => { if (k !== 'routes') rows.push([k, v, key]); });
    try { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), label.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 31)); } catch(e2) {}
  });

  const itemsExp = items.map(i => ({ ID: i.id, Type: i.type, Name: i.name, Amount: i.val, Frequency: i.freq, Category: i.cat || '', BudgetTag: i.tag || '', Purpose: i.purpose || '', Owner: i.owner, Active: i.on, DueDay: i.dueDay || 0, BufferDays: i.bufferDays || 0, SplitTrevin: i.splitRatio?.trevin || 0, SplitDulini: i.splitRatio?.dulini || 0 }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsExp.length ? itemsExp : [{}]), 'Items');
  XLSX.writeFile(wb, 'Budget_History_Bank.xlsx');
};

// ══════════════════════════════════════════════════════════════
// IMPORT QUEUE RED 'X' & MULTI-SHEET PARSER
// ══════════════════════════════════════════════════════════════
window.removeQueuedFile = function(index) {
  if (typeof importQueue !== 'undefined') {
    importQueue.splice(index, 1);
    if (typeof renderImportPreview === 'function') window.renderImportPreview();
  }
};

window.addEventListener('load', () => {
  setTimeout(() => {
    // Override the renderer to inject the Red 'X'
    if (typeof renderImportPreview === 'function') {
      window.renderImportPreview = function() {
        const el = document.getElementById('import-local-preview');
        if (!importQueue.length) { el.innerHTML = ''; return; }
        
        let html = `<div style="font-size:12px;font-weight:600;margin-bottom:10px;">${importQueue.length} dataset${importQueue.length > 1 ? 's' : ''} ready to import:</div>`;
        
        importQueue.forEach((f, fi) => {
          const statusColor = f.error ? 'var(--danger)' : f.monthKey ? 'var(--accent)' : 'var(--warning)';
          const statusText = f.error ? 'Error: ' + f.error : f.monthKey ? '→ ' + keyToLabel(f.monthKey) : 'Month not detected';
          
          html += `<div style="border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;margin-bottom:7px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span style="font-size:12px;font-weight:500;"><i class="ti ti-file-spreadsheet" style="color:var(--info);"></i> ${f.filename}</span>
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:10px;color:${statusColor};">${statusText}</span>
                <button onclick="window.removeQueuedFile(${fi})" style="width:20px;height:20px;border-radius:99px;border:1px solid var(--danger);background:var(--danger-light);color:var(--danger);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;line-height:1;padding:0;" title="Remove file">&times;</button>
              </div>
            </div>
            ${!f.monthKey && !f.error ? `<div style="margin-top:7px;display:flex;align-items:center;gap:7px;">
              <span style="font-size:11px;color:var(--text2);">Assign to:</span>
              <select class="form-select" style="width:auto;font-size:11px;" onchange="importQueue[${fi}].monthKey=this.value; window.renderImportPreview();">
                <option value="">— select month —</option>
                ${generateMonthOptions()}
              </select>
            </div>` : ''}
            ${f.rows && f.rows.length > 0 ? `<div style="font-size:10px;color:var(--text3);margin-top:4px;">${f.rows.length} rows detected</div>` : ''}
          </div>`;
        });
        el.innerHTML = html;
        document.getElementById('import-confirm-btn').style.display = '';
      };
    }

    // Override the file handler to read MULTIPLE sheets (to support History Bank uploads)
    if (typeof handleImportFiles === 'function') {
      window.handleImportFiles = function(files) {
        if (!files || !files.length) return;
        window.importQueue = [];
        const fileArr = Array.from(files);
        let processed = 0;
        const preview = document.getElementById('import-local-preview');
        if (preview) preview.innerHTML = `<div style="font-size:12px;color:var(--text2);margin-bottom:8px;">Processing ${fileArr.length} file${fileArr.length > 1 ? 's' : ''}...</div>`;
        
        fileArr.forEach(file => {
          const reader = new FileReader();
          reader.onload = ev => {
            try {
              if (file.name.endsWith('.csv')) {
                const rows = parseCSVtoRows(ev.target.result);
                const monthKey = detectMonthFromFilename(file.name);
                window.importQueue.push({ filename: file.name, monthKey, rows, source: 'local' });
              } else {
                const wb = XLSX.read(ev.target.result, { type: 'binary' });
                
                // Parse every sheet in the workbook
                wb.SheetNames.forEach(sheetName => {
                  // Skip system/meta sheets
                  if (['Summary', 'Items', 'Config', 'Instruments', 'Savings', 'Events', 'Dashboard'].includes(sheetName)) return;
                  
                  const rows = parseCSVtoRows(XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]));
                  if (!rows || rows.length === 0) return;
                  
                  // Detect month from the sheet name first, then fallback to filename
                  const monthKey = detectMonthFromFilename(sheetName) || detectMonthFromFilename(file.name);
                  
                  window.importQueue.push({
                    filename: wb.SheetNames.length > 3 ? `${file.name} — [${sheetName}]` : file.name,
                    monthKey,
                    rows,
                    source: 'local'
                  });
                });
              }
            } catch(err) {
              window.importQueue.push({ filename: file.name, monthKey: null, rows: [], source: 'local', error: err.message });
            }
            processed++;
            if (processed === fileArr.length && typeof window.renderImportPreview === 'function') {
              window.renderImportPreview();
            }
          };
          if (file.name.endsWith('.csv')) reader.readAsText(file);
          else reader.readAsBinaryString(file);
        });
      };
    }
  }, 800);
});

// ══════════════════════════════════════════════════════════════
// 14. HISTORY BANK LOOP: Human-Readable Export & Import Math Fix
// ══════════════════════════════════════════════════════════════

// --- Fix 1: Human-Readable History Bank Export & Blank Template ---
window.downloadHistoryBank = function() {
  if (typeof XLSX === 'undefined') { alert('Excel library not ready.'); return; }
  const wb = XLSX.utils.book_new();

  const allKeys = new Set([
    ...Object.keys(window._insightHistory || {}),
    ...Object.keys(window.monthHistory || {}),
    ...Object.keys(window.trackerData || {})
  ]);

  const summaryRows = [['Month', 'Total Income', 'Total Expenses', 'Balance', 'Saved', 'Trevin Expenses', 'Dulini Expenses', 'Source File', 'Uploaded']];

  if (allKeys.size > 0) {
    Array.from(allKeys).sort().forEach(key => {
      const e = (window._insightHistory && window._insightHistory[key]) || {};
      const h = e.snapshot || (window.monthHistory && window.monthHistory[key]) || {};
      const td = e.trackerSnapshot || (window.trackerData && window.trackerData[key]) || {};
      if (!h.totalIncome && !h.totalExpenses && Object.keys(td).length === 0) return;

      const [y, m] = key.split('-');
      const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
      summaryRows.push([
        label, h.totalIncome || 0, h.totalExpenses || 0, (h.totalIncome || 0) - (h.totalExpenses || 0), h.totalSaved || 0,
        h.perPerson?.trevin?.expenses || 0, h.perPerson?.dulini?.expenses || 0,
        e.fileName || 'Site Memory', e.uploadedAt ? new Date(e.uploadedAt).toLocaleDateString() : '—'
      ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
  }

  // Generate Data Tabs for every month in memory (or a blank one if empty)
  const exportMonths = allKeys.size > 0 ? Array.from(allKeys).sort() : ['template'];

  exportMonths.forEach(key => {
    let td = {};
    let label = 'Template - ' + (typeof MS !== 'undefined' ? MS[new Date().getMonth()] : '') + ' ' + new Date().getFullYear();

    if (key !== 'template') {
      const e = (window._insightHistory && window._insightHistory[key]) || {};
      td = e.trackerSnapshot || (window.trackerData && window.trackerData[key]) || {};
      if (Object.keys(td).length === 0) return;
      const [y, m] = key.split('-');
      label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    }

    // Build human-readable rows
    const rows = [['Item', 'Type', 'Budget', 'Actual']];
    const inc = items.filter(i => i.type === 'income');
    const exp = items.filter(i => i.type === 'expense');

    inc.forEach(i => {
      const a = td['inc_' + i.id];
      rows.push([i.name, 'Income', i.val, a !== undefined ? a : '']);
    });
    exp.forEach(i => {
      const a = td['exp_' + i.id];
      rows.push([i.name, 'Expense', i.val, a !== undefined ? a : '']);
    });

    const sheetName = label.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 31);
    try { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName); } catch(e2) {}
  });

  // Maintain items configuration
  const itemsExp = items.map(i => ({ ID: i.id, Type: i.type, Name: i.name, Amount: i.val, Frequency: i.freq, Category: i.cat || '', BudgetTag: i.tag || '', Purpose: i.purpose || '', Owner: i.owner, Active: i.on, DueDay: i.dueDay || 0, BufferDays: i.bufferDays || 0, SplitTrevin: i.splitRatio?.trevin || 0, SplitDulini: i.splitRatio?.dulini || 0 }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsExp.length ? itemsExp : [{}]), 'Items');
  XLSX.writeFile(wb, 'Budget_History_Bank.xlsx');
};

// --- Fix 2: Proper Upload Math to Feed the Insights Charts ---
window.processImportRows = function(rows, monthKey) {
  if (!trackerData[monthKey]) trackerData[monthKey] = {};
  const td = trackerData[monthKey];

  let actualIncome = 0;
  let actualExpenses = 0;
  let trevinExp = 0;
  let duliniExp = 0;

  rows.forEach(row => {
    // Map from the human-readable 'Item' and 'Actual' columns
    const name = (row['item'] || row['name'] || row['description'] || '').trim().toLowerCase();
    const actual = parseFloat(row['actual'] || row['actual (lkr)'] || row['amount'] || 0) || 0;
    if (!name || !actual) return;

    const matchedItem = items.find(i => i.name.toLowerCase() === name || i.name.toLowerCase().includes(name.split(' ')[0]));
    if (matchedItem && actual > 0) {
      const prefix = matchedItem.type === 'income' ? 'inc_' : 'exp_';
      td[prefix + matchedItem.id] = actual;

      if (matchedItem.type === 'income') {
        actualIncome += actual;
      } else {
        actualExpenses += actual;
        if (matchedItem.owner === 'trevin') trevinExp += actual;
        else if (matchedItem.owner === 'dulini') duliniExp += actual;
        else {
          trevinExp += actual * ((matchedItem.splitRatio?.trevin || 50) / 100);
          duliniExp += actual * ((matchedItem.splitRatio?.dulini || 50) / 100);
        }
      }
    }
  });

  // Calculate the Insights history purely based on your typed actuals
  monthHistory[monthKey] = {
    totalIncome: actualIncome,
    totalExpenses: actualExpenses,
    balance: actualIncome - actualExpenses,
    totalSaved: 0,
    perPerson: { trevin: { expenses: trevinExp, income: 0 }, dulini: { expenses: duliniExp, income: 0 } },
    imported: true
  };
};

// --- Fix 3: Red 'X' on Bulk Upload Queue ---
window.removeQueuedFile = function(index) {
  if (typeof importQueue !== 'undefined') {
    importQueue.splice(index, 1);
    if (typeof renderImportPreview === 'function') window.renderImportPreview();
  }
};

window.addEventListener('load', () => {
  setTimeout(() => {
    if (typeof renderImportPreview === 'function') {
      window.renderImportPreview = function() {
        const el = document.getElementById('import-local-preview');
        if (!importQueue.length) { el.innerHTML = ''; return; }
        
        let html = `<div style="font-size:12px;font-weight:600;margin-bottom:10px;">${importQueue.length} dataset${importQueue.length > 1 ? 's' : ''} ready to import:</div>`;
        importQueue.forEach((f, fi) => {
          const statusColor = f.error ? 'var(--danger)' : f.monthKey ? 'var(--accent)' : 'var(--warning)';
          const statusText = f.error ? 'Error: ' + f.error : f.monthKey ? '→ ' + window.keyToLabel(f.monthKey) : 'Select month';
          
          html += `<div style="border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;margin-bottom:7px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span style="font-size:12px;font-weight:500;"><i class="ti ti-file-spreadsheet" style="color:var(--info);"></i> ${f.filename}</span>
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:10px;color:${statusColor};">${statusText}</span>
                <button onclick="window.removeQueuedFile(${fi})" style="width:20px;height:20px;border-radius:99px;border:1px solid var(--danger);background:var(--danger-light);color:var(--danger);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;line-height:1;padding:0;" title="Remove file">&times;</button>
              </div>
            </div>
            ${!f.monthKey && !f.error ? `<div style="margin-top:7px;display:flex;align-items:center;gap:7px;">
              <select class="form-select" style="width:auto;font-size:11px;" onchange="importQueue[${fi}].monthKey=this.value; window.renderImportPreview();">
                <option value="">— select month —</option>
                ${window.generateMonthOptions()}
              </select>
            </div>` : ''}
          </div>`;
        });
        el.innerHTML = html;
        document.getElementById('import-confirm-btn').style.display = '';
      };
    }
  }, 900);
});

// ══════════════════════════════════════════════════════════════
// 13. DASHBOARD MONTHLY HISTORY CARDS - RED 'X' DELETE
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  setTimeout(() => {
    if (typeof renderHistoryGrid === 'function') {
      window.renderHistoryGrid = function() {
        const months = Object.keys(monthHistory).sort().reverse();
        const countEl = document.getElementById('history-count');
        if (countEl) countEl.textContent = months.length + ' month' + (months.length !== 1 ? 's' : '');
        
        const grid = document.getElementById('history-grid');
        if (!grid) return;
        
        if (!months.length) {
          grid.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0;">No history yet. Save a month in the Tracker to begin.</div>';
          return;
        }
        
        grid.innerHTML = months.map(key => {
          const h = monthHistory[key];
          const bal = (h.totalIncome || 0) - (h.totalExpenses || 0);
          const [y, m] = key.split('-');
          
          return `<div class="history-card" style="position:relative;" onclick="loadHistoryDetail('${key}',this)">
            <!-- The Red 'X' Delete Button -->
            <button onclick="event.stopPropagation(); if(window.deleteHistoryEntry) window.deleteHistoryEntry('${key}')" 
                    style="position:absolute; top:2px; right:4px; width:16px; height:16px; border-radius:50%; border:none; background:transparent; color:var(--danger); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:bold; padding:0; transition:all 0.15s;"
                    onmouseover="this.style.background='var(--danger)'; this.style.color='#fff';"
                    onmouseout="this.style.background='transparent'; this.style.color='var(--danger)';">
              &times;
            </button>
            <div style="font-size:12px;font-weight:600;">${typeof MS !== 'undefined' ? MS[+m] : m}</div>
            <div style="font-size:10px;color:var(--text3);">${y}</div>
            <div style="font-size:11px;font-weight:600;margin-top:3px;color:${bal >= 0 ? 'var(--accent)' : 'var(--danger)'};">${bal >= 0 ? '+' : ''}${typeof fmt === 'function' ? fmt(bal) : bal}</div>
          </div>`;
        }).join('');
      };
      
      // If we are already on the insights tab, re-render it immediately
      if (document.getElementById('tab-insights')?.classList.contains('active')) {
        window.renderHistoryGrid();
      }
    }
  }, 600);
});

// --- Fix 4: Synchronize Tracker Tags with Dashboard ---
window.addEventListener('load', () => {
  if (typeof buildTrackerRow === 'function') {
    const _origBTR = window.buildTrackerRow;
    window.buildTrackerRow = function(item, prefix, b, a, v, month, year, tkey) {
      // 1. Get the original HTML string for the row
      const rowHtml = _origBTR(item, prefix, b, a, v, month, year, tkey);
      
      // 2. Parse it into a temporary DOM element
      const temp = document.createElement('table');
      temp.innerHTML = `<tbody>${rowHtml}</tbody>`;
      const tr = temp.querySelector('tr');
      
      if (tr) {
        const firstTd = tr.querySelector('td');
        if (firstTd) {
          // 3. Strip out the old, hardcoded tag
          const oldBadge = firstTd.querySelector('.purpose-badge');
          if (oldBadge) oldBadge.remove();
          
          // 4. Inject the new dynamic tag (if the item has a purpose)
          if (item.purpose && typeof window.purposeBadgeHtml === 'function') {
            const badgeContainer = document.createElement('span');
            badgeContainer.innerHTML = window.purposeBadgeHtml(item.purpose, item.id);
            const badge = badgeContainer.firstChild;
            if (badge) {
              badge.style.marginLeft = '5px'; // Add spacing so it matches the tracker UI
              firstTd.appendChild(badge);
            }
          }
        }
        return tr.outerHTML; // Return the newly patched row HTML
      }
      return rowHtml; // Fallback in case of parsing error
    };
  }
});

// ══════════════════════════════════════════════════════════════
// 16. GOOGLE DRIVE MASTER SYNC (Load/Save from Drive Folders)
// ══════════════════════════════════════════════════════════════

// Add the 'Load from Drive' button to your Master Modal
window.addEventListener('load', () => {
  setTimeout(() => {
    const modal = document.querySelector('#format-manager-overlay .modal');
    if (modal && !document.getElementById('btn-load-from-drive')) {
      const driveBtn = document.createElement('button');
      driveBtn.id = 'btn-load-from-drive';
      driveBtn.className = 'btn btn-sm';
      driveBtn.style.cssText = 'width:100%;margin-top:8px;background:var(--purple-light);color:var(--purple);border-color:var(--purple);';
      driveBtn.innerHTML = '<i class="ti ti-brand-google-drive"></i> Load Master from Drive';
      driveBtn.onclick = openDriveMasterPicker;
      modal.querySelector('.modal-head').parentElement.appendChild(driveBtn);
    }
  }, 1000);
});

// Drive File Picker Logic
window.openDriveMasterPicker = async function() {
  if (typeof accessToken === 'undefined' || !accessToken) { alert('Connect to Google first.'); return; }
  
  // Scrape your 'Root' folder for Master files
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q='1Db6ijJ1tahblilXh98r6XGvp4WCLuNSf'+in+parents+and+name+contains+'Master'`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const data = await res.json();
    if (!data.files || data.files.length === 0) { alert('No Master files found in the root folder.'); return; }
    
    // Simplest approach: Auto-pick the most recent or prompt if multiple
    const file = data.files[0];
    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const blob = await fileRes.arrayBuffer();
    
    // Feed the file content to your existing handleMasterUpload logic
    window.handleMasterUpload({ target: { files: [new File([blob], file.name)] } });
    alert('Loaded: ' + file.name);
  } catch(e) { alert('Failed to load from Drive: ' + e.message); }
};

// ══════════════════════════════════════════════════════════════
// 17. PERSISTENT BACKUP TO DRIVE (Monthly/Bulk Folder)
// ══════════════════════════════════════════════════════════════
window.saveIndefiniteSnapshot = async function(fileName) {
  if (typeof accessToken === 'undefined' || !accessToken) return;
  
  const FOLDER_ID = '1h1N9FxY0WZGcXWwUGjBGz5Jf1PPozIXk'; // Your "Months/Bulk" folder
  const stateData = localStorage.getItem('bp_state_v7');
  const blob = new Blob([stateData], { type: 'application/json' });
  
  const meta = { name: fileName, parents: [FOLDER_ID] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob);

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + accessToken },
    body: form
  });
  console.log('Snapshot saved to Drive indefinitely.');
};

// ══════════════════════════════════════════════════════════════
// 14. PERMANENT GOOGLE AUTH & MULTI-USER ACCESS
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  // Allow Dulini to sign in
  window.ALLOWED_USERS = ['deustueurtrevin@gmail.com', 'dulinimadushanki@gmail.com'];
  
  // Try to restore session
  const savedToken = localStorage.getItem('bp_google_token');
  if (savedToken) {
    accessToken = savedToken;
    console.log('Patch v7: Restored auth token from cache.');
    // Validate token by fetching user profile
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { 'Authorization': 'Bearer ' + accessToken } })
      .then(res => res.json())
      .then(user => {
        if (window.ALLOWED_USERS.includes(user.email)) {
          setSyncStatus('connected', 'Welcome back, ' + user.name);
          startPolling();
        } else {
          localStorage.removeItem('bp_google_token');
          accessToken = null;
        }
      });
  }
});

// Update your existing connectWith function to save the token
// Add this line inside your callback after accessToken = resp.access_token;
// localStorage.setItem('bp_google_token', accessToken);

window.addEventListener('load', () => {
  const saveBtn = document.querySelector('[onclick="saveFileAndSync()"]');
  if (saveBtn) {
    const _origSave = window.saveFileAndSync;
    window.saveFileAndSync = async function() {
      _origSave(); // Run your normal sync/save
      await window.saveIndefiniteSnapshot('Backup_' + new Date().toISOString() + '.json');
    };
  }
});

// ══════════════════════════════════════════════════════════════
// 19. BULLETPROOF AUTH RESTORE & AUTO-LOGIN
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  // 1. Override the Login function to GUARANTEE the token is cached
  if (typeof window.connectWith === 'function') {
    window.connectWith = function(connId) {
      const conn = connections.find(c => c.id === connId);
      if (!conn) return;
      activeConn = conn;
      if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Connecting to ' + conn.label + '...');
      
      if (typeof waitForGis === 'function') {
        waitForGis(() => {
          try {
            tokenClient = google.accounts.oauth2.initTokenClient({
              client_id: conn.clientId,
              scope: typeof SCOPES !== 'undefined' ? SCOPES : 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar',
              callback: (resp) => {
                if (resp.error) {
                  if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Auth failed: ' + resp.error);
                  return;
                }
                accessToken = resp.access_token;
                conn.active = true;
                
                // CRITICAL: Force the token into the browser cache
                localStorage.setItem('bp_google_token', accessToken);
                
                if (typeof closeConnModal === 'function') closeConnModal();
                if (typeof setSyncStatus === 'function') setSyncStatus('connected', 'Connected — ' + conn.sheetName);
                
                // Turn on the UI Sync Bar buttons
                ['btn-pull', 'btn-push', 'btn-overwrite', 'btn-cal'].forEach(id => {
                  const el = document.getElementById(id);
                  if (el) el.style.display = '';
                });
                const connBtn = document.getElementById('btn-connect');
                if (connBtn) connBtn.innerHTML = '<i class="ti ti-plug"></i> Connections';
                
                // Trigger background loops
                if (typeof startPolling === 'function') startPolling();
                if (typeof sheetsPull === 'function') sheetsPull();
                if (typeof checkAutoMonthSave === 'function') checkAutoMonthSave();
              }
            });
            tokenClient.requestAccessToken({ prompt: 'consent' });
          } catch (e) {
            if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Error: ' + e.message);
          }
        });
      }
    };
  }

  // 2. The Auto-Wake-Up Sequence (Fires on Page Refresh)
  window.ALLOWED_USERS = ['deustueurtrevin@gmail.com', 'dulinimadushanki@gmail.com'];
  const savedToken = localStorage.getItem('bp_google_token');
  
  if (savedToken) {
    accessToken = savedToken;
    console.log('Patch: Restored auth token from cache. Validating...');
    if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Restoring session...');
    
    // Ping Google to make sure the cached token hasn't expired (lasts ~1 hour)
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', { 
      headers: { 'Authorization': 'Bearer ' + accessToken } 
    })
    .then(res => {
      if (!res.ok) throw new Error('Token expired');
      return res.json();
    })
    .then(user => {
      // Check if user is Trevin or Dulini
      if (window.ALLOWED_USERS.includes(user.email)) {
        if (typeof setSyncStatus === 'function') setSyncStatus('connected', 'Welcome back, ' + user.name);
        
        // Unhide all the sync bar buttons
        ['btn-pull', 'btn-push', 'btn-overwrite', 'btn-cal'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = '';
        });
        const connBtn = document.getElementById('btn-connect');
        if (connBtn) connBtn.innerHTML = '<i class="ti ti-plug"></i> Connections';
        
        // Resume background syncing
        if (typeof startPolling === 'function') startPolling();
        
        // CRITICAL: Pull the latest data so the screen isn't blank!
        if (typeof sheetsPull === 'function') sheetsPull();
        
      } else {
        console.warn('User not authorized.');
        localStorage.removeItem('bp_google_token');
        accessToken = null;
        if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Unauthorized user');
      }
    })
    .catch(e => {
      console.warn('Session expired or invalid:', e);
      localStorage.removeItem('bp_google_token');
      accessToken = null;
      if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Session expired. Please click Connect.');
    });
  }
});

// ══════════════════════════════════════════════════════════════
// 20. GOOGLE DRIVE MASTER SYNC OVERRIDE (Target Folder & Most Recent)
// ══════════════════════════════════════════════════════════════
window.openDriveMasterPicker = async function() {
  if (typeof accessToken === 'undefined' || !accessToken) { alert('Connect to Google first.'); return; }
  
  // The specific folder ID you provided for the Master Site Database
  const TARGET_FOLDER_ID = '1nHM5aiylC0kE6Km7W_US9Z_TWlcWpxKh';
  
  try {
    if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Fetching Master file...');
    
    // Query targets the folder and explicitly sorts by modifiedTime descending, limiting to 1 result
    const url = `https://www.googleapis.com/drive/v3/files?q='${TARGET_FOLDER_ID}'+in+parents&orderBy=modifiedTime desc&pageSize=1`;
    
    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const data = await res.json();
    
    if (!data.files || data.files.length === 0) { 
      if (typeof setSyncStatus === 'function') setSyncStatus('error', 'No files found in folder');
      alert('No files found in the target folder.'); 
      return; 
    }
    
    // Auto-pick the first file (which is guaranteed to be the most recent)
    const file = data.files[0];
    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const blob = await fileRes.arrayBuffer();
    
    // Feed the file content to your existing handleMasterUpload logic
    if (typeof window.handleMasterUpload === 'function') {
      window.handleMasterUpload({ target: { files: [new File([blob], file.name)] } });
      if (typeof setSyncStatus === 'function') setSyncStatus('connected', 'Loaded: ' + file.name);
    } else {
      alert('Upload handler not found.');
    }
  } catch(e) { 
    if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Drive load failed');
    alert('Failed to load from Drive: ' + e.message); 
  }
};
