// ==========================================
// patch-v6.js — Purpose badge open tags + full localStorage persistence
// ==========================================
console.log("Patch v6 (Open tags + persistence) loaded.");

// ── COLOUR MAP for predefined purpose tags ──────────────────────
// Any value NOT in this map gets the default neutral style
const PURPOSE_COLOR_MAP = {
  saving:      { bg: 'var(--accent-light)',   color: 'var(--accent-dark)',  border: 'var(--accent)'   },
  investment:  { bg: 'var(--gold-light)',      color: 'var(--gold)',         border: 'var(--gold)'     },
  loan:        { bg: 'var(--danger-light)',    color: 'var(--danger)',       border: 'var(--danger)'   },
  fd:          { bg: 'var(--info-light)',      color: 'var(--info)',         border: 'var(--info)'     },
  fund:        { bg: 'var(--gold-light)',      color: 'var(--gold)',         border: 'var(--gold)'     },
  earning:     { bg: 'var(--info-light)',      color: 'var(--info)',         border: 'var(--info)'     },
  living:      { bg: 'var(--purple-light)',    color: 'var(--purple)',       border: 'var(--purple)'   },
  vehicle:     { bg: 'var(--warning-light)',   color: 'var(--warning)',      border: 'var(--warning)'  },
  entertainment:{ bg:'var(--pink-light)',      color: 'var(--pink)',         border: 'var(--pink)'     },
};
const PURPOSE_DEFAULT = {
  bg: 'var(--surface3)', color: 'var(--text2)', border: 'var(--border)'
};

// Returns an inline-styled badge span for ANY purpose string
window.purposeBadgeHtml = function(purposeVal, itemId) {
  if (!purposeVal || !purposeVal.trim()) {
    // No purpose — show faint "+ tag" prompt
    return `<span class="purpose-badge add" onclick="promptSetPurpose('${itemId}')" title="Add a purpose tag">+ tag</span>`;
  }
  const key = purposeVal.trim().toLowerCase();
  const style = PURPOSE_COLOR_MAP[key] || PURPOSE_DEFAULT;
  const label = purposeVal.trim();
  return `<span
    style="font-size:9px;padding:1px 6px;border-radius:99px;cursor:pointer;flex-shrink:0;border:1px solid ${style.border};background:${style.bg};color:${style.color};"
    onclick="promptSetPurpose('${itemId}')"
    title="Click to change — type any word"
  >${label}</span>`;
};

// Prompt to set/change purpose — any free text accepted
window.promptSetPurpose = function(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  const current = item.purpose || '';
  const v = prompt(
    'Set purpose tag (any word — e.g. saving, earning, living, vehicle, entertainment, or anything else).\nLeave blank to remove.',
    current
  );
  if (v === null) return; // cancelled
  item.purpose = v.trim().toLowerCase();
  if (typeof markDirty === 'function') markDirty();
  if (typeof recalc === 'function') recalc();
};

// ── PATCH buildItemRow to use the new badge ─────────────────────
// Wait until the main script has defined buildItemRow, then wrap it
window.addEventListener('load', () => {
  if (typeof buildItemRow !== 'function') {
    console.warn('patch-v6: buildItemRow not found — badge patch skipped');
    return;
  }
  const _origBuildItemRow = window.buildItemRow;
  window.buildItemRow = function(item) {
    const el = _origBuildItemRow(item);
    // Replace whatever purpose badge was rendered with the open-tag version
    // Find the existing purpose badge span inside the element and replace it
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
  console.log('patch-v6: buildItemRow patched for open purpose tags');
});

// ── ALSO patch the global table purpose select to be a free-text input ──
// Wrap renderGlobalTable to swap the purpose <select> for an <input>
window.addEventListener('load', () => {
  if (typeof renderGlobalTable !== 'function') return;
  const _origRGT = window.renderGlobalTable;
  window.renderGlobalTable = function() {
    _origRGT();
    // After render, find all purpose <select> in global table and replace with text inputs
    const tbody = document.getElementById('global-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach((row, idx) => {
      const item = items[idx];
      if (!item) return;
      const selects = row.querySelectorAll('select');
      selects.forEach(sel => {
        // Identify purpose select by checking if its options include 'saving'
        const optVals = Array.from(sel.options).map(o => o.value);
        if (optVals.includes('saving') && optVals.includes('loan')) {
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
  console.log('patch-v6: renderGlobalTable patched — purpose is now free text');
});

// ── FULL LOCALSTORAGE PERSISTENCE ──────────────────────────────
// Override lsSave to capture ALL state
window.lsSave = function() {
  try {
    const state = {
      items,
      trackerData,
      savingsStreams,
      instruments,
      txEvents,
      monthHistory,
      monthNotes:    typeof monthNotes    !== 'undefined' ? monthNotes    : {},
      accountBalance:typeof accountBalance!== 'undefined' ? accountBalance: 0,
      templates:     typeof templates     !== 'undefined' ? templates     : [],
      settlementHistory: typeof settlementHistory !== 'undefined' ? settlementHistory : [],
      currencySymbol:typeof currencySymbol!== 'undefined' ? currencySymbol: 'LKR',
      currencyLocale:typeof currencyLocale!== 'undefined' ? currencyLocale: 'en-LK',
      isDarkTheme:   typeof isDarkTheme   !== 'undefined' ? isDarkTheme   : false,
      activeProfile: typeof activeProfile !== 'undefined' ? activeProfile : 'trevin',
      connections:   typeof connections   !== 'undefined' ? connections.map(c=>({...c,active:false})) : [],
      _v: 6,
      _ts: Date.now()
    };
    localStorage.setItem('bp_state_v6', JSON.stringify(state));
  } catch(e) {
    console.warn('lsSave failed:', e);
  }
};

// lsLoad — call this early to restore all state before recalc
window.lsLoad = function() {
  try {
    const raw = localStorage.getItem('bp_state_v6');
    if (!raw) return false;
    const state = JSON.parse(raw);
    if (!state || state._v !== 6) return false;

    if (Array.isArray(state.items) && state.items.length)
      items = state.items.map(i => ({ ...i, history: i.history || [], calEventId: i.calEventId || null }));

    if (state.trackerData)      trackerData      = state.trackerData;
    if (Array.isArray(state.savingsStreams))
      savingsStreams = state.savingsStreams.map(s => ({ ...s, history: s.history || [] }));
    if (Array.isArray(state.instruments))
      instruments    = state.instruments;
    if (Array.isArray(state.txEvents))
      txEvents       = state.txEvents.map(e => ({ ...e, chain: e.chain || [] }));
    if (state.monthHistory)     monthHistory     = state.monthHistory;
    if (state.monthNotes)       monthNotes       = state.monthNotes;
    if (typeof state.accountBalance === 'number') accountBalance = state.accountBalance;
    if (Array.isArray(state.templates))           templates      = state.templates;
    if (Array.isArray(state.settlementHistory))   settlementHistory = state.settlementHistory;
    if (state.currencySymbol)   currencySymbol   = state.currencySymbol;
    if (state.currencyLocale)   currencyLocale   = state.currencyLocale;
    if (typeof state.isDarkTheme === 'boolean')   isDarkTheme    = state.isDarkTheme;
    if (state.activeProfile)    activeProfile    = state.activeProfile;
    if (Array.isArray(state.connections) && state.connections.length) {
      connections = state.connections;
      // Always keep default credentials hardcoded
      const def = connections.find(c => c.id === 'default');
      if (def) {
        def.clientId  = typeof DEFAULT_CLIENT_ID   !== 'undefined' ? DEFAULT_CLIENT_ID   : def.clientId;
        def.sheetId   = typeof SPREADSHEET_ID      !== 'undefined' ? SPREADSHEET_ID      : def.sheetId;
        def.sheetName = typeof DEFAULT_SHEET_NAME  !== 'undefined' ? DEFAULT_SHEET_NAME  : def.sheetName;
      }
      if (typeof activeConn !== 'undefined') activeConn = connections[0];
    }
    console.log('patch-v6: state restored from localStorage', new Date(state._ts).toLocaleTimeString());
    return true;
  } catch(e) {
    console.warn('lsLoad failed:', e);
    return false;
  }
};

// Hook lsSave into markDirty if it exists, otherwise set up a periodic save
window.addEventListener('load', () => {
  // Run lsLoad immediately to restore state before any render
  if (window.lsLoad()) {
    // State restored — re-run recalc and UI updates
    if (typeof applyTheme        === 'function') applyTheme();
    if (typeof recalc            === 'function') recalc();
    if (typeof updateEventsBadge === 'function') updateEventsBadge();
    if (typeof buildNotifications=== 'function') buildNotifications();
    if (typeof renderTemplates   === 'function') renderTemplates();
    if (typeof setProfile        === 'function') setProfile(activeProfile || 'trevin');
  }

  // Hook into markDirty
  if (typeof markDirty === 'function') {
    const _origMD = window.markDirty;
    window.markDirty = function() {
      _origMD();
      window.lsSave();
    };
  } else {
    // Fallback — auto-save every 10 seconds and on key interactions
    setInterval(window.lsSave, 10000);
  }

  // Also save on page unload/hide
  window.addEventListener('beforeunload', window.lsSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') window.lsSave();
  });

  console.log('patch-v6: persistence hooks installed');
});

// ── PATCH handleMasterUpload to call lsSave after overwrite ────
// The existing patch-v5 handleMasterUpload calls lsSave at the end —
// since we've now overridden lsSave to be complete, this just works.
// But wrap it to be sure:
window.addEventListener('load', () => {
  if (typeof handleMasterUpload === 'function') {
    const _orig = window.handleMasterUpload;
    window.handleMasterUpload = function(event) {
      _orig(event);
      // Give the reader time to finish, then save
      setTimeout(() => {
        window.lsSave();
        console.log('patch-v6: post-master-upload save completed');
      }, 500);
    };
  }
});

// ── CATEGORY: accept any new value in global table ─────────────
// The category select already has a "+ New..." option in the main code.
// This patch ensures that any new category entered also gets persisted
// and displayed with a neutral colour if not in CAT_COLORS.
window.addEventListener('load', () => {
  const origCatColors = typeof CAT_COLORS !== 'undefined' ? CAT_COLORS : {};
  // Proxy: any category not in CAT_COLORS returns a neutral colour
  window.getCatColor = function(cat) {
    return origCatColors[cat] || '#888780';
  };
  console.log('patch-v6: open category colours active');
});
