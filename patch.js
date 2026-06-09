// ==========================================
// patch.js — Dynamic Budget Planner (v7)
// Builds on v6. New: chart repositioned, compounding history,
// delete uploaded files, upload→sheet overwrite prompt,
// full sheet rebuild with formulas.
// ==========================================
console.log('Patch v7 loaded.');

// ══════════════════════════════════════════════════════════════
// CARRY FORWARD ALL V6 CODE
// ══════════════════════════════════════════════════════════════

// 1. PROFILE SAVE
const _origLsSave_v6 = window.lsSave;
window.lsSave = function() {
  if (typeof _origLsSave_v6 === 'function') _origLsSave_v6();
  try { localStorage.setItem('bp_active_profile', typeof activeProfile !== 'undefined' ? activeProfile : 'trevin'); } catch(e) {}
};

// 2. MASTER DATABASE BUTTON
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

// 3. MASTER EXCEL DOWNLOAD
window.downloadMasterTemplate = function() {
  if (typeof XLSX === 'undefined') { alert('Excel library loading, try again in a second.'); return; }
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

// 4. MASTER UPLOAD — with sheet overwrite prompt
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

      // Prompt to push to Google Sheet
      setTimeout(() => {
        document.getElementById('format-manager-overlay').classList.remove('open');
        event.target.value = '';
        if (typeof accessToken !== 'undefined' && accessToken) {
          if (confirm('Site updated from master file.\n\nOverwrite the Google Sheet to match the site now?\n\nThis will fully rebuild the sheet with formulas and correct structure.')) {
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

// 5. PURPOSE BADGE
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
  const v = prompt('Purpose tag (saving, earning, living, vehicle, entertainment, or any word).\nLeave blank to remove.', item.purpose || '');
  if (v === null) return;
  item.purpose = v.trim().toLowerCase();
  if (typeof recalc === 'function') recalc();
};

// 6. FULL LOCALSTORAGE PERSISTENCE
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
      _v: 7, _ts: Date.now()
    }));
  } catch(e) { console.warn('lsSave failed:', e); }
};

window.lsLoad = function() {
  try {
    // Try v7 first, fall back to v6
    const raw = localStorage.getItem('bp_state_v7') || localStorage.getItem('bp_state_v6');
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s) return false;
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
    if (s.insightHistory) window._insightHistory = s.insightHistory;
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
  console.log('patch v7: all base hooks installed');
});

// 7. CAT CHART — move under income card, compact
window.addEventListener('load', () => {
  // Wait for DOM to settle
  setTimeout(() => {
    const incomeCard = document.getElementById('income-card');
    const oldChartCard = document.querySelector('.chart-card');
    // Find the chart-card that contains catChart specifically
    let catChartCard = null;
    document.querySelectorAll('.chart-card').forEach(el => {
      if (el.querySelector('#catChart')) catChartCard = el;
    });
    if (!incomeCard || !catChartCard) return;

    // Restyle the chart card to be compact and borderless inside income column
    catChartCard.style.cssText = 'background:transparent;border:none;box-shadow:none;padding:10px 0 0 0;margin:0;';
    const canvas = catChartCard.querySelector('#catChart');
    if (canvas) {
      const wrapper = canvas.closest('[style*="height"]') || canvas.parentElement;
      if (wrapper) wrapper.style.height = '120px';
    }
    // hide the legend (too cramped) — keep title
    const legend = catChartCard.querySelector('#cat-legend');
    if (legend) legend.style.display = 'none';
    const title = catChartCard.querySelector('.chart-title');
    if (title) title.style.cssText = 'font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.09em;margin-bottom:4px;display:block;';

    // Move the chart card into the income card
    incomeCard.appendChild(catChartCard);

    // Also patch updateCatChart to use log scale so small values still show
    if (typeof updateCatChart === 'function') {
      const _origUCC = window.updateCatChart;
      window.updateCatChart = function() {
        _origUCC();
        // After update, ensure chart options use compact sizing and no x-axis labels
        if (typeof catChart !== 'undefined' && catChart) {
          catChart.options.scales.x.ticks = { display: false };
          catChart.options.scales.y.ticks = { font: { size: 9 } };
          // Normalise bars so smallest visible bar is at least 15% of max
          const data = catChart.data.datasets[0].data;
          if (data && data.length) {
            const maxVal = Math.max(...data);
            catChart.data.datasets[0].data = data.map(v => {
              if (v === 0) return 0;
              const norm = v / maxVal;
              // floor at 0.15 so small categories still show
              return maxVal * Math.max(0.15, norm);
            });
          }
          catChart.update('none');
        }
      };
    }
  }, 400);
});

// ══════════════════════════════════════════════════════════════
// 8. COMPOUNDING HISTORY UPLOAD WITH PERSISTENT STORAGE + DELETE
// ══════════════════════════════════════════════════════════════

// Internal registry: _insightHistory = { 'YYYY-M': { fileName, uploadedAt, monthHistory, trackerData } }
if (!window._insightHistory) window._insightHistory = {};

// Patch openImportModal to inject the persistent history panel
window.addEventListener('load', () => {
  setTimeout(() => {
    _patchImportModal();
  }, 600);
});

function _patchImportModal() {
  // Find the import modal and inject our history bank UI before the close button
  const importOverlay = document.getElementById('import-overlay');
  if (!importOverlay) return;

  // Add "Download History Bank" button to modal header area
  const modalHead = importOverlay.querySelector('.modal-head');
  if (modalHead && !document.getElementById('btn-dl-history-bank')) {
    const dlBtn = document.createElement('button');
    dlBtn.id = 'btn-dl-history-bank';
    dlBtn.className = 'btn btn-sm';
    dlBtn.style.cssText = 'background:var(--info-light);color:var(--info);border-color:var(--info);margin-right:8px;';
    dlBtn.innerHTML = '<i class="ti ti-download"></i> Download History Bank';
    dlBtn.onclick = downloadHistoryBank;
    modalHead.insertBefore(dlBtn, modalHead.lastElementChild);
  }

  // Inject uploaded files list panel
  if (!document.getElementById('history-bank-panel')) {
    const localPanel = document.getElementById('import-panel-local');
    if (localPanel) {
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
  el.innerHTML = keys.map(key => {
    const entry = window._insightHistory[key];
    const [y, m] = key.split('-');
    const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    const uploadDate = entry.uploadedAt ? new Date(entry.uploadedAt).toLocaleDateString() : '—';
    return `<div style="display:flex;align-items:center;gap:9px;padding:7px 10px;background:var(--surface2);border-radius:var(--radius);margin-bottom:5px;font-size:12px;">
      <i class="ti ti-calendar-stats" style="color:var(--accent);flex-shrink:0;"></i>
      <div style="flex:1;">
        <strong>${label}</strong>
        <span style="font-size:10px;color:var(--text3);margin-left:6px;">uploaded ${uploadDate} · ${entry.fileName || 'file'}</span>
      </div>
      <button onclick="deleteHistoryEntry('${key}')" style="width:22px;height:22px;border-radius:99px;border:none;background:var(--danger-light);color:var(--danger);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;" title="Remove from history bank">
        <i class="ti ti-x"></i>
      </button>
    </div>`;
  }).join('');
}

window.deleteHistoryEntry = function(key) {
  if (!confirm(`Remove ${key} from history bank?`)) return;
  delete window._insightHistory[key];
  // Also remove from monthHistory
  if (typeof monthHistory !== 'undefined') delete monthHistory[key];
  if (typeof trackerData !== 'undefined') delete trackerData[key];
  window.lsSave();
  renderHistoryBankList();
  if (typeof renderInsights === 'function') renderInsights();
};

// Intercept confirmImport to also store in history bank
window.addEventListener('load', () => {
  setTimeout(() => {
    if (typeof confirmImport === 'function') {
      const _origCI = window.confirmImport;
      window.confirmImport = async function() {
        // Run original import
        await _origCI();
        // Now store each imported file in _insightHistory
        if (typeof importQueue !== 'undefined') {
          importQueue.forEach(f => {
            if (!f.monthKey || f.error) return;
            const [y, m] = f.monthKey.split('-');
            window._insightHistory[f.monthKey] = {
              fileName: f.filename,
              uploadedAt: Date.now(),
              monthKey: f.monthKey,
              // snapshot the history entry that was just created
              snapshot: monthHistory[f.monthKey] ? JSON.parse(JSON.stringify(monthHistory[f.monthKey])) : null,
              trackerSnapshot: trackerData[f.monthKey] ? JSON.parse(JSON.stringify(trackerData[f.monthKey])) : null
            };
          });
        }
        window.lsSave();
        renderHistoryBankList();
      };
    }
  }, 800);
});

// Download History Bank as compounding xlsx
window.downloadHistoryBank = function() {
  if (typeof XLSX === 'undefined') { alert('Excel library not ready.'); return; }
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = [['Month', 'Total Income', 'Total Expenses', 'Balance', 'Saved', 'Trevin Expenses', 'Dulini Expenses', 'Source File', 'Uploaded']];
  Object.keys(window._insightHistory).sort().forEach(key => {
    const e = window._insightHistory[key];
    const h = e.snapshot || monthHistory[key] || {};
    const [y, m] = key.split('-');
    const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    summaryRows.push([
      label,
      h.totalIncome || 0, h.totalExpenses || 0,
      (h.totalIncome || 0) - (h.totalExpenses || 0),
      h.totalSaved || 0,
      h.perPerson?.trevin?.expenses || 0,
      h.perPerson?.dulini?.expenses || 0,
      e.fileName || '', e.uploadedAt ? new Date(e.uploadedAt).toLocaleDateString() : ''
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

  // Per-month tracker actuals sheets
  Object.keys(window._insightHistory).sort().forEach(key => {
    const e = window._insightHistory[key];
    const td = e.trackerSnapshot || trackerData[key] || {};
    const [y, m] = key.split('-');
    const label = (typeof MS !== 'undefined' ? MS[+m] : m) + ' ' + y;
    const rows = [['ItemKey', 'ActualValue', 'MonthYear']];
    Object.entries(td).forEach(([k, v]) => {
      if (k !== 'routes') rows.push([k, v, key]);
    });
    const sheetName = label.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 31);
    try { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName); } catch(e2) {}
  });

  // Current items sheet so re-upload restores full context
  const itemsExp = items.map(i => ({
    ID: i.id, Type: i.type, Name: i.name, Amount: i.val, Frequency: i.freq,
    Category: i.cat || '', BudgetTag: i.tag || '', Purpose: i.purpose || '',
    Owner: i.owner, Active: i.on, DueDay: i.dueDay || 0, BufferDays: i.bufferDays || 0,
    SplitTrevin: i.splitRatio?.trevin || 0, SplitDulini: i.splitRatio?.dulini || 0
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsExp.length ? itemsExp : [{}]), 'Items');

  XLSX.writeFile(wb, 'Budget_History_Bank.xlsx');
};

// ══════════════════════════════════════════════════════════════
// 9. FULL SHEET REBUILD WITH FORMULAS (Level 3)
// ══════════════════════════════════════════════════════════════

window.executeFullSheetRebuild = async function() {
  if (typeof accessToken === 'undefined' || !accessToken) {
    alert('Connect to Google first.'); return;
  }
  const sheetId = (typeof activeConn !== 'undefined') ? activeConn.sheetId : (typeof SPREADSHEET_ID !== 'undefined' ? SPREADSHEET_ID : null);
  if (!sheetId) { alert('No sheet ID found.'); return; }
  const sheetName = (typeof activeConn !== 'undefined') ? activeConn.sheetName : (typeof DEFAULT_SHEET_NAME !== 'undefined' ? DEFAULT_SHEET_NAME : 'Dynamic Budget Planner');

  if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Full sheet rebuild...');

  try {
    const apiCall = window.apiCall || async function(method, url, body) {
      const opts = { method, headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' } };
      if (body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    };

    // Get existing sheets
    const meta = await apiCall('GET', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`);
    const existingSheets = meta.sheets.map(s => ({ title: s.properties.title, id: s.properties.sheetId }));

    const needed = [sheetName, 'Tracker', 'Savings', 'Instruments', 'Events', 'Data'];
    const batchRequests = [];

    // Delete all existing sheets except the first one (can't delete all)
    existingSheets.forEach((s, idx) => {
      if (idx > 0) batchRequests.push({ deleteSheet: { sheetId: s.id } });
    });
    // Rename first sheet to dashboard name
    batchRequests.push({ updateSheetProperties: { properties: { sheetId: existingSheets[0].id, title: sheetName }, fields: 'title' } });
    // Add the rest
    needed.slice(1).forEach(title => batchRequests.push({ addSheet: { properties: { title } } }));

    await apiCall('POST', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, { requests: batchRequests });

    const inc = items.filter(i => i.type === 'income');
    const exp = items.filter(i => i.type === 'expense');
    const cur = (typeof currencySymbol !== 'undefined') ? currencySymbol : 'LKR';
    const toMo = (typeof toMonthly === 'function') ? toMonthly : (v, f) => v;

    // ── DASHBOARD TAB ─────────────────────────────────────────
    // Layout: A=Label, B=Amount, C=Owner, D=Purpose, E=Formula results
    const dashRows = [];
    dashRows.push(['TREVIN & DULINI — BUDGET PLANNER', '', '', '', new Date().toLocaleDateString()]);
    dashRows.push(['', '', '', '', '']);

    // Income section — starts at row 3 (1-indexed)
    const incStartRow = dashRows.length + 1;
    dashRows.push(['INCOME', 'Budget (' + cur + ')', 'Owner', 'Purpose', '']);
    inc.forEach(i => dashRows.push([i.name, i.on ? Math.round(toMo(i.val, i.freq)) : 0, i.owner, i.purpose || '', '']));
    const incEndRow = dashRows.length;
    dashRows.push(['Total Income', `=SUM(B${incStartRow + 1}:B${incEndRow})`, '', '', '']);
    const totalIncRow = dashRows.length;
    dashRows.push(['', '', '', '', '']);

    // Expense section
    const expStartRow = dashRows.length + 1;
    dashRows.push(['EXPENSES', 'Budget (' + cur + ')', 'Category', 'Purpose', '']);
    exp.forEach(i => dashRows.push([i.name, i.on ? Math.round(toMo(i.val, i.freq)) : 0, i.cat || '', i.purpose || '', '']));
    const expEndRow = dashRows.length;
    dashRows.push(['Total Expenses', `=SUM(B${expStartRow + 1}:B${expEndRow})`, '', '', '']);
    const totalExpRow = dashRows.length;
    dashRows.push(['', '', '', '', '']);

    // Summary with formulas
    dashRows.push(['Monthly Balance', `=B${totalIncRow}-B${totalExpRow}`, '', '', `=IF(B${dashRows.length}>0,"✅ SURPLUS","⚠️ DEFICIT")`]);
    const balanceRow = dashRows.length;
    dashRows.push(['Savings Rate', `=IFERROR(SUMIF(D${incStartRow + 1}:D${expEndRow},"saving",B${incStartRow + 1}:B${expEndRow})/B${totalIncRow}*100,0)&"%"`, '', '', '']);
    dashRows.push(['Daily Budget', `=IFERROR(B${balanceRow}/30,0)`, '', '', '']);

    await apiCall('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'" + sheetName + "'!A1")}?valueInputOption=USER_ENTERED`,
      { values: dashRows, majorDimension: 'ROWS' }
    );

    // ── TRACKER TAB ───────────────────────────────────────────
    const now = new Date();
    const tkey = now.getFullYear() + '-' + now.getMonth();
    const td = (typeof trackerData !== 'undefined' && trackerData[tkey]) ? trackerData[tkey] : {};
    const trackerRows = [];
    trackerRows.push([`TRACKER — ${(typeof MS !== 'undefined' ? MS[now.getMonth()] : now.getMonth())} ${now.getFullYear()}`, '', '', '', '', '']);
    trackerRows.push(['Item', 'Budget', 'Actual', 'Variance', 'Owner', 'Purpose']);

    const tIncStart = trackerRows.length + 1;
    trackerRows.push(['INCOME', '', '', '', '', '']);
    inc.forEach(i => {
      const b = i.on ? Math.round(toMo(i.val, i.freq)) : 0;
      const a = td['inc_' + i.id] !== undefined && td['inc_' + i.id] !== '' ? td['inc_' + i.id] : '';
      const row = trackerRows.length + 1;
      trackerRows.push([i.name, b, a !== '' ? a : '', a !== '' ? `=C${row}-B${row}` : '', i.owner, i.purpose || '']);
    });
    const tIncEnd = trackerRows.length;
    trackerRows.push(['Total Income', `=SUM(B${tIncStart + 1}:B${tIncEnd})`, `=SUM(C${tIncStart + 1}:C${tIncEnd})`, `=C${trackerRows.length + 1}-B${trackerRows.length + 1}`, '', '']);
    const tTotalIncRow = trackerRows.length;

    trackerRows.push(['', '', '', '', '', '']);
    const tExpStart = trackerRows.length + 1;
    trackerRows.push(['EXPENSES', '', '', '', '', '']);
    exp.forEach(i => {
      const b = i.on ? Math.round(toMo(i.val, i.freq)) : 0;
      const a = td['exp_' + i.id] !== undefined && td['exp_' + i.id] !== '' ? td['exp_' + i.id] : '';
      const row = trackerRows.length + 1;
      trackerRows.push([i.name, b, a !== '' ? a : '', a !== '' ? `=B${row}-C${row}` : '', i.owner, i.purpose || '']);
    });
    const tExpEnd = trackerRows.length;
    trackerRows.push(['Total Expenses', `=SUM(B${tExpStart + 1}:B${tExpEnd})`, `=SUM(C${tExpStart + 1}:C${tExpEnd})`, `=B${trackerRows.length + 1}-C${trackerRows.length + 1}`, '', '']);
    const tTotalExpRow = trackerRows.length;

    trackerRows.push(['', '', '', '', '', '']);
    trackerRows.push(['Net Balance', `=B${tTotalIncRow}-B${tTotalExpRow}`, `=C${tTotalIncRow}-C${tTotalExpRow}`, `=C${trackerRows.length + 1}-B${trackerRows.length + 1}`, '', '']);

    await apiCall('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Tracker'!A1")}?valueInputOption=USER_ENTERED`,
      { values: trackerRows, majorDimension: 'ROWS' }
    );

    // ── SAVINGS TAB ───────────────────────────────────────────
    const savRows = [
      ['SAVINGS STREAMS', '', '', '', ''],
      ['Name', 'Balance (' + cur + ')', 'Goal (' + cur + ')', 'Progress', 'Owner']
    ];
    if (typeof savingsStreams !== 'undefined') {
      savingsStreams.forEach((s, idx) => {
        const row = savRows.length + 1;
        savRows.push([s.name, s.balance, s.goal || 0, s.goal > 0 ? `=IFERROR(B${row}/C${row}*100,0)&"%"` : '—', s.owner]);
      });
    }
    savRows.push(['', '', '', '', '']);
    savRows.push(['Total Saved', `=SUM(B3:B${savRows.length - 1})`, '', '', '']);

    await apiCall('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Savings'!A1")}?valueInputOption=USER_ENTERED`,
      { values: savRows, majorDimension: 'ROWS' }
    );

    // ── INSTRUMENTS TAB ───────────────────────────────────────
    const instrRows = [
      ['FINANCIAL INSTRUMENTS', '', '', '', '', '', '', ''],
      ['Name', 'Type', 'Capital (' + cur + ')', 'Rate (%)', 'Period (mo)', 'Monthly (' + cur + ')', 'Owner', 'Start', 'Total Cost', 'Total Interest']
    ];
    if (typeof instruments !== 'undefined') {
      instruments.forEach((i, idx) => {
        const row = instrRows.length + 1;
        // For loans: total cost = monthly * period, interest = total cost - capital
        const totalCost = i.type === 'loan' ? `=F${row}*E${row}` : '';
        const totalInt = i.type === 'loan' ? `=I${row}-C${row}` : '';
        instrRows.push([i.name, i.type, i.capital || 0, i.rate || 0, i.period || 0, i.monthly || 0, i.owner, i.start || '', totalCost, totalInt]);
      });
    }

    await apiCall('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Instruments'!A1")}?valueInputOption=USER_ENTERED`,
      { values: instrRows, majorDimension: 'ROWS' }
    );

    // ── EVENTS TAB ────────────────────────────────────────────
    const evtRows = [
      ['TRANSACTION EVENTS', '', '', '', '', '', ''],
      ['Source Item', 'Amount (' + cur + ')', 'Month', 'Year', 'Status', 'Routed To', 'Date']
    ];
    if (typeof txEvents !== 'undefined') {
      txEvents.forEach(e => {
        evtRows.push([e.sourceItem || '', e.amount || 0, e.month, e.year, e.status || '', e.routeTargetName || '', e.dateLabel || '']);
      });
    }
    evtRows.push(['', '', '', '', '', '', '']);
    evtRows.push(['Total surplus routed', `=SUMIF(E3:E${evtRows.length - 1},"tagged",B3:B${evtRows.length - 1})`, '', '', '', '', '']);

    await apiCall('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Events'!A1")}?valueInputOption=USER_ENTERED`,
      { values: evtRows, majorDimension: 'ROWS' }
    );

    // ── DATA TAB (sync source for pull) ──────────────────────
    const dataRows = [
      ['##META', 'version=3', 'Full rebuild by Budget Planner v7', new Date().toISOString()],
      ['##INCOME', ''],
      ...inc.map(i => [i.name, i.on ? Math.round(toMo(i.val, i.freq)) : 0, i.owner, i.purpose || '', i.dueDay || '']),
      ['##EXPENSE', ''],
      ...exp.map(i => [i.name, i.on ? Math.round(toMo(i.val, i.freq)) : 0, i.owner, i.purpose || '', i.dueDay || ''])
    ];
    await apiCall('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'Data'!A1")}?valueInputOption=USER_ENTERED`,
      { values: dataRows, majorDimension: 'ROWS' }
    );

    // ── CONDITIONAL FORMATTING + FREEZE PANES ────────────────
    // Get updated sheet IDs after rebuild
    const meta2 = await apiCall('GET', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`);
    const sheetMap = {};
    meta2.sheets.forEach(s => { sheetMap[s.properties.title] = s.properties.sheetId; });

    const formatRequests = [];

    // Freeze header rows on Dashboard and Tracker
    [sheetName, 'Tracker'].forEach(tabName => {
      if (sheetMap[tabName] !== undefined) {
        formatRequests.push({ updateSheetProperties: { properties: { sheetId: sheetMap[tabName], gridProperties: { frozenRowCount: 2 } }, fields: 'gridProperties.frozenRowCount' } });
      }
    });

    // Balance cell on dashboard — green if positive, red if negative
    if (sheetMap[sheetName] !== undefined) {
      const balanceRowIdx = balanceRow - 1; // 0-indexed
      formatRequests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [{ sheetId: sheetMap[sheetName], startRowIndex: balanceRowIdx, endRowIndex: balanceRowIdx + 1, startColumnIndex: 1, endColumnIndex: 2 }],
            booleanRule: {
              condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '0' }] },
              format: { backgroundColor: { red: 0.85, green: 0.96, blue: 0.88 }, textFormat: { foregroundColor: { red: 0.05, green: 0.49, blue: 0.27 }, bold: true } }
            }
          }, index: 0
        }
      });
      formatRequests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [{ sheetId: sheetMap[sheetName], startRowIndex: balanceRowIdx, endRowIndex: balanceRowIdx + 1, startColumnIndex: 1, endColumnIndex: 2 }],
            booleanRule: {
              condition: { type: 'NUMBER_LESS', values: [{ userEnteredValue: '0' }] },
              format: { backgroundColor: { red: 0.99, green: 0.91, blue: 0.91 }, textFormat: { foregroundColor: { red: 0.89, green: 0.18, blue: 0.18 }, bold: true } }
            }
          }, index: 1
        }
      });
    }

    // Variance column in Tracker — green positive, red negative
    if (sheetMap['Tracker'] !== undefined) {
      formatRequests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [{ sheetId: sheetMap['Tracker'], startRowIndex: 2, endRowIndex: 200, startColumnIndex: 3, endColumnIndex: 4 }],
            booleanRule: {
              condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '0' }] },
              format: { textFormat: { foregroundColor: { red: 0.05, green: 0.49, blue: 0.27 }, bold: true } }
            }
          }, index: 0
        }
      });
      formatRequests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [{ sheetId: sheetMap['Tracker'], startRowIndex: 2, endRowIndex: 200, startColumnIndex: 3, endColumnIndex: 4 }],
            booleanRule: {
              condition: { type: 'NUMBER_LESS', values: [{ userEnteredValue: '0' }] },
              format: { textFormat: { foregroundColor: { red: 0.89, green: 0.18, blue: 0.18 }, bold: true } }
            }
          }, index: 1
        }
      });
    }

    if (formatRequests.length) {
      await apiCall('POST', `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, { requests: formatRequests });
    }

    if (typeof setSyncStatus === 'function') setSyncStatus('connected', 'Sheet fully rebuilt with formulas');
    if (typeof setLastSync === 'function') setLastSync();
    alert('✅ Google Sheet fully rebuilt!\n\nAll tabs created with live formulas:\n• Dashboard — SUM formulas for totals, balance, savings rate\n• Tracker — Budget vs Actual with variance formulas\n• Savings — Progress % calculated live\n• Instruments — Total cost & interest formulas\n• Events — Surplus total formula\n\nConditional formatting applied:\n• Balance: green/red based on value\n• Tracker variances: colour coded');

  } catch(err) {
    if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Rebuild failed: ' + err.message.slice(0, 40));
    console.error('Sheet rebuild failed:', err);
    alert('Sheet rebuild failed: ' + err.message);
  }
};

// ══════════════════════════════════════════════════════════════
// 10. PATCH executeOverwrite BUTTON TO USE FULL REBUILD
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  setTimeout(() => {
    // Find the Overwrite now button and wire it to full rebuild
    const owBtn = document.querySelector('[onclick="executeOverwrite()"]');
    if (owBtn) {
      owBtn.onclick = function() {
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
        executeFullSheetRebuild();
      };
    }
  }, 500);
});

// ══════════════════════════════════════════════════════════════
// 11. STOP AUTO-OVERWRITING SHEET ON LOAD
// Remove debouncePush from recalc — only push on explicit action
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  if (typeof debouncePush === 'function') {
    window.debouncePush = function() {
      // No-op — prevent auto-push on every recalc
      // Push only happens via: Save File button, Overwrite Sheet, Upload Master
    };
    console.log('patch v7: auto-push disabled');
  }
});

console.log('patch v7: all features registered');
