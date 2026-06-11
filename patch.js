// ==========================================
// patch.js — Dynamic Budget Planner (Final Clean Build)
// ==========================================

// ══════════════════════════════════════════════════════════════
// A. DATA PERSISTENCE — localStorage save/load
// ══════════════════════════════════════════════════════════════

window.lsSave = function() {
  try {
    localStorage.setItem('bp_state_v7', JSON.stringify({
      items,
      trackerData,
      savingsStreams,
      instruments,
      txEvents,
      monthHistory,
      monthNotes:        typeof monthNotes        !== 'undefined' ? monthNotes        : {},
      accountBalance:    typeof accountBalance    !== 'undefined' ? accountBalance    : 0,
      templates:         typeof templates         !== 'undefined' ? templates         : [],
      settlementHistory: typeof settlementHistory !== 'undefined' ? settlementHistory : [],
      currencySymbol:    typeof currencySymbol    !== 'undefined' ? currencySymbol    : 'LKR',
      currencyLocale:    typeof currencyLocale    !== 'undefined' ? currencyLocale    : 'en-LK',
      isDarkTheme:       typeof isDarkTheme       !== 'undefined' ? isDarkTheme       : false,
      activeProfile:     typeof activeProfile     !== 'undefined' ? activeProfile     : 'trevin',
      connections:       typeof connections       !== 'undefined' ? connections.map(c => ({ ...c, active: false })) : [],
      insightHistory:    window._insightHistory   || {},
      _v: 7,
      _ts: Date.now()
    }));
    try { localStorage.setItem('bp_history_bank', JSON.stringify(window._insightHistory || {})); } catch(e) {}
  } catch(e) { /* silent */ }
};

window.lsLoad = function() {
  try {
    const raw = localStorage.getItem('bp_state_v7');
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || s._v !== 7) return false;

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
    if (s.insightHistory) window._insightHistory = s.insightHistory;
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
    return true;
  } catch(e) { return false; }
};

window.addEventListener('load', () => {
  // Initialise history bank from storage if not already set
  if (!window._insightHistory) {
    try {
      const stored = localStorage.getItem('bp_history_bank');
      window._insightHistory = stored ? JSON.parse(stored) : {};
    } catch(e) { window._insightHistory = {}; }
  }

  // Restore state
  if (window.lsLoad()) {
    if (typeof applyTheme         === 'function') applyTheme();
    if (typeof recalc             === 'function') recalc();
    if (typeof updateEventsBadge  === 'function') updateEventsBadge();
    if (typeof buildNotifications === 'function') buildNotifications();
    if (typeof renderTemplates    === 'function') renderTemplates();
    if (typeof setProfile         === 'function') setProfile(activeProfile || 'trevin');
  }

  // Restore active profile
  const savedProfile = localStorage.getItem('bp_active_profile');
  if (savedProfile && typeof setProfile === 'function') setProfile(savedProfile);

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

  // Save on exit and tab hide
  window.addEventListener('beforeunload', window.lsSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') window.lsSave();
  });

  // Also save active profile on every lsSave
  const _origLsSave = window.lsSave;
  window.lsSave = function() {
    _origLsSave();
    try { localStorage.setItem('bp_active_profile', typeof activeProfile !== 'undefined' ? activeProfile : 'trevin'); } catch(e) {}
  };
});

// ══════════════════════════════════════════════════════════════
// B. MASTER DATABASE — button, modal, Excel download & upload
// ══════════════════════════════════════════════════════════════

window.addEventListener('load', () => {
  // Inject button into sync-bar
  const syncBar = document.querySelector('.sync-bar');
  if (syncBar && !document.getElementById('btn-master-format')) {
    const btn = document.createElement('button');
    btn.id = 'btn-master-format';
    btn.className = 'btn btn-sm';
    btn.innerHTML = '<i class="ti ti-database"></i> Master Site Database';
    btn.onclick = window.openFormatManager;
    syncBar.appendChild(btn);
  }

  // Inject modal
  if (!document.getElementById('format-manager-overlay')) {
    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="format-manager-overlay" onclick="if(event.target===this) this.classList.remove('open')">
      <div class="modal">
        <div class="modal-head">
          <span class="modal-title"><i class="ti ti-database" style="color:var(--danger);"></i> Master Database Control</span>
          <button class="modal-close" onclick="document.getElementById('format-manager-overlay').classList.remove('open')"><i class="ti ti-x"></i></button>
        </div>
        <div style="padding:16px;font-size:13px;color:var(--text2);line-height:1.6;">
          <p style="margin-bottom:14px;">Download your full site state as a multi-tab Excel file. Edit anything in Excel, then upload to completely overwrite the site.</p>
          <button class="btn btn-sm" style="margin-bottom:12px;width:100%;justify-content:center;background:var(--info-light);color:var(--info);border-color:var(--info);" onclick="window.downloadMasterTemplate()">
            <i class="ti ti-download"></i> Download Site Master (.xlsx)
          </button>
          <button class="btn btn-sm" style="margin-bottom:14px;width:100%;justify-content:center;background:var(--purple-light);color:var(--purple);border-color:var(--purple);" onclick="window.openDriveMasterPicker()">
            <i class="ti ti-brand-google-drive"></i> Load Master from Drive
          </button>
          <div style="border:2px dashed var(--danger);border-radius:var(--radius);padding:28px 20px;text-align:center;cursor:pointer;" onclick="document.getElementById('master-upload-file').click()">
            <i class="ti ti-upload" style="font-size:28px;margin-bottom:8px;display:block;color:var(--danger);"></i>
            Upload Master File to Overwrite Site<br>
            <span style="font-size:10px;opacity:0.7;">Must be the exported .xlsx format</span>
          </div>
          <input type="file" id="master-upload-file" accept=".xlsx" style="display:none;" onchange="window.handleMasterUpload(event)">
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

window.downloadMasterTemplate = function() {
  if (typeof XLSX === 'undefined') { alert('Excel library loading, try again in a second.'); return; }
  const wb = XLSX.utils.book_new();

  // Config
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { key: 'accountBalance', value: typeof accountBalance !== 'undefined' ? accountBalance : 0 },
    { key: 'activeProfile',  value: typeof activeProfile  !== 'undefined' ? activeProfile  : 'trevin' }
  ]), 'Config');

  // Items
  const itemsExp = items.map(i => ({
    ID: i.id, Type: i.type, Name: i.name, Amount: i.val || 0, Frequency: i.freq || 'monthly',
    Category: i.cat || '', BudgetTag: i.tag || '', Purpose: i.purpose || '',
    Owner: i.owner, Active: i.on ? 'TRUE' : 'FALSE',
    DueDay: i.dueDay || 0, BufferDays: i.bufferDays || 0,
    SplitTrevin: i.splitRatio?.trevin || 0, SplitDulini: i.splitRatio?.dulini || 0,
    LinkedInstrument: i.instrumentLink || ''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsExp.length ? itemsExp : [{}]), 'Items');

  // Savings
  const savExp = (savingsStreams || []).map(s => ({ ID: s.id, Name: s.name, Balance: s.balance || 0, Goal: s.goal || 0, Owner: s.owner || 'shared', Color: s.color || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(savExp.length ? savExp : [{}]), 'Savings');

  // Instruments
  const instExp = (instruments || []).map(i => ({ ID: i.id, Name: i.name, Type: i.type, Capital: i.capital || 0, Rate: i.rate || 0, Period: i.period || 0, Monthly: i.monthly || 0, Start: i.start || '', Units: i.units || 0, Price: i.price || 0, Owner: i.owner, Notes: i.notes || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(instExp.length ? instExp : [{}]), 'Instruments');

  // Tracker Actuals
  const trackerRows = [];
  Object.keys(trackerData || {}).forEach(my => {
    Object.keys(trackerData[my]).forEach(k => {
      if (k !== 'routes') trackerRows.push({ MonthYear: my, ItemKey: k, ActualValue: trackerData[my][k] });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trackerRows.length ? trackerRows : [{ MonthYear: '', ItemKey: '', ActualValue: '' }]), 'TrackerActuals');

  // Month History
  const histRows = [];
  Object.keys(monthHistory || {}).forEach(my => {
    const h = monthHistory[my];
    histRows.push({ MonthYear: my, TotalIncome: h.totalIncome || 0, TotalExpenses: h.totalExpenses || 0, TotalSaved: h.totalSaved || 0, TrevinExp: h.perPerson?.trevin?.expenses || 0, DuliniExp: h.perPerson?.dulini?.expenses || 0, TrevinInc: h.perPerson?.trevin?.income || 0, DuliniInc: h.perPerson?.dulini?.income || 0, Imported: h.imported ? 'TRUE' : 'FALSE' });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histRows.length ? histRows : [{}]), 'MonthHistory');

  // Events
  const evtExp = (txEvents || []).map(e => ({ ID: e.id, SourceKey: e.sourceKey || '', SourceItem: e.sourceItem || '', Amount: e.amount || 0, Month: e.month, Year: e.year, Status: e.status || '', RouteType: e.routeType || '', RouteTarget: e.routeTarget || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evtExp.length ? evtExp : [{}]), 'Events');

  XLSX.writeFile(wb, 'Budget_Site_Master_Full.xlsx');
};

window.handleMasterUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Executing Hard Overwrite...');

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      let newItems = [], newSavings = [], newInst = [];
      let newTracker = {}, newMonthHist = {}, newInsightHist = {};
      let newBalance = 0;

      if (wb.Sheets['Config']) {
        const conf = XLSX.utils.sheet_to_json(wb.Sheets['Config']);
        const balRow = conf.find(c => c.key === 'accountBalance');
        if (balRow) newBalance = parseFloat(balRow.value) || 0;
      }
      if (wb.Sheets['Items']) {
        newItems = XLSX.utils.sheet_to_json(wb.Sheets['Items']).filter(r => r.Name).map(r => ({
          id: r.ID || Math.random().toString(36).slice(2),
          type: (r.Type || '').toLowerCase(), name: r.Name, val: parseFloat(r.Amount) || 0,
          freq: (r.Frequency || 'monthly').toLowerCase(), cat: (r.Category || '').toLowerCase(),
          tag: (r.BudgetTag || 'variable').toLowerCase(), purpose: (r.Purpose || '').toLowerCase(),
          owner: (r.Owner || 'shared').toLowerCase(),
          on: String(r.Active).toUpperCase() === 'TRUE',
          dueDay: parseInt(r.DueDay) || 0, bufferDays: parseInt(r.BufferDays) || 0,
          splitRatio: { trevin: parseFloat(r.SplitTrevin) || 0, dulini: parseFloat(r.SplitDulini) || 0 },
          instrumentLink: r.LinkedInstrument || '', history: [], calEventId: null
        }));
      }
      if (wb.Sheets['Savings']) {
        newSavings = XLSX.utils.sheet_to_json(wb.Sheets['Savings']).filter(r => r.Name).map(r => ({
          id: r.ID || Math.random().toString(36).slice(2), name: r.Name,
          balance: parseFloat(r.Balance) || 0, goal: parseFloat(r.Goal) || 0,
          owner: (r.Owner || 'shared').toLowerCase(), color: r.Color || 'var(--accent)', history: []
        }));
      }
      if (wb.Sheets['Instruments']) {
        newInst = XLSX.utils.sheet_to_json(wb.Sheets['Instruments']).filter(r => r.Name).map(r => ({
          id: r.ID || Math.random().toString(36).slice(2), name: r.Name,
          type: (r.Type || 'loan').toLowerCase(), capital: parseFloat(r.Capital) || 0,
          rate: parseFloat(r.Rate) || 0, period: parseInt(r.Period) || 0,
          monthly: parseFloat(r.Monthly) || 0, start: r.Start || '',
          units: parseFloat(r.Units) || 0, price: parseFloat(r.Price) || 0,
          owner: (r.Owner || 'shared').toLowerCase(), notes: r.Notes || ''
        }));
      }
      if (wb.Sheets['TrackerActuals']) {
        XLSX.utils.sheet_to_json(wb.Sheets['TrackerActuals']).forEach(r => {
          if (r.MonthYear && r.ItemKey) {
            if (!newTracker[r.MonthYear]) newTracker[r.MonthYear] = {};
            newTracker[r.MonthYear][r.ItemKey] = parseFloat(r.ActualValue) || 0;
          }
        });
      }
      if (wb.Sheets['MonthHistory']) {
        XLSX.utils.sheet_to_json(wb.Sheets['MonthHistory']).forEach(r => {
          if (r.MonthYear) {
            newMonthHist[r.MonthYear] = {
              totalIncome: parseFloat(r.TotalIncome) || 0, totalExpenses: parseFloat(r.TotalExpenses) || 0,
              balance: (parseFloat(r.TotalIncome) || 0) - (parseFloat(r.TotalExpenses) || 0),
              totalSaved: parseFloat(r.TotalSaved) || 0,
              perPerson: {
                trevin: { expenses: parseFloat(r.TrevinExp) || 0, income: parseFloat(r.TrevinInc) || 0 },
                dulini: { expenses: parseFloat(r.DuliniExp) || 0, income: parseFloat(r.DuliniInc) || 0 }
              },
              imported: String(r.Imported).toUpperCase() === 'TRUE'
            };
            newInsightHist[r.MonthYear] = {
              fileName: 'Restored from Master Database', uploadedAt: Date.now(),
              snapshot: JSON.parse(JSON.stringify(newMonthHist[r.MonthYear])),
              trackerSnapshot: newTracker[r.MonthYear] ? JSON.parse(JSON.stringify(newTracker[r.MonthYear])) : {}
            };
          }
        });
      }

      // Write to localStorage directly
      const hardState = {
        items: newItems, trackerData: newTracker, savingsStreams: newSavings, instruments: newInst,
        txEvents: [], monthHistory: newMonthHist, monthNotes: {}, accountBalance: newBalance,
        templates: typeof templates !== 'undefined' ? templates : [],
        settlementHistory: typeof settlementHistory !== 'undefined' ? settlementHistory : [],
        currencySymbol: typeof currencySymbol !== 'undefined' ? currencySymbol : 'LKR',
        currencyLocale: typeof currencyLocale !== 'undefined' ? currencyLocale : 'en-LK',
        isDarkTheme: typeof isDarkTheme !== 'undefined' ? isDarkTheme : false,
        activeProfile: typeof activeProfile !== 'undefined' ? activeProfile : 'trevin',
        connections: typeof connections !== 'undefined' ? connections : [],
        insightHistory: newInsightHist, _v: 7, _ts: Date.now()
      };
      localStorage.setItem('bp_state_v7', JSON.stringify(hardState));

      // Push to Drive cache
      if (typeof window.saveIndefiniteSnapshot === 'function') {
        if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Updating cloud cache...');
        await window.saveIndefiniteSnapshot('HARD_OVERWRITE_' + new Date().toISOString() + '.json');
      }

      // Ask to rebuild sheet
      if (typeof accessToken !== 'undefined' && accessToken) {
        if (confirm('Site updated from master file.\n\nOverwrite the Google Sheet to match the site now?\n\nThis fully rebuilds the sheet with formulas.')) {
          await window.executeFullSheetRebuild();
        }
      }

      // Kill phantom saves then reload
      window.lsSave = function() {};
      window.saveFileAndSync = function() {};
      window.items = []; window.trackerData = {}; window.monthHistory = {};

      if (confirm('HARD OVERWRITE COMPLETE.\n\nThe site will now restart to load your new data.')) {
        location.reload();
      }

    } catch(err) {
      if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Hard Overwrite Failed');
      alert('Error: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
};

// ══════════════════════════════════════════════════════════════
// C. PURPOSE TAGS — open free-text
// ══════════════════════════════════════════════════════════════

const PURPOSE_COLOR_MAP = {
  saving:        { bg: 'var(--accent-light)',   color: 'var(--accent-dark)',  border: 'var(--accent)'   },
  investment:    { bg: 'var(--gold-light)',      color: 'var(--gold)',         border: 'var(--gold)'     },
  loan:          { bg: 'var(--danger-light)',    color: 'var(--danger)',       border: 'var(--danger)'   },
  fd:            { bg: 'var(--info-light)',      color: 'var(--info)',         border: 'var(--info)'     },
  fund:          { bg: 'var(--gold-light)',      color: 'var(--gold)',         border: 'var(--gold)'     },
  earning:       { bg: 'var(--info-light)',      color: 'var(--info)',         border: 'var(--info)'     },
  living:        { bg: 'var(--purple-light)',    color: 'var(--purple)',       border: 'var(--purple)'   },
  vehicle:       { bg: 'var(--warning-light)',   color: 'var(--warning)',      border: 'var(--warning)'  },
  entertainment: { bg: 'var(--pink-light)',      color: 'var(--pink)',         border: 'var(--pink)'     },
};

window.purposeBadgeHtml = function(purposeVal, itemId) {
  if (!purposeVal || !purposeVal.trim()) {
    return `<span class="purpose-badge add" onclick="window.promptSetPurpose('${itemId}')" title="Add a purpose tag">+ tag</span>`;
  }
  const key = purposeVal.trim().toLowerCase();
  const s = PURPOSE_COLOR_MAP[key] || { bg: 'var(--surface3)', color: 'var(--text2)', border: 'var(--border)' };
  return `<span style="font-size:9px;padding:1px 6px;border-radius:99px;cursor:pointer;flex-shrink:0;border:1px solid ${s.border};background:${s.bg};color:${s.color};" onclick="window.promptSetPurpose('${itemId}')" title="Click to change">${purposeVal.trim()}</span>`;
};

window.promptSetPurpose = function(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  const v = prompt('Purpose tag — any word (saving, earning, vehicle, entertainment...).\nLeave blank to remove.', item.purpose || '');
  if (v === null) return;
  item.purpose = v.trim().toLowerCase();
  if (typeof markDirty === 'function') markDirty();
  if (typeof recalc === 'function') recalc();
};

window.addEventListener('load', () => {
  // Patch buildItemRow
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
  }

  // Patch renderGlobalTable — purpose becomes free-text input
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
  }

  // Patch buildTrackerRow — sync purpose tag display
  if (typeof buildTrackerRow === 'function') {
    const _origBTR = window.buildTrackerRow;
    window.buildTrackerRow = function(item, prefix, b, a, v, month, year, tkey) {
      const rowHtml = _origBTR(item, prefix, b, a, v, month, year, tkey);
      const temp = document.createElement('table');
      temp.innerHTML = `<tbody>${rowHtml}</tbody>`;
      const tr = temp.querySelector('tr');
      if (tr) {
        const firstTd = tr.querySelector('td');
        if (firstTd) {
          const oldBadge = firstTd.querySelector('.purpose-badge');
          if (oldBadge) oldBadge.remove();
          if (item.purpose && typeof window.purposeBadgeHtml === 'function') {
            const bc = document.createElement('span');
            bc.innerHTML = window.purposeBadgeHtml(item.purpose, item.id);
            const badge = bc.firstChild;
            if (badge) { badge.style.marginLeft = '5px'; firstTd.appendChild(badge); }
          }
        }
        return tr.outerHTML;
      }
      return rowHtml;
    };
  }

  // Open category colours
  window.getCatColor = function(cat) {
    const map = typeof CAT_COLORS !== 'undefined' ? CAT_COLORS : {};
    return map[cat] || '#888780';
  };
});

// ══════════════════════════════════════════════════════════════
// D. GOOGLE SHEET FULL REBUILD
// ══════════════════════════════════════════════════════════════

window.executeOverwrite = async function() {
  if (typeof accessToken === 'undefined' || !accessToken) { alert('Connect to Google first.'); return; }
  const sheetIdEl   = document.getElementById('ow-sheet-id');
  const sheetNameEl = document.getElementById('ow-sheet-name');
  if (sheetIdEl?.value   && typeof activeConn !== 'undefined') activeConn.sheetId   = sheetIdEl.value.trim();
  if (sheetNameEl?.value && typeof activeConn !== 'undefined') activeConn.sheetName = sheetNameEl.value.trim();
  const overlay = document.getElementById('overwrite-overlay');
  if (overlay) overlay.classList.remove('open');
  window.executeFullSheetRebuild();
};

window.executeFullSheetRebuild = async function() {
  if (typeof accessToken === 'undefined' || !accessToken) { alert('Connect to Google first.'); return; }
  const sheetId   = (typeof activeConn !== 'undefined') ? activeConn.sheetId   : (typeof SPREADSHEET_ID      !== 'undefined' ? SPREADSHEET_ID      : null);
  const sheetName = (typeof activeConn !== 'undefined') ? activeConn.sheetName : (typeof DEFAULT_SHEET_NAME  !== 'undefined' ? DEFAULT_SHEET_NAME  : 'Dynamic Budget Planner');
  if (!sheetId) { alert('No sheet ID found.'); return; }

  if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Full sheet rebuild...');

  try {
    const _api = window.apiCall || async function(method, url, body) {
      const opts = { method, headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' } };
      if (body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    };

    const meta = await _api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`);
    const existingSheets = meta.sheets.map(s => ({ title: s.properties.title, id: s.properties.sheetId }));
    const needed = [sheetName, 'Tracker', 'Savings', 'Instruments', 'Events', 'Data'];
    const batchReqs = [];

    batchReqs.push({ updateSheetProperties: { properties: { sheetId: existingSheets[0].id, title: '__temp__' }, fields: 'title' } });
    existingSheets.slice(1).forEach(s => batchReqs.push({ deleteSheet: { sheetId: s.id } }));
    needed.forEach(title => batchReqs.push({ addSheet: { properties: { title } } }));
    await _api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, { requests: batchReqs });

    const meta2 = await _api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`);
    const tempSheet = meta2.sheets.find(s => s.properties.title === '__temp__');
    if (tempSheet) await _api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, { requests: [{ deleteSheet: { sheetId: tempSheet.properties.sheetId } }] });

    const inc   = items.filter(i => i.type === 'income');
    const exp   = items.filter(i => i.type === 'expense');
    const cur   = (typeof currencySymbol !== 'undefined') ? currencySymbol : 'LKR';
    const toMo  = (typeof toMonthly === 'function') ? toMonthly : (v) => v;

    // Dashboard tab
    const dashRows = [];
    dashRows.push(['TREVIN & DULINI — BUDGET PLANNER', '', '', '', new Date().toLocaleDateString()]);
    dashRows.push(['', '', '', '', '']);
    const incStart = dashRows.length + 1;
    dashRows.push(['INCOME', 'Budget (' + cur + ')', 'Owner', 'Purpose', '']);
    inc.forEach(i => dashRows.push([i.name, i.on ? Math.round(toMo(i.val, i.freq)) : 0, i.owner, i.purpose || '', '']));
    const incEnd = dashRows.length;
    dashRows.push(['Total Income', `=SUM(B${incStart + 1}:B${incEnd})`, '', '', '']);
    const totalIncRow = dashRows.length;
    dashRows.push(['', '', '', '', '']);
    const expStart = dashRows.length + 1;
    dashRows.push(['EXPENSES', 'Budget (' + cur + ')', 'Category', 'Purpose', '']);
    exp.forEach(i => dashRows.push([i.name, i.on ? Math.round(toMo(i.val, i.freq)) : 0, i.cat || '', i.purpose || '', '']));
    const expEnd = dashRows.length;
    dashRows.push(['Total Expenses', `=SUM(B${expStart + 1}:B${expEnd})`, '', '', '']);
    const totalExpRow = dashRows.length;
    dashRows.push(['', '', '', '', '']);
    dashRows.push(['Monthly Balance', `=B${totalIncRow}-B${totalExpRow}`, '', '', `=IF(B${dashRows.length}>0,"✅ SURPLUS","⚠️ DEFICIT")`]);
    const balRow = dashRows.length;
    dashRows.push(['Savings Rate',  `=IFERROR(SUMIF(D${incStart+1}:D${expEnd},"saving",B${incStart+1}:B${expEnd})/B${totalIncRow}*100,0)&"%"`, '', '', '']);
    dashRows.push(['Daily Budget',  `=IFERROR(B${balRow}/30,0)`, '', '', '']);
    await _api('PUT', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'"+sheetName+"'!A1")}?valueInputOption=USER_ENTERED`, { values: dashRows });

    // Tracker tab
    const now  = new Date();
    const tkey = now.getFullYear() + '-' + now.getMonth();
    const td   = (typeof trackerData !== 'undefined' && trackerData[tkey]) ? trackerData[tkey] : {};
    const tRows = [];
    tRows.push([`TRACKER — ${typeof MS !== 'undefined' ? MS[now.getMonth()] : ''} ${now.getFullYear()}`, '', '', '', '', '']);
    tRows.push(['Item', 'Budget', 'Actual', 'Variance', 'Owner', 'Purpose']);
    tRows.push(['INCOME', '', '', '', '', '']);
    const tIncStart = tRows.length;
    inc.forEach(i => {
      const b = i.on ? Math.round(toMo(i.val, i.freq)) : 0;
      const a = td['inc_' + i.id] !== undefined && td['inc_' + i.id] !== '' ? td['inc_' + i.id] : '';
      const r = tRows.length + 1;
      tRows.push([i.name, b, a !== '' ? a : '', a !== '' ? `=C${r}-B${r}` : '', i.owner, i.purpose || '']);
    });
    const tIncEnd = tRows.length;
    tRows.push(['Total Income', `=SUM(B${tIncStart+1}:B${tIncEnd})`, `=SUM(C${tIncStart+1}:C${tIncEnd})`, `=C${tRows.length+1}-B${tRows.length+1}`, '', '']);
    const tTotalInc = tRows.length;
    tRows.push(['', '', '', '', '', '']);
    tRows.push(['EXPENSES', '', '', '', '', '']);
    const tExpStart = tRows.length;
    exp.forEach(i => {
      const b = i.on ? Math.round(toMo(i.val, i.freq)) : 0;
      const a = td['exp_' + i.id] !== undefined && td['exp_' + i.id] !== '' ? td['exp_' + i.id] : '';
      const r = tRows.length + 1;
      tRows.push([i.name, b, a !== '' ? a : '', a !== '' ? `=B${r}-C${r}` : '', i.owner, i.purpose || '']);
    });
    const tExpEnd = tRows.length;
    tRows.push(['Total Expenses', `=SUM(B${tExpStart+1}:B${tExpEnd})`, `=SUM(C${tExpStart+1}:C${tExpEnd})`, `=B${tRows.length+1}-C${tRows.length+1}`, '', '']);
    const tTotalExp = tRows.length;
    tRows.push(['', '', '', '', '', '']);
    tRows.push(['Net Balance', `=B${tTotalInc}-B${tTotalExp}`, `=C${tTotalInc}-C${tTotalExp}`, `=C${tRows.length+1}-B${tRows.length+1}`, '', '']);
    await _api('PUT', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Tracker'!A1")}?valueInputOption=USER_ENTERED`, { values: tRows });

    // Savings tab
    const savRows = [['SAVINGS STREAMS', '', '', '', ''], ['Name', 'Balance (' + cur + ')', 'Goal (' + cur + ')', 'Progress', 'Owner']];
    (savingsStreams || []).forEach(s => {
      const r = savRows.length + 1;
      savRows.push([s.name, s.balance, s.goal || 0, s.goal > 0 ? `=IFERROR(B${r}/C${r}*100,0)&"%"` : '—', s.owner]);
    });
    savRows.push(['', '', '', '', '']);
    savRows.push(['Total Saved', `=SUM(B3:B${savRows.length - 1})`, '', '', '']);
    await _api('PUT', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Savings'!A1")}?valueInputOption=USER_ENTERED`, { values: savRows });

    // Instruments tab
    const instrRows = [['FINANCIAL INSTRUMENTS', '', '', '', '', '', '', '', '', ''], ['Name', 'Type', 'Capital', 'Rate (%)', 'Period (mo)', 'Monthly', 'Owner', 'Start', 'Total Cost', 'Total Interest']];
    (instruments || []).forEach(i => {
      const r = instrRows.length + 1;
      instrRows.push([i.name, i.type, i.capital || 0, i.rate || 0, i.period || 0, i.monthly || 0, i.owner, i.start || '', i.type === 'loan' ? `=F${r}*E${r}` : '', i.type === 'loan' ? `=I${r}-C${r}` : '']);
    });
    await _api('PUT', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Instruments'!A1")}?valueInputOption=USER_ENTERED`, { values: instrRows });

    // Events tab
    const evtRows = [['TRANSACTION EVENTS', '', '', '', '', '', ''], ['Source Item', 'Amount', 'Month', 'Year', 'Status', 'Routed To', 'Date']];
    (txEvents || []).forEach(e => evtRows.push([e.sourceItem || '', e.amount || 0, e.month, e.year, e.status || '', e.routeTargetName || '', e.dateLabel || '']));
    evtRows.push(['', '', '', '', '', '', '']);
    evtRows.push(['Total surplus routed', `=SUMIF(E3:E${evtRows.length - 1},"tagged",B3:B${evtRows.length - 1})`, '', '', '', '', '']);
    await _api('PUT', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Events'!A1")}?valueInputOption=USER_ENTERED`, { values: evtRows });

    // Data tab (clean pull source)
    const dataRows = [
      ['##META', 'version=3', 'Full rebuild', new Date().toISOString()],
      ['##INCOME', ''],
      ...inc.map(i => [i.name, i.on ? Math.round(toMo(i.val, i.freq)) : 0, i.owner, i.purpose || '', i.dueDay || '']),
      ['##EXPENSE', ''],
      ...exp.map(i => [i.name, i.on ? Math.round(toMo(i.val, i.freq)) : 0, i.owner, i.purpose || '', i.dueDay || ''])
    ];
    await _api('PUT', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Data'!A1")}?valueInputOption=USER_ENTERED`, { values: dataRows });

    // Conditional formatting + freeze headers
    const meta3 = await _api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`);
    const sheetMap = {};
    meta3.sheets.forEach(s => { sheetMap[s.properties.title] = s.properties.sheetId; });
    const fmtReqs = [];
    [sheetName, 'Tracker'].forEach(tab => {
      if (sheetMap[tab] !== undefined) fmtReqs.push({ updateSheetProperties: { properties: { sheetId: sheetMap[tab], gridProperties: { frozenRowCount: 2 } }, fields: 'gridProperties.frozenRowCount' } });
    });
    if (sheetMap[sheetName] !== undefined) {
      const bri = balRow - 1;
      fmtReqs.push({ addConditionalFormatRule: { rule: { ranges: [{ sheetId: sheetMap[sheetName], startRowIndex: bri, endRowIndex: bri + 1, startColumnIndex: 1, endColumnIndex: 2 }], booleanRule: { condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '0' }] }, format: { backgroundColor: { red: 0.85, green: 0.96, blue: 0.88 }, textFormat: { foregroundColor: { red: 0.05, green: 0.49, blue: 0.27 }, bold: true } } } }, index: 0 } });
      fmtReqs.push({ addConditionalFormatRule: { rule: { ranges: [{ sheetId: sheetMap[sheetName], startRowIndex: bri, endRowIndex: bri + 1, startColumnIndex: 1, endColumnIndex: 2 }], booleanRule: { condition: { type: 'NUMBER_LESS', values: [{ userEnteredValue: '0' }] }, format: { backgroundColor: { red: 0.99, green: 0.91, blue: 0.91 }, textFormat: { foregroundColor: { red: 0.89, green: 0.18, blue: 0.18 }, bold: true } } } }, index: 1 } });
    }
    if (sheetMap['Tracker'] !== undefined) {
      fmtReqs.push({ addConditionalFormatRule: { rule: { ranges: [{ sheetId: sheetMap['Tracker'], startRowIndex: 2, endRowIndex: 200, startColumnIndex: 3, endColumnIndex: 4 }], booleanRule: { condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '0' }] }, format: { textFormat: { foregroundColor: { red: 0.05, green: 0.49, blue: 0.27 }, bold: true } } } }, index: 0 } });
      fmtReqs.push({ addConditionalFormatRule: { rule: { ranges: [{ sheetId: sheetMap['Tracker'], startRowIndex: 2, endRowIndex: 200, startColumnIndex: 3, endColumnIndex: 4 }], booleanRule: { condition: { type: 'NUMBER_LESS', values: [{ userEnteredValue: '0' }] }, format: { textFormat: { foregroundColor: { red: 0.89, green: 0.18, blue: 0.18 }, bold: true } } } }, index: 1 } });
    }
    if (fmtReqs.length) await _api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, { requests: fmtReqs });

    if (typeof setSyncStatus === 'function') setSyncStatus('connected', 'Sheet fully rebuilt');
    if (typeof setLastSync   === 'function') setLastSync();
    alert('✅ Google Sheet fully rebuilt!\n\nTabs: Dashboard, Tracker, Savings, Instruments, Events, Data\nLive formulas and conditional formatting applied.');

  } catch(err) {
    if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Rebuild failed');
    alert('Sheet rebuild failed: ' + err.message);
  }
};

// ══════════════════════════════════════════════════════════════
// E. HISTORY BANK — compounding import store
// ══════════════════════════════════════════════════════════════

if (!window._insightHistory) {
  try {
    const stored = localStorage.getItem('bp_history_bank');
    window._insightHistory = stored ? JSON.parse(stored) : {};
  } catch(e) { window._insightHistory = {}; }
}

window.addEventListener('load', () => {
  setTimeout(() => {
    // Inject Download History Bank button into Import modal header
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
    }

    // Intercept confirmImport to save files to the bank
    if (typeof confirmImport === 'function' && !window._origConfirmImportPatched) {
      const _origCI = window.confirmImport;
      window._origConfirmImportPatched = true;
      window.confirmImport = async function() {
        await _origCI();
        if (typeof importQueue !== 'undefined') {
          importQueue.forEach(f => {
            if (!f.monthKey || f.error) return;
            window._insightHistory[f.monthKey] = {
              fileName: f.filename, uploadedAt: Date.now(), monthKey: f.monthKey,
              snapshot: monthHistory[f.monthKey] ? JSON.parse(JSON.stringify(monthHistory[f.monthKey])) : null,
              trackerSnapshot: trackerData[f.monthKey] ? JSON.parse(JSON.stringify(trackerData[f.monthKey])) : null
            };
          });
        }
        window.lsSave();
        window.renderHistoryBankList();
      };
    }
    window.renderHistoryBankList();
  }, 800);
});

window.renderHistoryBankList = function() {
  const el = document.getElementById('history-bank-list');
  if (!el) return;
  const keys = Object.keys(window._insightHistory).sort().reverse();
  if (!keys.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:8px 0;">No history files stored yet.</div>';
    return;
  }
  el.innerHTML = keys.map(key => {
    const entry = window._insightHistory[key];
    const [y, m] = key.split('-');
    const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    const uploadDate = entry.uploadedAt ? new Date(entry.uploadedAt).toLocaleDateString() : '—';
    return `<div style="display:flex;align-items:center;gap:9px;padding:7px 10px;background:var(--surface2);border-radius:var(--radius);margin-bottom:5px;font-size:12px;">
      <i class="ti ti-calendar-stats" style="color:var(--accent);flex-shrink:0;font-size:14px;"></i>
      <div style="flex:1;"><strong>${label}</strong><span style="font-size:10px;color:var(--text3);margin-left:6px;">uploaded ${uploadDate} · ${entry.fileName || 'file'}</span></div>
      <button onclick="window.deleteHistoryEntry('${key}')" style="width:22px;height:22px;border-radius:99px;border:1px solid var(--danger);background:var(--danger-light);color:var(--danger);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;line-height:1;flex-shrink:0;padding:0;">&times;</button>
    </div>`;
  }).join('');
};

window.deleteHistoryEntry = function(key) {
  if (!confirm(`Remove ${key} from history bank?`)) return;
  delete window._insightHistory[key];
  if (typeof monthHistory  !== 'undefined') delete monthHistory[key];
  if (typeof trackerData   !== 'undefined') delete trackerData[key];
  window.lsSave();
  window.renderHistoryBankList();
  if (typeof renderInsights === 'function') renderInsights();
};

window.downloadHistoryBank = function() {
  if (typeof XLSX === 'undefined') { alert('Excel library not ready.'); return; }
  const wb = XLSX.utils.book_new();

  const allKeys = new Set([
    ...Object.keys(window._insightHistory || {}),
    ...Object.keys(window.monthHistory    || {}),
    ...Object.keys(window.trackerData     || {})
  ]);

  const summaryRows = [['Month', 'Total Income', 'Total Expenses', 'Balance', 'Saved', 'Trevin Expenses', 'Dulini Expenses', 'Source File', 'Uploaded']];
  Array.from(allKeys).sort().forEach(key => {
    const e  = (window._insightHistory && window._insightHistory[key]) || {};
    const h  = e.snapshot || (window.monthHistory && window.monthHistory[key]) || {};
    const td = e.trackerSnapshot || (window.trackerData && window.trackerData[key]) || {};
    if (!h.totalIncome && !h.totalExpenses && Object.keys(td).length === 0) return;
    const [y, m] = key.split('-');
    const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    summaryRows.push([label, h.totalIncome || 0, h.totalExpenses || 0, (h.totalIncome || 0) - (h.totalExpenses || 0), h.totalSaved || 0, h.perPerson?.trevin?.expenses || 0, h.perPerson?.dulini?.expenses || 0, e.fileName || 'Site Memory', e.uploadedAt ? new Date(e.uploadedAt).toLocaleDateString() : '—']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

  // One tab per month — human-readable: Item, Type, Budget, Actual
  const exportMonths = allKeys.size > 0 ? Array.from(allKeys).sort() : ['template'];
  exportMonths.forEach(key => {
    let td = {};
    let label = 'Template ' + (typeof MS !== 'undefined' ? MS[new Date().getMonth()] : '') + ' ' + new Date().getFullYear();
    if (key !== 'template') {
      const e = (window._insightHistory && window._insightHistory[key]) || {};
      td = e.trackerSnapshot || (window.trackerData && window.trackerData[key]) || {};
      if (Object.keys(td).length === 0) return;
      const [y, m] = key.split('-');
      label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    }
    const rows = [['Item', 'Type', 'Budget', 'Actual']];
    items.filter(i => i.type === 'income').forEach(i  => rows.push([i.name, 'Income',  i.val, td['inc_' + i.id] !== undefined ? td['inc_' + i.id] : '']));
    items.filter(i => i.type === 'expense').forEach(i => rows.push([i.name, 'Expense', i.val, td['exp_' + i.id] !== undefined ? td['exp_' + i.id] : '']));
    const sheetName = label.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 31);
    try { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName); } catch(e2) {}
  });

  const itemsExp = items.map(i => ({ ID: i.id, Type: i.type, Name: i.name, Amount: i.val, Frequency: i.freq, Category: i.cat || '', BudgetTag: i.tag || '', Purpose: i.purpose || '', Owner: i.owner, Active: i.on, DueDay: i.dueDay || 0, BufferDays: i.bufferDays || 0, SplitTrevin: i.splitRatio?.trevin || 0, SplitDulini: i.splitRatio?.dulini || 0 }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsExp.length ? itemsExp : [{}]), 'Items');
  XLSX.writeFile(wb, 'Budget_History_Bank.xlsx');
};

// ══════════════════════════════════════════════════════════════
// F. IMPORT QUEUE — red × + multi-sheet parser + math fix
// ══════════════════════════════════════════════════════════════

window.removeQueuedFile = function(index) {
  if (typeof importQueue !== 'undefined') {
    importQueue.splice(index, 1);
    if (typeof window.renderImportPreview === 'function') window.renderImportPreview();
  }
};

window.processImportRows = function(rows, monthKey) {
  if (!trackerData[monthKey]) trackerData[monthKey] = {};
  const td = trackerData[monthKey];
  let actualIncome = 0, actualExpenses = 0, trevinExp = 0, duliniExp = 0;

  rows.forEach(row => {
    const name   = (row['item'] || row['name'] || row['description'] || '').trim().toLowerCase();
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

  monthHistory[monthKey] = {
    totalIncome: actualIncome, totalExpenses: actualExpenses,
    balance: actualIncome - actualExpenses, totalSaved: 0,
    perPerson: { trevin: { expenses: trevinExp, income: 0 }, dulini: { expenses: duliniExp, income: 0 } },
    imported: true
  };
};

window.addEventListener('load', () => {
  setTimeout(() => {
    // renderImportPreview — with red × per file
    if (typeof renderImportPreview === 'function' || typeof importQueue !== 'undefined') {
      window.renderImportPreview = function() {
        const el = document.getElementById('import-local-preview');
        if (!el) return;
        if (!importQueue || !importQueue.length) { el.innerHTML = ''; return; }
        let html = `<div style="font-size:12px;font-weight:600;margin-bottom:10px;">${importQueue.length} dataset${importQueue.length > 1 ? 's' : ''} ready to import:</div>`;
        importQueue.forEach((f, fi) => {
          const statusColor = f.error ? 'var(--danger)' : f.monthKey ? 'var(--accent)' : 'var(--warning)';
          const statusText  = f.error ? 'Error: ' + f.error : f.monthKey ? '→ ' + (window.keyToLabel ? window.keyToLabel(f.monthKey) : f.monthKey) : 'Select month';
          html += `<div style="border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;margin-bottom:7px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span style="font-size:12px;font-weight:500;"><i class="ti ti-file-spreadsheet" style="color:var(--info);"></i> ${f.filename}</span>
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:10px;color:${statusColor};">${statusText}</span>
                <button onclick="window.removeQueuedFile(${fi})" style="width:20px;height:20px;border-radius:99px;border:1px solid var(--danger);background:var(--danger-light);color:var(--danger);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;line-height:1;padding:0;" title="Remove">&times;</button>
              </div>
            </div>
            ${!f.monthKey && !f.error ? `<div style="margin-top:7px;display:flex;align-items:center;gap:7px;">
              <select class="form-select" style="width:auto;font-size:11px;" onchange="importQueue[${fi}].monthKey=this.value; window.renderImportPreview();">
                <option value="">— select month —</option>
                ${window.generateMonthOptions ? window.generateMonthOptions() : ''}
              </select>
            </div>` : ''}
          </div>`;
        });
        el.innerHTML = html;
        const confirmBtn = document.getElementById('import-confirm-btn');
        if (confirmBtn) confirmBtn.style.display = '';
      };
    }

    // handleImportFiles — multi-sheet Excel support
    if (typeof handleImportFiles === 'function') {
      window.handleImportFiles = function(files) {
        if (!files || !files.length) return;
        window.importQueue = [];
        const fileArr  = Array.from(files);
        let processed  = 0;
        const preview  = document.getElementById('import-local-preview');
        if (preview) preview.innerHTML = `<div style="font-size:12px;color:var(--text2);">Processing ${fileArr.length} file${fileArr.length > 1 ? 's' : ''}...</div>`;

        fileArr.forEach(file => {
          const reader = new FileReader();
          reader.onload = ev => {
            try {
              if (file.name.endsWith('.csv')) {
                const rows = typeof parseCSVtoRows === 'function' ? parseCSVtoRows(ev.target.result) : [];
                const monthKey = typeof detectMonthFromFilename === 'function' ? detectMonthFromFilename(file.name) : null;
                window.importQueue.push({ filename: file.name, monthKey, rows, source: 'local' });
              } else {
                const wb = XLSX.read(ev.target.result, { type: 'binary' });
                wb.SheetNames.forEach(sName => {
                  if (['Summary', 'Items', 'Config', 'Instruments', 'Savings', 'Events', 'Dashboard'].includes(sName)) return;
                  const rows = typeof parseCSVtoRows === 'function' ? parseCSVtoRows(XLSX.utils.sheet_to_csv(wb.Sheets[sName])) : [];
                  if (!rows || rows.length === 0) return;
                  const monthKey = (typeof detectMonthFromFilename === 'function' ? detectMonthFromFilename(sName) : null)
                                || (typeof detectMonthFromFilename === 'function' ? detectMonthFromFilename(file.name) : null);
                  window.importQueue.push({ filename: wb.SheetNames.length > 3 ? `${file.name} — [${sName}]` : file.name, monthKey, rows, source: 'local' });
                });
              }
            } catch(err) {
              window.importQueue.push({ filename: file.name, monthKey: null, rows: [], source: 'local', error: err.message });
            }
            processed++;
            if (processed === fileArr.length && typeof window.renderImportPreview === 'function') window.renderImportPreview();
          };
          if (file.name.endsWith('.csv')) reader.readAsText(file);
          else reader.readAsBinaryString(file);
        });
      };
    }
  }, 900);
});

// ══════════════════════════════════════════════════════════════
// G. DASHBOARD LAYOUT — chart under income + history red ×
// ══════════════════════════════════════════════════════════════

window.addEventListener('load', () => {
  // Move category chart under income column
  const twoCol    = document.querySelector('#tab-dashboard .two-col');
  const incomeCard = document.getElementById('income-card');
  const catCanvas  = document.getElementById('catChart');
  if (twoCol && incomeCard && catCanvas) {
    const chartCard = catCanvas.closest('.chart-card');
    if (chartCard) {
      const leftCol = document.createElement('div');
      leftCol.style.cssText = 'display:flex;flex-direction:column;gap:14px;';
      twoCol.insertBefore(leftCol, incomeCard);
      leftCol.appendChild(incomeCard);
      leftCol.appendChild(chartCard);
      catCanvas.style.width = '100%';
      setTimeout(() => { if (typeof catChart !== 'undefined' && catChart?.resize) catChart.resize(); }, 100);
    }
  }

  // History grid — red × delete on each card
  setTimeout(() => {
    if (typeof renderHistoryGrid === 'function') {
      window.renderHistoryGrid = function() {
        const months  = Object.keys(monthHistory).sort().reverse();
        const countEl = document.getElementById('history-count');
        if (countEl) countEl.textContent = months.length + ' month' + (months.length !== 1 ? 's' : '');
        const grid = document.getElementById('history-grid');
        if (!grid) return;
        if (!months.length) {
          grid.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0;">No history yet.</div>';
          return;
        }
        grid.innerHTML = months.map(key => {
          const h   = monthHistory[key];
          const bal = (h.totalIncome || 0) - (h.totalExpenses || 0);
          const [y, m] = key.split('-');
          return `<div class="history-card" style="position:relative;" onclick="loadHistoryDetail('${key}',this)">
            <button onclick="event.stopPropagation(); if(window.deleteHistoryEntry) window.deleteHistoryEntry('${key}')"
              style="position:absolute;top:2px;right:4px;width:16px;height:16px;border-radius:50%;border:none;background:transparent;color:var(--danger);cursor:pointer;font-size:14px;font-weight:bold;padding:0;line-height:1;"
              onmouseover="this.style.background='var(--danger)';this.style.color='#fff';"
              onmouseout="this.style.background='transparent';this.style.color='var(--danger)';">&times;</button>
            <div style="font-size:12px;font-weight:600;">${typeof MS !== 'undefined' ? MS[+m] : m}</div>
            <div style="font-size:10px;color:var(--text3);">${y}</div>
            <div style="font-size:11px;font-weight:600;margin-top:3px;color:${bal >= 0 ? 'var(--accent)' : 'var(--danger)'};">${bal >= 0 ? '+' : ''}${typeof fmt === 'function' ? fmt(bal) : bal}</div>
          </div>`;
        }).join('');
      };
    }
  }, 600);
});

// ══════════════════════════════════════════════════════════════
// H. GOOGLE DRIVE SYNC — auth cache, file picker, cloud save/restore
// ══════════════════════════════════════════════════════════════

window.saveIndefiniteSnapshot = async function(fileName) {
  if (typeof accessToken === 'undefined' || !accessToken) return;
  const CACHE_FOLDER_ID = '1bRgzrxmEcFQeKICx611sg4HY3XlzEDiE';
  const stateData = localStorage.getItem('bp_state_v7');
  if (!stateData) return;
  const blob = new Blob([stateData], { type: 'application/json' });
  const meta = { name: fileName, parents: [CACHE_FOLDER_ID] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob);
  try {
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + accessToken }, body: form
    });
  } catch(e) {}
};

window.addEventListener('load', () => {
  // Inject "Sync from Cloud" button into sync-bar
  setTimeout(() => {
    const syncBar = document.querySelector('.sync-bar');
    if (syncBar && !document.getElementById('btn-cloud-restore')) {
      const btn = document.createElement('button');
      btn.id = 'btn-cloud-restore';
      btn.className = 'btn btn-sm';
      btn.style.cssText = 'background:var(--warning-light);color:var(--warning);border-color:var(--warning);';
      btn.innerHTML = '<i class="ti ti-cloud-download"></i> Sync from Cloud';
      btn.onclick = window.restoreFromCloudSnapshot;
      syncBar.appendChild(btn);
    }
  }, 1500);

  // Override connectWith to cache auth token
  if (typeof window.connectWith === 'function') {
    const _origConnect = window.connectWith;
    window.connectWith = function(connId) {
      const conn = connections.find(c => c.id === connId);
      if (!conn) return;
      activeConn = conn;
      if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Connecting...');
      if (typeof waitForGis === 'function') {
        waitForGis(() => {
          try {
            tokenClient = google.accounts.oauth2.initTokenClient({
              client_id: conn.clientId,
              scope: typeof SCOPES !== 'undefined' ? SCOPES : 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar',
              callback: (resp) => {
                if (resp.error) { if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Auth failed: ' + resp.error); return; }
                accessToken = resp.access_token;
                conn.active = true;
                localStorage.setItem('bp_google_token', accessToken);
                if (typeof closeConnModal  === 'function') closeConnModal();
                if (typeof setSyncStatus   === 'function') setSyncStatus('connected', 'Connected — ' + conn.sheetName);
                ['btn-pull','btn-push','btn-overwrite','btn-cal'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
                const connBtn = document.getElementById('btn-connect');
                if (connBtn) connBtn.innerHTML = '<i class="ti ti-plug"></i> Connections';
                if (typeof startPolling      === 'function') startPolling();
                if (typeof loadStateFromDrive=== 'function') loadStateFromDrive();
              }
            });
            tokenClient.requestAccessToken({ prompt: 'consent' });
          } catch(e) { if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Error: ' + e.message); }
        });
      }
    };
  }

  // Auto-restore cached auth token on page load
  window.ALLOWED_USERS = ['deustueurtrevin@gmail.com', 'dulinimadushanki@gmail.com'];
  const savedToken = localStorage.getItem('bp_google_token');
  if (savedToken) {
    accessToken = savedToken;
    if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Restoring session...');
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { 'Authorization': 'Bearer ' + accessToken } })
      .then(res => { if (!res.ok) throw new Error('expired'); return res.json(); })
      .then(user => {
        if (window.ALLOWED_USERS.includes(user.email)) {
          if (typeof setSyncStatus === 'function') setSyncStatus('connected', 'Welcome back, ' + user.name);
          ['btn-pull','btn-push','btn-overwrite','btn-cal'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
          const connBtn = document.getElementById('btn-connect');
          if (connBtn) connBtn.innerHTML = '<i class="ti ti-plug"></i> Connections';
          if (typeof startPolling === 'function') startPolling();
        } else {
          localStorage.removeItem('bp_google_token');
          accessToken = null;
          if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Unauthorized user');
        }
      })
      .catch(() => {
        localStorage.removeItem('bp_google_token');
        accessToken = null;
        if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Session expired. Please reconnect.');
      });
  }

  // Hook auto-save into saveFileAndSync
  const saveBtn = document.querySelector('[onclick="saveFileAndSync()"]');
  if (saveBtn) {
    const _origSFS = window.saveFileAndSync;
    window.saveFileAndSync = async function() {
      if (typeof _origSFS === 'function') _origSFS();
      await window.saveIndefiniteSnapshot('Backup_' + new Date().toISOString() + '.json');
    };
  }
});

// Visual Drive file picker
window.showCustomDrivePicker = async function(folderId, mimeType, callback) {
  if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Loading Drive files...');
  try {
    let query = `'${folderId}' in parents and trashed = false`;
    if (mimeType) query += ` and mimeType='${mimeType}'`;
    const res  = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&pageSize=15`, { headers: { 'Authorization': 'Bearer ' + accessToken } });
    const data = await res.json();
    if (!data.files || data.files.length === 0) { alert('No files found in this folder.'); if (typeof setSyncStatus === 'function') setSyncStatus('connected', 'Ready'); return; }

    let picker = document.getElementById('custom-drive-picker');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'custom-drive-picker';
      picker.className = 'modal-overlay open';
      picker.innerHTML = `<div class="modal" style="max-width:400px;max-height:80vh;display:flex;flex-direction:column;">
        <div class="modal-head">
          <span class="modal-title"><i class="ti ti-brand-google-drive" style="color:var(--info);"></i> Select File from Drive</span>
          <button class="modal-close" onclick="document.getElementById('custom-drive-picker').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div id="drive-picker-list" style="padding:16px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;"></div>
      </div>`;
      document.body.appendChild(picker);
    } else { picker.classList.add('open'); }

    document.getElementById('drive-picker-list').innerHTML = data.files.map(f => {
      const date = new Date(f.modifiedTime).toLocaleString();
      return `<div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer;background:var(--surface2);"
        onclick="document.getElementById('custom-drive-picker').remove(); window._drivePickerCb('${f.id}','${f.name}','${f.modifiedTime}')"
        onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="font-weight:600;font-size:13px;">${f.name}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px;"><i class="ti ti-clock"></i> ${date}</div>
      </div>`;
    }).join('');

    window._drivePickerCb = callback;
    if (typeof setSyncStatus === 'function') setSyncStatus('connected', 'Select a file');
  } catch(e) { alert('Failed to load file list: ' + e.message); }
};

window.restoreFromCloudSnapshot = async function() {
  if (typeof accessToken === 'undefined' || !accessToken) { alert('Connect to Google first.'); return; }
  const CACHE_FOLDER_ID = '1bRgzrxmEcFQeKICx611sg4HY3XlzEDiE';
  window.showCustomDrivePicker(CACHE_FOLDER_ID, 'application/json', async (fileId, fileName, modifiedTime) => {
    if (!confirm(`Overwrite site memory with this Cloud Cache?\n\nFile: ${fileName}\nDate: ${new Date(modifiedTime).toLocaleString()}`)) return;
    try {
      if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Downloading cache...');
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { 'Authorization': 'Bearer ' + accessToken } });
      const jsonText = await fileRes.text();
      localStorage.setItem('bp_state_v7', jsonText);
      alert('Cache applied! Reloading...');
      location.reload();
    } catch(e) { alert('Failed: ' + e.message); if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Cloud sync failed'); }
  });
};

window.openDriveMasterPicker = async function() {
  if (typeof accessToken === 'undefined' || !accessToken) { alert('Connect to Google first.'); return; }
  const TARGET_FOLDER_ID = '1nHM5aiylC0kE6Km7W_US9Z_TWlcWpxKh';
  window.showCustomDrivePicker(TARGET_FOLDER_ID, '', async (fileId, fileName) => {
    try {
      if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Downloading Master...');
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { 'Authorization': 'Bearer ' + accessToken } });
      const blob = await fileRes.arrayBuffer();
      if (typeof window.handleMasterUpload === 'function') {
        window.handleMasterUpload({ target: { files: [new File([blob], fileName)] } });
        if (typeof setSyncStatus === 'function') setSyncStatus('connected', 'Loaded: ' + fileName);
      }
    } catch(e) { alert('Failed: ' + e.message); if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Drive load failed'); }
  });
};
