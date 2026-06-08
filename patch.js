// ==========================================
// patch.js — Dynamic Budget Planner Overrides (v3 - Master Format)
// ==========================================
console.log("Patch layer v3 loaded successfully.");

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
    formatBtn.innerHTML = '<i class="ti ti-file-settings"></i> Master Format';
    formatBtn.onclick = openFormatManager;
    syncBar.appendChild(formatBtn);
  }

  if (!document.getElementById('format-manager-overlay')) {
    const modalHTML = `
    <div class="modal-overlay" id="format-manager-overlay" onclick="if(event.target===this) this.classList.remove('open')">
      <div class="modal">
        <div class="modal-head">
          <span class="modal-title"><i class="ti ti-database" style="color:var(--danger);"></i> Master Source of Truth</span>
          <button class="modal-close" onclick="document.getElementById('format-manager-overlay').classList.remove('open')"><i class="ti ti-x"></i></button>
        </div>
        
        <div style="padding: 16px; font-size: 13px; color: var(--text2); line-height: 1.5;">
          <div style="background: rgba(255,59,48,0.1); border-left: 3px solid var(--danger); padding: 10px; margin-bottom: 15px; color: var(--text);">
            <strong>WARNING:</strong> Uploading a Master Sheet will completely overwrite and replace the site's current data. The spreadsheet becomes the absolute truth.
          </div>
          
          <button class="btn btn-sm" style="margin-bottom: 16px; width: 100%; justify-content: center; background: var(--surface2); border-color: var(--border);" onclick="downloadMasterTemplate()">
            <i class="ti ti-download"></i> Download Comprehensive Template (CSV)
          </button>
          
          <div class="import-zone" onclick="document.getElementById('master-upload-file').click()" style="cursor: pointer; border: 2px dashed var(--danger); border-radius: var(--radius); padding: 30px 20px; text-align: center; transition: all 0.2s;">
            <i class="ti ti-upload" style="font-size:28px; margin-bottom:8px; display:block; color:var(--danger);"></i>
            Drop Master File here to Overwrite Site<br>
            <span style="font-size:10px; opacity:0.7;">Accepts .csv or .xlsx</span>
          </div>
          <input type="file" id="master-upload-file" accept=".csv,.xlsx,.xls" style="display:none;" onchange="handleMasterUpload(event)">
          
          <div id="master-upload-status" style="margin-top: 12px; font-weight: 600; text-align: center;"></div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
});

// ── 3. MASTER FORMAT LOGIC ─────────────────────────────────────
function openFormatManager() {
  document.getElementById('format-manager-overlay').classList.add('open');
  document.getElementById('master-upload-status').innerHTML = ""; 
}

// Generates the comprehensive template reflecting all site functions
function downloadMasterTemplate() {
  const headers = "DataType,Owner,Category,Name_or_Desc,Amount,Date,Notes\n";
  
  // Sample data demonstrating how every function of the site maps to the sheet
  const sampleData = 
    "Income,trevin,Salary,Trevin Base Pay,100000,,\n" +
    "Income,dulini,Salary,Dulini Base Pay,100000,,\n" +
    "Expense,shared,Housing,Rent,50000,,\n" +
    "Expense,trevin,Transport,Fuel,15000,,\n" +
    "Saving,shared,Emergency,Joint Fund,20000,,\n" +
    "Instrument,trevin,Bank,HNB Checking,150000,,\n" +
    "Instrument,shared,Cash,Safe Box,25000,,\n" +
    "Transaction,trevin,Food,KFC Dinner,3500,2026-06-08,Paid via Koko\n" +
    "Transaction,shared,Groceries,Keells Super,8500,2026-06-07,\n";
    
  const blob = new Blob([headers + sampleData], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "Budget_Master_Format.csv";
  a.click();
  window.URL.revokeObjectURL(url);
}

// Parses the file and OVERWRITES the site data
function handleMasterUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('master-upload-status');
  statusEl.innerHTML = `<span style="color:var(--text2);"><i class="ti ti-loader"></i> Auditing and Overwriting...</span>`;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, {defval: ""});
      
      // 🚨 HARD RESET: Wipe current site memory to prepare for Master Sheet 🚨
      window.incomeStreams = [];
      window.expenses = [];
      window.savingsStreams = [];
      window.instruments = [];
      window.txEvents = [];

      // Route data to the correct arrays based on DataType
      rows.forEach(row => {
        const type = String(row['DataType']).trim().toLowerCase();
        if (!type) return; // skip blank rows
        
        const item = {
          id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 9),
          category: String(row['Category']).trim() || 'General',
          name: String(row['Name_or_Desc']).trim() || 'Unnamed',
          amount: parseFloat(row['Amount']) || 0,
          owner: String(row['Owner']).trim().toLowerCase() || 'shared'
        };

        if (type === 'income') {
          window.incomeStreams.push(item);
        } else if (type === 'expense') {
          window.expenses.push(item);
        } else if (type === 'saving' || type === 'savings') {
          window.savingsStreams.push(item);
        } else if (type === 'instrument') {
          window.instruments.push(item);
        } else if (type === 'transaction') {
          // Transactions have a slightly different structure in the backend
          window.txEvents.push({
            id: item.id,
            date: String(row['Date']).trim() || new Date().toISOString().split('T')[0],
            desc: item.name,
            amount: item.amount,
            type: 'expense', // Assume out-flow by default, site logic handles it
            owner: item.owner
          });
        }
      });

      // 🚨 COMMAND OVERWRITE: Force site to recalculate and hard-save to memory
      if (typeof recalc === 'function') recalc();
      if (typeof lsSave === 'function') lsSave();

      statusEl.innerHTML = `<span style="color:var(--accent);"><i class="ti ti-check"></i> OVERWRITE COMPLETE. Site matches Master File.</span>`;
      
      setTimeout(() => {
        document.getElementById('format-manager-overlay').classList.remove('open');
        event.target.value = ''; 
      }, 2000);

    } catch (err) {
      statusEl.innerHTML = `<span style="color:var(--danger);"><i class="ti ti-alert-triangle"></i> Data mismatch. Ensure it matches the template.</span>`;
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}
