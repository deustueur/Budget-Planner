// ==========================================
// patch.js — Dynamic Budget Planner Overrides
// ==========================================
console.log("Patch layer loaded successfully.");

// ── 1. FIX PROFILE REFRESH BUG ─────────────────────────────────
// We override the original lsSave function to also remember who is looking at the dashboard.
const originalLsSave = window.lsSave;

window.lsSave = function() {
  // Run the original save logic first
  if (typeof originalLsSave === 'function') {
    originalLsSave();
  }
  // Inject our new rule: save the active profile
  try {
    localStorage.setItem('bp_active_profile', activeProfile);
  } catch(e) {}
};

// When the page finishes loading, check if a profile was saved and switch to it instantly.
window.addEventListener('load', () => {
  const savedProfile = localStorage.getItem('bp_active_profile');
  if (savedProfile) {
    setProfile(savedProfile);
  }
});

// ── 2. FORMAT FILE INJECTION HOOK ──────────────────────────────
// Instead of editing the HTML to add new buttons, we use JavaScript 
// to inject them into the page safely.
window.addEventListener('load', () => {
  // Find the sync bar at the top of the page
  const syncBar = document.querySelector('.sync-bar');
  
  if (syncBar) {
    // Create a new button for the Master Format feature
    const formatBtn = document.createElement('button');
    formatBtn.className = 'btn btn-sm';
    formatBtn.innerHTML = '<i class="ti ti-file-settings"></i> Master Format';
    formatBtn.onclick = openFormatManager;
    
    // Add it to the sync bar
    syncBar.appendChild(formatBtn);
  }
});

// Placeholder for the logic we will build next
function openFormatManager() {
  alert("Master Format Manager will open here. Ready for the next patch!");
}
