// ==========================================
// patch.js — Dynamic Budget Planner Overrides (v6 - Complete)
// ==========================================
console.log("Patch v6 loaded.");

// ══════════════════════════════════════════════════════════════
// 1. PROFILE REFRESH FIX
// ══════════════════════════════════════════════════════════════
const _origLsSave = window.lsSave;

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


// ══════════════════════════════════════════════════════════════
// 4. MASTER EXCEL UPLOAD — overwrite site state
// ══════════════════════════════════════════════════════════════

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
window.removeQueuedFile = function(index) {
  if (typeof importQueue !== 'undefined') {
    importQueue.splice(index, 1);
    if (typeof renderImportPreview === 'function') window.renderImportPreview();
  }
};
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
window.saveIndefiniteSnapshot = async function(fileName) {
  if (typeof accessToken === 'undefined' || !accessToken) return;
  
  // CORRECTED: Pointing to the specific "Site Cache / State" folder
  const CACHE_FOLDER_ID = '1bRgzrxmEcFQeKICx611sg4HY3XlzEDiE'; 
  
  const stateData = localStorage.getItem('bp_state_v7');
  const blob = new Blob([stateData], { type: 'application/json' });
  
  const meta = { name: fileName, parents: [CACHE_FOLDER_ID] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob);

  try {
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + accessToken },
      body: form
    });
    console.log('Site state successfully cached to folder: ' + CACHE_FOLDER_ID);
  } catch(e) {
    console.error('Failed to cache site state:', e);
  }
};
window.restoreFromCloudSnapshot = async function() {
  if (typeof accessToken === 'undefined' || !accessToken) { alert('Connect to Google first.'); return; }
  
  // Your "Site Cache / State" folder
  const CACHE_FOLDER_ID = '1bRgzrxmEcFQeKICx611sg4HY3XlzEDiE';
  
  window.showCustomDrivePicker(CACHE_FOLDER_ID, 'application/json', async (fileId, fileName, modifiedTime) => {
    const saveDate = new Date(modifiedTime).toLocaleString();
    if (!confirm(`Overwrite site memory with this Cloud Cache?\n\nFile: ${fileName}\nDate: ${saveDate}`)) return;

    try {
      if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Downloading cache...');
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      const jsonText = await fileRes.text();
      localStorage.setItem('bp_state_v7', jsonText);
      alert('Cache applied! Reloading site...');
      location.reload(); 
    } catch(e) {
      alert('Failed to restore from cloud cache: ' + e.message); 
      if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Cloud sync failed');
    }
  });
};
window.openDriveMasterPicker = async function() {
  if (typeof accessToken === 'undefined' || !accessToken) { alert('Connect to Google first.'); return; }
  
  // Your "Master Site Database" folder
  const TARGET_FOLDER_ID = '1nHM5aiylC0kE6Km7W_US9Z_TWlcWpxKh';
  
  // Fetch files (ignoring mimeType so it grabs your Excel files)
  window.showCustomDrivePicker(TARGET_FOLDER_ID, '', async (fileId, fileName) => {
    try {
      if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Downloading Master...');
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      const blob = await fileRes.arrayBuffer();
      
      // Feed it into the aggressive Excel overwrite logic we built earlier
      if (typeof window.handleMasterUpload === 'function') {
        window.handleMasterUpload({ target: { files: [new File([blob], fileName)] } });
        if (typeof setSyncStatus === 'function') setSyncStatus('connected', 'Loaded: ' + fileName);
      }
    } catch(e) {
      alert('Failed to load from Drive: ' + e.message); 
      if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Drive load failed');
    }
  });
};
window.downloadMasterTemplate = function() {
  if (typeof XLSX === 'undefined') { alert('Excel library loading, try again in a second.'); return; }
  const wb = XLSX.utils.book_new();

  // A. Configuration & State
  const confExp = [
    { key: 'accountBalance', value: typeof accountBalance !== 'undefined' ? accountBalance : 0 },
    { key: 'activeProfile', value: typeof activeProfile !== 'undefined' ? activeProfile : 'trevin' }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(confExp), 'Config');

  // B. Items
  const itemsExp = items.map(i => ({
    ID: i.id, Type: i.type, Name: i.name, Amount: i.val || 0, Frequency: i.freq || 'monthly',
    Category: i.cat || '', Purpose: i.purpose || '', Owner: i.owner || 'shared',
    Active: i.on ? 'TRUE' : 'FALSE', DueDay: i.dueDay || 0, BufferDays: i.bufferDays || 0,
    SplitTrevin: i.splitRatio?.trevin || 0, SplitDulini: i.splitRatio?.dulini || 0
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsExp.length ? itemsExp : [{}]), 'Items');

  // C. Savings & Instruments
  const savExp = (typeof savingsStreams !== 'undefined' ? savingsStreams : []).map(s => ({
    ID: s.id, Name: s.name, Balance: s.balance || 0, Goal: s.goal || 0, Owner: s.owner || 'shared'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(savExp.length ? savExp : [{}]), 'Savings');

  const instExp = (typeof instruments !== 'undefined' ? instruments : []).map(i => ({
    ID: i.id, Name: i.name, Type: i.type || 'loan', Capital: i.capital || 0, Rate: i.rate || 0,
    Period: i.period || 0, Monthly: i.monthly || 0, Start: i.start || '', Owner: i.owner || 'shared'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(instExp.length ? instExp : [{}]), 'Instruments');

  // D. ALL Tracker Data (Captures every typed amount for every month)
  const trackerRows = [];
  if (typeof trackerData !== 'undefined') {
    Object.keys(trackerData).forEach(my => {
      Object.keys(trackerData[my]).forEach(k => {
        if (k !== 'routes') trackerRows.push({ MonthYear: my, ItemKey: k, ActualValue: trackerData[my][k] });
      });
    });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trackerRows.length ? trackerRows : [{ MonthYear:'', ItemKey:'', ActualValue:'' }]), 'TrackerActuals');

  // E. ALL Month History (Captures the Insights dashboard calculations)
  const historyRows = [];
  if (typeof monthHistory !== 'undefined') {
    Object.keys(monthHistory).forEach(my => {
      const h = monthHistory[my];
      historyRows.push({
        MonthYear: my,
        TotalIncome: h.totalIncome || 0, TotalExpenses: h.totalExpenses || 0,
        TotalSaved: h.totalSaved || 0,
        TrevinExp: h.perPerson?.trevin?.expenses || 0, DuliniExp: h.perPerson?.dulini?.expenses || 0,
        TrevinInc: h.perPerson?.trevin?.income || 0, DuliniInc: h.perPerson?.dulini?.income || 0,
        Imported: h.imported ? 'TRUE' : 'FALSE'
      });
    });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(historyRows.length ? historyRows : [{}]), 'MonthHistory');

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

      // 1. Build fresh containers
      let newItems = []; let newSavings = []; let newInst = [];
      let newTracker = {}; let newMonthHist = {}; let newInsightHist = {};
      let newBalance = 0;

      // 2. Extract Data from Excel
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
          purpose: (r.Purpose || '').toLowerCase(), owner: (r.Owner || 'shared').toLowerCase(),
          on: String(r.Active).toUpperCase() === 'TRUE',
          dueDay: parseInt(r.DueDay) || 0, bufferDays: parseInt(r.BufferDays) || 0,
          splitRatio: { trevin: parseFloat(r.SplitTrevin) || 0, dulini: parseFloat(r.SplitDulini) || 0 },
          history: []
        }));
      }
      if (wb.Sheets['Savings']) {
        newSavings = XLSX.utils.sheet_to_json(wb.Sheets['Savings']).filter(r => r.Name).map(r => ({
          id: r.ID || Math.random().toString(36).slice(2), name: r.Name, 
          balance: parseFloat(r.Balance) || 0, goal: parseFloat(r.Goal) || 0, 
          owner: (r.Owner || 'shared').toLowerCase(), history: []
        }));
      }
      if (wb.Sheets['Instruments']) {
        newInst = XLSX.utils.sheet_to_json(wb.Sheets['Instruments']).filter(r => r.Name).map(r => ({
          id: r.ID || Math.random().toString(36).slice(2), name: r.Name, type: (r.Type || 'loan').toLowerCase(),
          capital: parseFloat(r.Capital) || 0, rate: parseFloat(r.Rate) || 0, period: parseInt(r.Period) || 0,
          monthly: parseFloat(r.Monthly) || 0, start: r.Start || '', owner: (r.Owner || 'shared').toLowerCase()
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

      // 3. THE HARD INJECTION: Create raw state package
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

      // 4. OVERWRITE BROWSER CACHE DIRECTLY
      localStorage.setItem('bp_state_v7', JSON.stringify(hardState));

      // 5. UPDATE CLOUD CACHE
      if (typeof window.saveIndefiniteSnapshot === 'function') {
        if (typeof setSyncStatus === 'function') setSyncStatus('syncing', 'Updating Cloud Cache...');
        await window.saveIndefiniteSnapshot('HARD_OVERWRITE_' + new Date().toISOString() + '.json');
      }

      // 6. THE KILL-SWITCH: Neutralize the site's ability to save before we reload!
      window.lsSave = function() { console.log('Blocked phantom save during Hard Overwrite.'); };
      window.saveFileAndSync = function() { console.log('Blocked cloud sync during Hard Overwrite.'); };
      
      // Wipe live memory just to be absolutely certain
      window.items = []; window.trackerData = {}; window.monthHistory = {};

      // 7. RESTART
      if (confirm('HARD OVERWRITE COMPLETE.\n\nThe database has been forcibly replaced with your Excel file.\nThe site will now restart to load your new data.')) {
        location.reload();
      }

    } catch(err) {
      if (typeof setSyncStatus === 'function') setSyncStatus('error', 'Hard Overwrite Failed');
      alert('Error replacing site data. Ensure the Excel format is correct.\n\n' + err.message);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
};
