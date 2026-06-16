// ═══════════════════════════════════════════════════════════════
// BUDGET PLANNER — patch2.js (Isolated God Mode UI)
// ═══════════════════════════════════════════════════════════════
(function() {
    'use strict';

    function injectGodModeUI() {
        // 1. Ensure we only inject once
        if (document.getElementById('gm-btn')) return;

        // 2. Locate Nav Container via bridge
        const navRight = window.BudgetPlanner?.tabs?.navRight;
        if (!navRight) return;

        // 3. Create Button
        const btn = document.createElement('button');
        btn.id = 'gm-btn';
        btn.className = 'god-btn';
        btn.innerHTML = '<i class="ti ti-adjustments"></i> Configure';
        btn.onclick = () => {
            // Placeholder: Call the main God Mode toggle if it exists
            if (window.toggleGodMode) window.toggleGodMode();
        };
        
        navRight.insertBefore(btn, navRight.firstChild);
        console.log('✅ patch2.js: God Mode button injected.');
    }

    // 4. Persistence Observer (Fixes the "wipe" issue)
    function startObserver() {
        const navRight = window.BudgetPlanner?.tabs?.navRight;
        if (!navRight) return;

        const observer = new MutationObserver(() => {
            if (!document.getElementById('gm-btn')) {
                injectGodModeUI();
            }
        });
        observer.observe(navRight, { childList: true, subtree: true });
    }

    // Initialize after a delay to let the site load
    setTimeout(() => {
        injectGodModeUI();
        startObserver();
    }, 1000);
})();