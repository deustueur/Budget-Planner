// ==========================================
// patch.js — Dynamic Budget Planner Overrides (v5 - Complete Site Mirror)
// ==========================================
console.log("Patch layer v5 (Complete Site Mirror) loaded.");

// ── 1. FIX PROFILE REFRESH BUG ─────────────────────────────────
const originalLsSave = window.lsSave;
window.lsSave = function() {
  if (typeof originalLsSave === 'function') originalLsSave();
  try { localStorage.setItem('bp_active_profile', activeProfile); } catch(e) {}
};

window.addEventListener('load', () => {
  const savedProfile = localStorage.getItem('bp_active_profile');
  if (savedProfile && typeof setProfile === 'function') setProfile(savedProfile);
});

// ── 2. FORMAT FILE UI INJECTION ──────────────────────────────
window.addEventListener('load', () => {
  const syncBar = document.querySelector('.sync-bar');
  if (syncBar && !document.getElementById('btn-master-format')) {
    const formatBtn = document.createElement('button');
    formatBtn.id = 'btn-master-format';
    formatBtn.className = 'btn btn-sm';
    formatBtn.innerHTML = '<i class="ti ti-database"></i> Master Site Database';
    formatBtn.onclick = openFormatManager;
    syncBar.appendChild(formatBtn);
  }

  if (!document.getElementById('format-manager-overlay')) {
    const modalHTML = `
    <div class="modal-overlay" id="format-manager-overlay" onclick="if(event.target===this) this.classList.remove('open')">
      <div class="modal">
        <div class="modal-head">
          <span class="modal-title"><i class="ti ti-database" style="color:var(--danger);"></i> Master Database Control</span>
          <button class="modal-close" onclick="document.getElementById('format-manager-overlay').classList.remove('open')"><i class="ti ti-x"></i></button>
        </div>
        
        <div style="padding: 16px; font-size: 13px; color: var(--text2); line-height: 1.5;">
          <p>Download your current site state as a multi-tab Excel Workbook. You can audit, adjust split ratios, due dates, goals, and actuals directly in Excel, then upload it back to completely overwrite the site.</p>
          
          <button class="btn btn-sm" style="margin-bottom: 16px; width: 100%; justify-content: center; background: var(--info-light); color: var(--info); border-color: var(--info);" onclick="downloadMasterTemplate()">
            <i class="ti ti-download"></i> Download Site Master (.xlsx)
          </button>
          
          <div class="import-zone" onclick="document.getElementById('master-upload-file').click()" style="cursor: pointer; border: 2px dashed var(--danger); border-radius: var(--radius); padding: 30px 20px; text-align: center; transition: all 0.2s;">
            <i class="ti ti-upload" style="font-size:28px; margin-bottom:8px; display:block; color:var(--danger);"></i>
            Upload Master File to Overwrite Site<br>
            <span style="font-size:10px; opacity:0.7;">Must be the exported .xlsx format</span>
          </div>
          <input type="file" id="master-upload-file" accept=".xlsx" style="display:none;" onchange="handleMasterUpload(event)">
          
          <div id="master-upload-status" style="margin-top: 12px; font-weight: 600; text-align: center;"></div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
});

// ── 3. FULL EXCEL MIRROR LOGIC ───────────────────────────────
function openFormatManager() {
  document.getElementById('format-manager-overlay').classList.add('open');
  document.getElementById('master-upload-status').innerHTML = ""; 
}

// Builds the multi-tab Excel file containing ALL site mechanics
function downloadMasterTemplate() {
  if (typeof XLSX === 'undefined') {
    alert("Excel library is still loading, please wait a second.");
    return;
  }
  
  const wb = XLSX.utils.book_new();

  // 1. ITEMS (Income & Expenses + Mechanics)
  const itemsExport = items.map(i => ({
    ID: i.id, Type: i.type, Name: i.name, Amount: i.val, Frequency: i.freq,
    Category: i.cat || '', BudgetTag: i.tag || '', Purpose: i.purpose || '', 
    Owner: i.owner, Active: i.on, DueDay: i.dueDay || 0, BufferDays: i.bufferDays || 0,
    SplitTrevin: i.splitRatio?.trevin || 0, SplitDulini: i.splitRatio?.dulini || 0,
    LinkedInstrument: i.instrumentLink || ''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsExport), "Items");

  // 2. TRACKER ACTUALS (Flattened mapping)
  const trackerRows = [];
  Object.keys(trackerData).forEach(monthYear => {
    Object.keys(trackerData[monthYear]).forEach(itemKey => {
      if (itemKey !== 'routes') {
        trackerRows.push({ MonthYear: monthYear, ItemKey: itemKey, ActualValue: trackerData[monthYear][itemKey] });
      }
    });
  });
  // Ensure the tab exists even if empty
  if (trackerRows.length === 0) trackerRows.push({ MonthYear: "", ItemKey: "", ActualValue: "" });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trackerRows), "TrackerActuals");

  // 3. SAVINGS STREAMS
  const savingsExport = savingsStreams.map(s => ({
    ID: s.id, Name: s.name, Balance: s.balance, Goal: s.goal || 0, Owner: s.owner, Color: s.color || ''
  }));
  if (savingsExport.length === 0) savingsExport.push({ ID: "", Name: "", Balance: "", Goal: "", Owner: "", Color: "" });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(savingsExport), "Savings");

  // 4. INSTRUMENTS
  const instExport = instruments.map(i => ({
    ID: i.id, Name: i.name, Type: i.type, Capital: i.capital || 0, Rate: i.rate || 0,
    Period: i.period || 0, Monthly: i.monthly || 0, Start: i.start || '',
    Units: i.units || 0, Price: i.price || 0, Owner: i.owner, Notes: i.notes || ''
  }));
  if (instExport.length === 0) instExport.push({ ID: "", Name: "", Type: "", Capital: "", Rate: "", Period: "", Monthly: "", Start: "", Units: "", Price: "", Owner: "", Notes: "" });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(instExport), "Instruments");

  // 5. EVENTS
  const eventsExport = txEvents.map(e => ({
    ID: e.id, SourceKey: e.sourceKey || '', SourceItem: e.sourceItem || '', Amount: e.amount || 0,
    Month: e.month, Year: e.year, Status: e.status || '', RouteType: e.routeType || '',
    RouteTarget: e.routeTarget || ''
  }));
  if (eventsExport.length === 0) eventsExport.push({ ID: "", SourceKey: "", SourceItem: "", Amount: "", Month: "", Year: "", Status: "", RouteType: "", RouteTarget: "" });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventsExport), "Events");

  // 6. CONFIG
  const configExport = [{ key: 'accountBalance', value: accountBalance }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(configExport), "Config");

  XLSX.writeFile(wb, "Budget_Site_Master.xlsx");
}

// Parses the file and forces the site arrays to match exactly
function handleMasterUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('master-upload-status');
  statusEl.innerHTML = `<span style="color:var(--text2);"><i class="ti ti-loader"></i> Auditing and Rebuilding Site...</span>`;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      
      // 1. Rebuild ITEMS
      if (workbook.Sheets['Items']) {
        const parsedItems = XLSX.utils.sheet_to_json(workbook.Sheets['Items']);
        items = parsedItems.filter(r => r.Name).map(r => ({
          id: r.ID || uid(),
          type: r.Type,
          name: r.Name,
          val: parseFloat(r.Amount) || 0,
          freq: r.Frequency || 'monthly',
          cat: r.Category || '',
          tag: r.BudgetTag || '',
          purpose: r.Purpose || '',
          owner: r.Owner || 'shared',
          on: String(r.Active).toLowerCase() === 'true' || r.Active === true,
          dueDay: parseInt(r.DueDay) || 0,
          bufferDays: parseInt(r.BufferDays) || 0,
          splitRatio: { trevin: parseFloat(r.SplitTrevin) || 0, dulini: parseFloat(r.SplitDulini) || 0 },
          instrumentLink: r.LinkedInstrument || '',
          history: [] // History reset on hard sync to save space
        }));
      }

      // 2. Rebuild SAVINGS
      if (workbook.Sheets['Savings']) {
        const parsedSav = XLSX.utils.sheet_to_json(workbook.Sheets['Savings']);
        savingsStreams = parsedSav.filter(r => r.Name).map(r => ({
          id: r.ID || uid(),
          name: r.Name,
          balance: parseFloat(r.Balance) || 0,
          goal: parseFloat(r.Goal) || 0,
          owner: r.Owner || 'shared',
          color: r.Color || 'var(--accent)',
          history: []
        }));
      }

      // 3. Rebuild INSTRUMENTS
      if (workbook.Sheets['Instruments']) {
        const parsedInst = XLSX.utils.sheet_to_json(workbook.Sheets['Instruments']);
        instruments = parsedInst.filter(r => r.Name).map(r => ({
          id: r.ID || uid(),
          name: r.Name,
          type: r.Type || 'loan',
          capital: parseFloat(r.Capital) || 0,
          rate: parseFloat(r.Rate) || 0,
          period: parseInt(r.Period) || 0,
          monthly: parseFloat(r.Monthly) || 0,
          start: r.Start || '',
          units: parseFloat(r.Units) || 0,
          price: parseFloat(r.Price) || 0,
          owner: r.Owner || 'shared',
          notes: r.Notes || ''
        }));
      }

      // 4. Rebuild TRACKER ACTUALS
      if (workbook.Sheets['TrackerActuals']) {
        trackerData = {}; // Hard reset
        const parsedTracker = XLSX.utils.sheet_to_json(workbook.Sheets['TrackerActuals']);
        parsedTracker.forEach(r => {
          if (r.MonthYear && r.ItemKey) {
            if (!trackerData[r.MonthYear]) trackerData[r.MonthYear] = {};
            trackerData[r.MonthYear][r.ItemKey] = parseFloat(r.ActualValue) || 0;
          }
        });
      }

      // 5. Rebuild EVENTS
      if (workbook.Sheets['Events']) {
        const parsedEvents = XLSX.utils.sheet_to_json(workbook.Sheets['Events']);
        txEvents = parsedEvents.filter(r => r.Month && r.Year).map(r => ({
          id: r.ID || uid(),
          sourceKey: r.SourceKey || '',
          sourceItem: r.SourceItem || '',
          amount: parseFloat(r.Amount) || 0,
          month: parseInt(r.Month),
          year: parseInt(r.Year),
          dateLabel: MS[parseInt(r.Month)] + ' ' + r.Year,
          status: r.Status || 'untagged',
          routeType: r.RouteType || '',
          routeTarget: r.RouteTarget || '',
          chain: []
        }));
      }

      // 6. Rebuild CONFIG
      if (workbook.Sheets['Config']) {
        const confRows = XLSX.utils.sheet_to_json(workbook.Sheets['Config']);
        const balRow = confRows.find(c => c.key === 'accountBalance');
        if (balRow) accountBalance = parseFloat(balRow.value) || 0;
      }

      // 🚨 COMMIT TO MEMORY & REDRAW
      recalc();
      if (typeof renderTracker === 'function') renderTracker();
      lsSave();

      statusEl.innerHTML = `<span style="color:var(--accent);"><i class="ti ti-check"></i> OVERWRITE COMPLETE. Database Synchronized.</span>`;
      
      setTimeout(() => {
        document.getElementById('format-manager-overlay').classList.remove('open');
        event.target.value = ''; 
      }, 2000);

    } catch (err) {
      statusEl.innerHTML = `<span style="color:var(--danger);"><i class="ti ti-alert-triangle"></i> Rebuild Error: Ensure you uploaded the exact .xlsx format.</span>`;
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}
