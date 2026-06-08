// ==========================================
// patch.js — Dynamic Budget Planner Overrides
// ==========================================
console.log("Patch layer loaded successfully.");

// ── 1. FIX PROFILE REFRESH BUG ─────────────────────────────────
const originalLsSave = window.lsSave;

window.lsSave = function() {
  if (typeof originalLsSave === 'function') {
    originalLsSave();
  }
  try {
    localStorage.setItem('bp_active_profile', activeProfile);
  } catch(e) {}
};

window.addEventListener('load', () => {
  const savedProfile = localStorage.getItem('bp_active_profile');
  if (savedProfile && typeof setProfile === 'function') {
    setProfile(savedProfile);
  }
});

// ── 2. FORMAT FILE UI INJECTION ──────────────────────────────
window.addEventListener('load', () => {
  // Inject the button into the Sync Bar
  const syncBar = document.querySelector('.sync-bar');
  if (syncBar && !document.getElementById('btn-master-format')) {
    const formatBtn = document.createElement('button');
    formatBtn.id = 'btn-master-format';
    formatBtn.className = 'btn btn-sm';
    formatBtn.innerHTML = '<i class="ti ti-file-settings"></i> Master Format';
    formatBtn.onclick = openFormatManager;
    syncBar.appendChild(formatBtn);
  }

  // Inject the hidden Modal into the body
  if (!document.getElementById('format-manager-overlay')) {
    const modalHTML = `
    <div class="modal-overlay" id="format-manager-overlay" onclick="if(event.target===this) this.classList.remove('open')">
      <div class="modal">
        <div class="modal-head">
          <span class="modal-title"><i class="ti ti-file-settings" style="color:var(--accent);"></i> Master Format Manager</span>
          <button class="modal-close" onclick="document.getElementById('format-manager-overlay').classList.remove('open')"><i class="ti ti-x"></i></button>
        </div>
        
        <div style="padding: 16px; font-size: 13px; color: var(--text2); line-height: 1.5;">
          <p style="margin-top:0;">The Master Format is your single source of truth. Download the template, fill in your base budget data, and upload it to instantly sync the dashboard.</p>
          
          <button class="btn btn-sm" style="margin-bottom: 16px; width: 100%; justify-content: center; border-color: var(--border);" onclick="downloadMasterTemplate()">
            <i class="ti ti-download"></i> Download Blank Template (CSV)
          </button>
          
          <div class="import-zone" onclick="document.getElementById('master-upload-file').click()" style="cursor: pointer; border: 2px dashed var(--border); border-radius: var(--radius); padding: 30px 20px; text-align: center; transition: all 0.2s;">
            <i class="ti ti-upload" style="font-size:28px; margin-bottom:8px; display:block; color:var(--text3);"></i>
            Drop Master File here, or click to browse.<br>
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
  document.getElementById('master-upload-status').innerHTML = ""; // reset status
}

// Generates and downloads a clean CSV template for you to fill out
function downloadMasterTemplate() {
  const headers = "Type,Category,Name,Amount,Owner\n";
  const sampleData = 
    "Income,Salary,Trevin Base Pay,100000,trevin\n" +
    "Income,Salary,Dulini Base Pay,100000,dulini\n" +
    "Expense,Housing,Rent,50000,shared\n" +
    "Savings,Emergency,Joint Fund,20000,shared\n" +
    "Instrument,Bank,HNB Checking,150000,trevin";
    
  const blob = new Blob([headers + sampleData], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "Budget_Master_Template.csv";
  a.click();
  window.URL.revokeObjectURL(url);
}

// Parses the uploaded file and overrides the local state
function handleMasterUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('master-upload-status');
  statusEl.innerHTML = `<span style="color:var(--text2);"><i class="ti ti-loader"></i> Reading file...</span>`;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Convert Excel rows to JSON array
      const rows = XLSX.utils.sheet_to_json(firstSheet, {defval: ""});
      
      // Clear current memory arrays (defined in your index.html)
      window.incomeStreams = [];
      window.expenses = [];
      window.savingsStreams = [];
      window.instruments = [];

      // Route data to the correct arrays based on the "Type" column
      rows.forEach(row => {
        const item = {
          id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 9),
          category: row.Category || 'Other',
          name: row.Name || 'Unnamed',
          amount: parseFloat(row.Amount) || 0,
          owner: (row.Owner || 'shared').toLowerCase()
        };

        const type = (row.Type || '').toLowerCase();
        if (type === 'income') window.incomeStreams.push(item);
        else if (type === 'expense') window.expenses.push(item);
        else if (type === 'savings') window.savingsStreams.push(item);
        else if (type === 'instrument') window.instruments.push(item);
      });

      // Force the app to recalculate and save the new truth
      if (typeof recalc === 'function') recalc();
      if (typeof lsSave === 'function') lsSave();

      statusEl.innerHTML = `<span style="color:var(--accent);"><i class="ti ti-check"></i> Master Format applied successfully!</span>`;
      
      // Close modal after 1.5s
      setTimeout(() => {
        document.getElementById('format-manager-overlay').classList.remove('open');
        event.target.value = ''; // Reset file input
      }, 1500);

    } catch (err) {
      statusEl.innerHTML = `<span style="color:var(--danger);"><i class="ti ti-alert-triangle"></i> Error parsing file. Ensure it matches the template.</span>`;
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}
