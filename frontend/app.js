// app.js — QueryTrace Context Policy Lab

// API_BASE picks absolute localhost for file:// and local dev, empty (same-origin)
// elsewhere. When the page is served from /app/ on the deployed host, fetches
// resolve against the page origin (e.g. https://host/query) — no CORS required.
// Serve the frontend at /app/ on the API origin. An explicit meta override
// supports a separately hosted frontend; cookies follow that origin deliberately.
const API_BASE = (document.querySelector('meta[name="querytrace-api-base"]')?.content || "").replace(/\/$/, "");
const apiFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });
const DEFAULT_TOP_K = 8;
// Original, local line icons; decorative only. Every action retains its text label.
const uiIcon = name => `<svg class="ui-icon" aria-hidden="true"><use href="icons.svg#${name}"/></svg>`;

// ── Policy metadata (label, description, CSS variant) ──

const POLICY_META = {
  naive_top_k: {
    label: "Top-k · no filters",
    desc: "No permission or budget checks.",
    variant: "naive",
    skipFreshness: true,
  },
  permission_aware: {
    label: "Permissions Only",
    desc: "Permissions + budget.",
    variant: "rbac",
    skipFreshness: true,
  },
  full_policy: {
    label: "Full Policy",
    desc: "Permissions + freshness + budget.",
    variant: "full",
    skipFreshness: false,
  },
};

// Canonical display order for compare columns
POLICY_META.whole_corpus = { label: "Whole corpus · no filters", desc: "Every corpus fragment, without permissions, freshness or a token budget.", variant: "naive", skipFreshness: true };
POLICY_META.default = POLICY_META.full_policy;
const COMPARE_ORDER = ["naive_top_k", "permission_aware", "full_policy", "whole_corpus"];

// ── Workspace state (Fase 2) ────────────────────────────────────────────────
// Everything corpus-specific (roles, scenarios, examples, placeholders) is
// rendered from GET /workspaces/{slug}/meta. Switching workspace persists the
// slug and reloads for a clean re-bootstrap (same pattern as login).

const WORKSPACE_STORAGE_KEY = "qt_workspace";
let WORKSPACES = []; // [{slug, name, description, doc_count}]
let DEFAULT_WORKSPACE = "pe-deal";
let CURRENT_WORKSPACE = null; // slug
let WORKSPACE_META = null; // /workspaces/{slug}/meta payload

// Role maps — rebuilt per workspace from /meta ("Sees N of M docs" is
// computed server-side from metadata, never hardcoded here).
let ROLE_DESCRIPTIONS = {};
let ROLE_RANKS = {};

// Offline fallback (server unreachable): keeps the form usable so submit can
// surface the "Backend unavailable" error card instead of a dead page.
const FALLBACK_META = {
  slug: "pe-deal",
  name: "QueryTrace",
  description: "",
  total_docs: 0,
  doc_types: [],
  roles: [],
  scenarios: [],
  example_queries: [],
  search_placeholder: "Type a query…",
  empty_state_description: "",
  personas: [],
};

// Raw excerpt storage for expand/collapse — keyed by card index, avoids data-attr innerHTML
const _cardExcerpts = new Map();
const _baselineAccess = new WeakMap();

// ── Stale-state tracking (UI-B) ─────────────────────────────────────────────
// Records the (role, policy) used for the currently rendered Single result.
// When either radio diverges from these values, a stale banner is shown above
// the cards until the user retrieves evidence or generates an answer again. Cleared on: render success, mode
// switch out of single, and Single preset-button clicks.
let _lastRenderedRole = null;
let _lastRenderedPolicy = null;
let _lastRenderedQuery = null;
let _lastSingleData = null;
let _lastCompareData = null;
let _requestEpoch = 0;
let documentsLoaded = false;
let DOCUMENTS = [];
let HEALTH = {};
const can = (capability) => WORKSPACE_META?.capabilities?.[capability] ?? (
  capability === "can_upload" ? !!SESSION?.is_admin && INGEST_ENABLED === true :
  capability === "lab_enabled" ? true : !SESSION || !!SESSION.is_admin
);
function canUseRole(role) {
  return !SESSION || (SESSION.is_admin ? ROLE_RANKS[role] <= ROLE_RANKS[SESSION.role] : role === SESSION.role);
}
function selectedRole() {
  return SESSION && !SESSION.is_admin ? SESSION.role :
    document.querySelector('input[name="role"]:checked')?.value || SESSION?.role || WORKSPACE_META?.roles?.[0]?.name || "";
}
function selectedPolicy() {
  return SESSION && !SESSION.is_admin ? "full_policy" :
    document.querySelector('input[name="policy"]:checked')?.value || "full_policy";
}
function invalidateResults(message = "Context changed. Retrieve evidence with the current settings.") {
  _requestEpoch++;
  resultsSection.setAttribute("aria-busy", "false");
  compareGrid.setAttribute("aria-busy", "false");
  submitBtn.disabled = false;
  submitBtn.classList.remove("loading");
  document.getElementById("ask-btn").classList.remove("loading");
  updateAskButtonVisibility();
  _lastSingleData = _lastCompareData = null;
  _lastRenderedRole = _lastRenderedPolicy = _lastRenderedQuery = null;
  resultsSection.classList.remove("results-stale");
  resultsSection.innerHTML = `<div class="no-results" role="status">${escapeHTML(message)}</div>`;
  compareGrid.innerHTML = "";
  document.getElementById("compare-banner").hidden = true;
  if (currentMode === "compare") compareGrid.innerHTML = `<p class="no-results">${escapeHTML(message)}</p>`;
}


function buildStaleBannerHTML() {
  return `
    <div id="stale-results-banner"
         class="stale-results-banner"
         role="status"
         aria-live="polite"
         aria-atomic="true">
      <span class="stale-banner-icon" aria-hidden="true">↻</span>
      <span class="stale-banner-text">Controls changed — choose <strong>${Object.hasOwn(_lastSingleData?.data || {}, "answer") ? "Generate answer" : "Retrieve evidence"}</strong> to refresh these results.</span>
    </div>`;
}

function clearSingleStale() {
  const banner = document.getElementById("stale-results-banner");
  if (banner) banner.remove();
  resultsSection.classList.remove("results-stale");
}

function evaluateSingleStale() {
  // Gate: only relevant when a trusted Single result is on screen. Presence of
  // .summary-bar is authoritative — excludes #empty-state, skeleton, no-results,
  // and error states.
  const hasResult = resultsSection.querySelector(".summary-bar") !== null;
  if (!hasResult) {
    clearSingleStale();
    return;
  }
  const currentRole =
    document.querySelector('input[name="role"]:checked')?.value || null;
  const currentPolicy =
    document.querySelector('input[name="policy"]:checked')?.value || null;
  const matches =
    currentRole === _lastRenderedRole && currentPolicy === _lastRenderedPolicy && input.value.trim() === _lastRenderedQuery;
  if (matches) {
    clearSingleStale();
    return;
  }
  if (!document.getElementById("stale-results-banner")) {
    resultsSection.insertAdjacentHTML("afterbegin", buildStaleBannerHTML());
  }
  resultsSection.classList.add("results-stale");
}

// ── DOM references ──

const form = document.getElementById("query-form");
const input = document.getElementById("query-input");
const submitBtn = document.getElementById("submit-btn");
const resultsSection = document.getElementById("results-section");
const compareSection = document.getElementById("compare-section");
const compareGrid = document.getElementById("compare-grid");
const compareBannerText = document.getElementById("compare-banner-text");
const mainEl = document.getElementById("main");
const singlePolicySelector = document.getElementById("single-policy-selector");
const evalsSection = document.getElementById("evals-section");
const evalsContent = document.getElementById("evals-content");
const sessionAuditContent = document.getElementById("session-audit-content");
const adminSection = document.getElementById("admin-section");

// ── Mode state ──

let currentMode = "single"; // "single" | "compare" | "evals" | "admin"
let evalsLoaded = false;

// ── Session state (Fase P) ──────────────────────────────────────────────────
// SESSION is null for guests (lab mode — everything behaves as before).
// With a session, role (and policy for non-admins) derive server-side from
// the signed cookie; the UI mirrors that so controls never lie.

let SESSION = null; // {username, name, role, is_admin, workspace} | null
let INGEST_ENABLED = null; // from /health; null until probed
let ASK_ENABLED = null; // from /health; Ask mode exists only with a model key

// ── Workspace loading + rendering (Fase 2) ──────────────────────────────────

async function loadWorkspaces() {
  try {
    const res = await apiFetch(`${API_BASE}/workspaces`);
    if (!res.ok) throw new Error(`workspaces ${res.status}`);
    const data = await res.json();
    WORKSPACES = data.workspaces || [];
    DEFAULT_WORKSPACE = data.default || DEFAULT_WORKSPACE;
  } catch (_err) {
    WORKSPACES = [];
  }
}

function resolveInitialWorkspace() {
  // Session binding wins; then the persisted picker choice; then the default.
  if (SESSION?.workspace) return SESSION.workspace;
  const stored = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (stored && WORKSPACES.some((w) => w.slug === stored)) return stored;
  return DEFAULT_WORKSPACE;
}

async function loadWorkspaceMeta(slug) {
  try {
    const res = await apiFetch(`${API_BASE}/workspaces/${encodeURIComponent(slug)}/meta`);
    if (!res.ok) throw new Error(`meta ${res.status}`);
    WORKSPACE_META = await res.json();
  } catch (_err) {
    WORKSPACE_META = { ...FALLBACK_META, slug, name: slug, unavailable: true, capabilities: {lab_enabled: false} };
  }
}

function setWorkspace(slug) {
  if (!slug || slug === CURRENT_WORKSPACE) return;
  sessionStorage.setItem(WORKSPACE_STORAGE_KEY, slug);
  const proceed = () => location.reload(); // clean re-bootstrap, like login
  if (SESSION && SESSION.workspace !== slug) {
    // Sessions are bound to one workspace server-side; switching signs out
    // and lands on the new workspace's login screen.
    sessionStorage.removeItem("qt_guest");
    apiFetch(`${API_BASE}/logout`, { method: "POST" })
      .catch(() => {})
      .finally(proceed);
  } else {
    proceed();
  }
}

function renderWorkspacePickers() {
  const options = WORKSPACES.map(
    (w) =>
      `<option value="${escapeHTML(w.slug)}"${w.slug === CURRENT_WORKSPACE ? " selected" : ""}>${escapeHTML(w.name)}</option>`
  ).join("");
  [
    document.getElementById("workspace-picker"),
    document.getElementById("login-workspace-picker"),
  ].forEach((sel) => {
    if (!sel) return;
    if (WORKSPACES.length === 0) {
      sel.hidden = true;
      const label = document.querySelector(".workspace-switch-label");
      if (label) label.hidden = true;
      return;
    }
    sel.innerHTML = options;
    sel.value = CURRENT_WORKSPACE;
    sel.addEventListener("change", () => setWorkspace(sel.value));
  });
}

function onboardCardHTML(s) {
  const compare = can("can_compare");
  return `<button type="button" class="example-btn onboard-card"
    data-story="${escapeHTML(s.key || "")}" data-query="${escapeHTML(s.query || "")}" data-role="${escapeHTML(s.role || "")}" data-mode="${compare ? "compare" : "single"}">
    <span class="onboard-card-head"><span class="onboard-card-title">${escapeHTML(s.title || "")}</span><span class="onboard-card-subtitle">${escapeHTML(roleLabel(s.role))}</span></span>
    <span class="scenario-question">${escapeHTML(s.query || "")}</span>
    <span class="onboard-hint">${escapeHTML((compare ? s.compare_hint : s.hint) || "")}</span>
    <span class="scenario-action">${compare ? "Compare policies" : "Retrieve evidence"} →</span>
  </button>`;
}

function renderScenarios() {
  const scenarios = (WORKSPACE_META.scenarios || []).filter(s => canUseRole(s.role));
  document.getElementById("onboard-grid").innerHTML = scenarios.map(onboardCardHTML).join("");
  document.getElementById("scenario-picker").hidden = scenarios.length === 0;
}

function renderRoleControls() {
  const container = document.getElementById("role-options");
  if (!container) return;
  const roles = WORKSPACE_META.roles || [];
  ROLE_RANKS = {};
  ROLE_DESCRIPTIONS = {};
  roles.forEach((r) => {
    ROLE_RANKS[r.name] = r.access_rank;
    const seen = `Role allows ${r.docs_visible} of ${WORKSPACE_META.total_docs} documents`;
    ROLE_DESCRIPTIONS[r.name] = `${seen}.`;
  });
  container.innerHTML = roles
    .map(
      (r, i) => `
      <label class="role-option">
        <input type="radio" name="role" value="${escapeHTML(r.name)}"${i === 0 ? " checked" : ""} />
        <span class="role-chip">${escapeHTML(roleLabel(r.name))}</span>
      </label>`
    )
    .join("");
  container.querySelectorAll('input[name="role"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      updateRoleDescription(radio.value);
      invalidateResults("Document role changed. Choose Retrieve evidence or Compare policies for this role.");
      renderIdentityContext();
    });
  });
  updateRoleDescription(roles[0]?.name || "");
}

function roleLabel(name) {
  // Short role names render as acronyms (vp → VP); words get capitalized.
  if (!name) return "";
  if (name.length <= 3) return name.toUpperCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function renderAdminFormOptions() {
  const roleSel = document.getElementById("admin-min-role");
  const typeSel = document.getElementById("admin-doc-type");
  if (roleSel) {
    roleSel.innerHTML = (WORKSPACE_META.roles || [])
      .map((r) => `<option value="${escapeHTML(r.name)}">${escapeHTML(r.name)}</option>`)
      .join("");
  }
  if (typeSel) {
    typeSel.innerHTML = (WORKSPACE_META.doc_types || [])
      .map((t) => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`)
      .join("");
  }
}

function renderWorkspaceUI() {
  renderWorkspacePickers();
  renderRoleControls();
  renderScenarios();
  renderAdminFormOptions();

  if (input && WORKSPACE_META.search_placeholder) {
    input.placeholder = WORKSPACE_META.search_placeholder;
  }

  const loginName = document.getElementById("login-workspace-name");
  if (loginName) loginName.textContent = WORKSPACE_META.name || "";

  // Letterhead classification line (D.4) — name comes from the manifest, the
  // marking itself is generic product furniture (credible in any workspace).
  const classLine = document.getElementById("classification-line");
  if (classLine) {
    classLine.textContent = WORKSPACE_META.is_demo ? "Fictional demo corpus" : "Custom workspace";
    classLine.hidden = false;
  }
}

// Business-card personas (Fase 6 Etapa E): NAME · ROLE · CLEARANCE from the
// workspace meta (access ranks render as roman numerals — corpus-agnostic).
function romanRank(n) {
  return ["", "I", "II", "III", "IV", "V"][n] || String(n);
}

function personaCardHTML(p) {
  const initials = p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const adminBadge = p.is_admin ? '<span class="persona-admin-badge">admin</span>' : "";
  const rank = ROLE_RANKS[p.role];
  const clearance = rank ? ` · Clearance ${romanRank(rank)}` : "";
  return `
    <button class="persona-card" type="button"
            data-username="${escapeHTML(p.username)}" data-password="${escapeHTML(p.password_hint || "")}">
      <span class="persona-avatar" aria-hidden="true">${initials}</span>
      <span class="persona-body">
        <span class="persona-name">${escapeHTML(p.name)} ${adminBadge}</span>
        <span class="persona-card-line">${escapeHTML(p.role)}${escapeHTML(clearance)}</span>
        <span class="persona-role">sees ${p.docs_visible} of ${p.total_docs} docs</span>
        ${p.password_hint ? `<span class="persona-creds">${escapeHTML(p.username)} / ${escapeHTML(p.password_hint)}</span>` : ""}
      </span>
    </button>`;
}

function showLoginScreen() {
  const screen = document.getElementById("login-screen");
  const cardsEl = document.getElementById("persona-cards");
  if (!screen || !cardsEl) return;
  screen.hidden = false;
  document.getElementById("main").inert = true;
  document.querySelector(".header").inert = true;
  document.getElementById("tour-panel").inert = true;
  setTimeout(() => screen.querySelector("button:not(:disabled), select")?.focus(), 0);
  if (cardsEl.childElementCount > 0) return; // already rendered

  // Personas ship with the workspace meta (Fase 2) — no extra fetch, and the
  // cards always match the workspace shown in the picker.
  const personas = WORKSPACE_META?.personas || [];
  const introduction = screen.querySelector(".login-sub");
  if (introduction) introduction.textContent = personas.length
    ? "Choose a demo account or enter your credentials. Permissions apply within this workspace."
    : "Use an account configured for this workspace. The server enforces document permissions.";
  if (personas.length === 0) {
    cardsEl.innerHTML =
      '<p class="login-sub">No public demo accounts are configured for this workspace. Use guest laboratory mode when available, or ask the operator to configure an account.</p>';
    return;
  }
  cardsEl.innerHTML = personas.map(personaCardHTML).join("");
  cardsEl.querySelectorAll(".persona-card").forEach((card) => {
    card.addEventListener("click", async () => {
      card.disabled = true;
      try {
        const res = await apiFetch(`${API_BASE}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: card.dataset.username,
            password: card.dataset.password,
            workspace: CURRENT_WORKSPACE, // session binds to this workspace
          }),
        });
        if (!res.ok) throw new Error(`login ${res.status}`);
        sessionStorage.removeItem("qt_guest");
        location.reload(); // clean re-bootstrap with the session cookie set
      } catch (err) {
        card.disabled = false;
        cardsEl.insertAdjacentHTML(
          "beforeend",
          `<p class="login-error">Sign-in failed (${escapeHTML(String(err.message || err))}). Try again.</p>`
        );
      }
    });
  });
}

document.getElementById("guest-link")?.addEventListener("click", () => {
  sessionStorage.setItem("qt_guest", "1");
  const screen = document.getElementById("login-screen");
  if (screen) screen.hidden = true;
  document.getElementById("main").inert = false;
  document.querySelector(".header").inert = false;
  document.getElementById("tour-panel").inert = false;
  document.getElementById("guide-button")?.focus();
});

function renderSessionChip() {
  const chip = document.getElementById("session-chip");
  if (!chip) return;
  if (SESSION) {
    chip.innerHTML = `
      <span id="identity-context" class="identity-context" role="status"></span>
      <button class="chip-logout" id="logout-btn" type="button">Sign out</button>`;
    document.getElementById("logout-btn").addEventListener("click", async () => {
      try {
        await apiFetch(`${API_BASE}/logout`, { method: "POST" });
      } catch (_err) { /* cookie may already be gone */ }
      sessionStorage.removeItem("qt_guest");
      location.reload();
    });
  } else {
    chip.innerHTML =
      '<span id="identity-context" class="identity-context" role="status"></span><button class="chip-signin" id="signin-btn" type="button">Sign in</button>';
    document.getElementById("signin-btn").addEventListener("click", () => {
      sessionStorage.removeItem("qt_guest");
      showLoginScreen();
    });
  }
}

function syncRoleControlsForMode() {
  const locked = !!SESSION && !SESSION.is_admin;
  document.getElementById("role-options").hidden = locked;
  const status = document.getElementById("effective-role");
  status.hidden = !locked;
  status.textContent = locked ? `${roleLabel(SESSION.role)} · Full Policy enforced` : "";
  document.querySelectorAll('input[name="role"]').forEach((radio) => {
    radio.disabled = !canUseRole(radio.value) || locked;
    radio.closest("label").hidden = !canUseRole(radio.value);
    if (locked) radio.checked = radio.value === SESSION.role;
  });
  updateRoleDescription(selectedRole());
  renderIdentityContext();
}

function applySessionUI() {
  document.body.classList.toggle("product-mode", !!SESSION && !SESSION.is_admin);
  document.body.classList.toggle("admin-mode", !!SESSION?.is_admin);
  if (SESSION) {
    const roleRadio = Array.from(document.querySelectorAll('input[name="role"]')).find(r => r.value === SESSION.role);
    if (roleRadio) roleRadio.checked = true;
  }
  if (SESSION && !SESSION.is_admin) {
    document.querySelector('input[name="policy"][value="full_policy"]').checked = true;
    document.querySelectorAll('input[name="policy"]').forEach(r => r.disabled = true);
  }
  if (!can("can_use_unfiltered_baselines")) {
    document.querySelectorAll('input[name="policy"][value="naive_top_k"], input[name="policy"][value="whole_corpus"]').forEach(r => {
      r.disabled = true;
      r.closest("label").hidden = true;
      r.closest("label").title = "Unfiltered baselines require full document access.";
    });
  }
  const caps = { compare: "can_compare", evals: "can_view_metrics", audit: "can_view_audit", admin: "can_upload" };
  Object.entries(caps).forEach(([mode, capability]) => {
    const button = document.querySelector(`.mode-btn[data-mode="${mode}"]`);
    if (button) {
      button.hidden = !can(capability);
      button.disabled = !can(capability);
      button.title = button.disabled ? (mode === "admin" ? "Upload requires an administrator and enabled ingestion." : "Requires guest laboratory mode or an administrator with full document access.") : "";
    }
  });
  document.getElementById("tools-menu").hidden = !["can_view_metrics", "can_view_audit", "can_upload"].some(can);
  renderScenarios();
  syncRoleControlsForMode();
  updateAskButtonVisibility();
}

function renderIdentityContext() {
  const el = document.getElementById("identity-context");
  if (!el) return;
  const role = selectedRole();
  el.textContent = SESSION
    ? `Signed in: ${SESSION.name} · ${roleLabel(SESSION.role)}${SESSION.is_admin ? " · Admin" : ""}${role !== SESSION.role ? ` · Simulated ${roleLabel(role)}` : ""}`
    : `Guest · Simulated ${roleLabel(role)}`;
  el.title = SESSION ? "Authenticated identity. Document permissions are enforced by the server; admin access is separate." : "Guest laboratory: the selected role is simulated, not authenticated.";
  const guest = document.getElementById("guest-link");
  if (guest) guest.hidden = !can("lab_enabled");
}

// ── Mode toggle ──

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchMode(btn.dataset.mode);
  });
});

function switchMode(mode) {
  const button = document.querySelector(`.mode-btn[data-mode="${mode}"]`);
  if (button?.disabled || mode === currentMode) return;
  currentMode = mode;
  document.getElementById("tools-menu").open = false;
  document.querySelector("#tools-menu > summary").textContent = ["evals", "audit", "admin"].includes(mode) ? `Tools · ${button.textContent}` : "Tools";
  submitBtn.querySelector(".btn-label").textContent = mode === "compare" ? "Compare policies" : "Retrieve evidence";
  document.querySelectorAll(".mode-btn").forEach(b => {
    const active = b.dataset.mode === mode;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  const sections = { single: resultsSection, compare: compareSection, evals: evalsSection, admin: adminSection,
    documents: document.getElementById("documents-section"), audit: document.getElementById("audit-section") };
  Object.entries(sections).forEach(([name, element]) => { if (element) element.hidden = name !== mode; });
  document.querySelector(".search-section").hidden = !["single", "compare"].includes(mode);
  singlePolicySelector.hidden = mode !== "single";
  document.getElementById("whole-corpus-option").hidden = mode !== "single";
  mainEl.classList.toggle("compare-mode", mode === "compare");
  mainEl.classList.toggle("inspection-mode", !["single", "compare"].includes(mode));
  if (mode === "evals" && !evalsLoaded) runEvals();
  if (mode === "audit") fetchSessionAudit();
  if (mode === "documents" && !documentsLoaded) loadDocuments();
  if (mode === "single") evaluateSingleStale();
  syncRoleControlsForMode();
  updateAskButtonVisibility();
  playModeEnter(sections[mode]);
}

function playModeEnter(el) {
  if (!el) return;
  el.classList.remove("mode-enter");
  // Force reflow so re-adding the class restarts the animation.
  void el.offsetWidth;
  el.classList.add("mode-enter");
  const onEnd = () => {
    el.classList.remove("mode-enter");
    el.removeEventListener("animationend", onEnd);
  };
  el.addEventListener("animationend", onEnd);
}

// ── Theme toggle (Fase 6, D6.3) ──
// data-theme on <html> is the explicit user choice (persisted in localStorage
// and applied pre-paint by the boot script in index.html); without it the
// prefers-color-scheme media query decides. The attribute wins both ways.

const themeToggle = document.getElementById("theme-toggle");

function effectiveTheme() {
  const forced = document.documentElement.getAttribute("data-theme");
  if (forced === "dark" || forced === "light") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function updateThemeToggleLabel() {
  if (!themeToggle) return;
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  const label = `Switch to ${next} theme`;
  themeToggle.setAttribute("aria-label", label);
  themeToggle.title = label;
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("qt_theme", next);
    } catch (_err) {
      /* storage unavailable — the choice lasts for this page only */
    }
    updateThemeToggleLabel();
  });
  const colorSchemeMq = window.matchMedia("(prefers-color-scheme: dark)");
  if (colorSchemeMq.addEventListener) {
    colorSchemeMq.addEventListener("change", updateThemeToggleLabel);
  }
  updateThemeToggleLabel();
}

// ── Policy description + warning ──

function updatePolicyDescription(policy) {
  const descEl = document.getElementById("policy-description");
  const warningEl = document.getElementById("policy-warning");
  if (!descEl || !warningEl) return;
  const meta = POLICY_META[policy] || {};
  descEl.style.opacity = "0";
  setTimeout(() => {
    descEl.textContent = meta.desc || "";
    descEl.style.opacity = "1";
  }, 80);
  warningEl.hidden = !["naive_top_k", "whole_corpus"].includes(policy);
}

document.querySelectorAll('input[name="policy"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    updatePolicyDescription(radio.value);
    evaluateSingleStale();
  });
});

// Initialize with the default checked policy
updatePolicyDescription(
  document.querySelector('input[name="policy"]:checked')?.value || "full_policy"
);

// ── Role description (shown under the role selector) ──

function updateRoleDescription(role) {
  const descEl = document.getElementById("role-description");
  if (!descEl) return;
  descEl.textContent = ROLE_DESCRIPTIONS[role] || "";
}

// Role radios are rendered (and wired) per workspace in renderRoleControls().

// ── Bootstrap: health probe (capabilities + cold start) + session probe ──
// If /health takes more than ~2.5s (Render free tier waking up, ~45-60s),
// show a banner instead of a silent dead UI.

(async function bootstrap() {
  let coldStartBanner = null;
  const coldStartTimer = setTimeout(() => {
    coldStartBanner = document.createElement("div");
    coldStartBanner.className = "cold-start-banner";
    coldStartBanner.setAttribute("role", "status");
    coldStartBanner.textContent =
      "Connecting to QueryTrace… The server may still be starting.";
    document.body.prepend(coldStartBanner);
  }, 2500);

  try {
    const res = await apiFetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      HEALTH = data || {};
      INGEST_ENABLED = !!(data && data.ingest_enabled);
      ASK_ENABLED = !!(data && data.ask_enabled);
      updateAskButtonVisibility();
      if (data && data.default_workspace) DEFAULT_WORKSPACE = data.default_workspace;
    }
  } catch (_err) {
    // Non-fatal: offline or old server — leave capabilities at defaults.
  } finally {
    clearTimeout(coldStartTimer);
    if (coldStartBanner) coldStartBanner.remove();
  }

  // Optional session probe: null → guest (lab), without a failed network request.
  // The login screen only appears when the
  // visitor hasn't explicitly chosen the guest path this browser session.
  try {
    const res = await apiFetch(`${API_BASE}/me?optional=true`);
    if (res.ok) SESSION = await res.json();
  } catch (_err) {
    SESSION = null;
  }

  // Workspace resolution (Fase 2): session binding > stored choice > default.
  // All corpus-specific UI (roles, scenarios, examples, personas) renders
  // from the workspace meta before any session UI touches those controls.
  await loadWorkspaces();
  CURRENT_WORKSPACE = resolveInitialWorkspace();
  sessionStorage.setItem(WORKSPACE_STORAGE_KEY, CURRENT_WORKSPACE);
  await loadWorkspaceMeta(CURRENT_WORKSPACE);
  renderWorkspaceUI();

  renderSessionChip();
  applySessionUI();
  if (WORKSPACE_META.unavailable) {
    renderError(new Error("Workspace metadata is unavailable. Check the server and workspace configuration, then reload."), resultsSection);
    submitBtn.disabled = true;
  }
  initializeTour();
  if (!SESSION && !WORKSPACE_META.unavailable && !can("lab_enabled")) showLoginScreen();
})();

// ── Form submission ──

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  // With a session, the role is server-derived; the radio is just a mirror.
  const role = selectedRole();

  if (currentMode === "compare") {
    await runCompare(query, role);
  } else {
    const policy =
      SESSION && !SESSION.is_admin
        ? "full_policy"
        : document.querySelector('input[name="policy"]:checked')?.value ||
          "full_policy";
    await runSingleQuery(query, role, policy);
  }
});

input.addEventListener("input", () => {
  evaluateSingleStale();
  const note = document.getElementById("compare-input-note");
  if (note) note.hidden = input.value.trim() === _lastCompareData?.query;
});

// ── Example / scenario buttons ──
// Delegated: scenario cards and shortcut rows are re-rendered per workspace
// (Fase 2), so a document-level listener replaces per-button wiring.

document.addEventListener("click", (e) => {
  const btn = e.target.closest?.(".example-btn");
  if (btn) handleExampleClick(btn);
});

function handleExampleClick(btn) {
  if (btn.disabled) return;
  const role = btn.dataset.role || selectedRole();
  if (!canUseRole(role)) return;
  const targetMode = btn.dataset.mode || "single";
  if (targetMode === "compare" && !can("can_compare")) return;
  invalidateResults("Scenario loaded. Retrieve evidence to inspect this question with one policy.");
  document.getElementById("scenario-picker").open = false;
  input.value = btn.dataset.query || "";
  const radio = Array.from(document.querySelectorAll('input[name="role"]')).find(r => r.value === role);
  if (radio) radio.checked = true;
  updateRoleDescription(role);
  renderIdentityContext();
  if (targetMode === "single") {
    document.querySelector('input[name="policy"][value="full_policy"]').checked = true;
    updatePolicyDescription("full_policy");
  }
  switchMode(targetMode);
  if (targetMode === "compare") runCompare(input.value, selectedRole());
  else runSingleQuery(input.value, selectedRole(), "full_policy");
}

// ── Single-policy query ──

async function runSingleQuery(query, role, policy = "full_policy", settings = requestSettings()) {
  if (!form.reportValidity()) return;
  const epoch = ++_requestEpoch;
  setLoadingSingle(true);
  try {
    // Admin/lab simulations send the selected role explicitly. Ordinary
    // sessions omit role and policy; the backend derives both from the cookie.
    const body = { query, ...settings };
    if (!SESSION) {
      body.role = role;
      body.policy_name = policy;
    } else if (SESSION.is_admin) {
      body.role = role;
      body.policy_name = policy;
    }
    const res = await apiFetch(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }

    const data = await res.json();
    if (epoch !== _requestEpoch) return;
    await loadBaselineAccess(data);
    if (epoch !== _requestEpoch) return;
    renderSingleResult(data, data.decision_trace?.user_context?.role || role, data.decision_trace?.policy_config?.name || policy);
    return data;
  } catch (err) {
    if (epoch !== _requestEpoch) return;
    renderError(err, resultsSection, () => runSingleQuery(query, role, policy, settings));
  } finally {
    if (epoch === _requestEpoch) setLoadingSingle(false);
  }
}

// ── Compare query ──

async function runCompare(query, role, settings = requestSettings()) {
  if (!form.reportValidity()) return;
  const epoch = ++_requestEpoch;
  setLoadingCompare(true);
  try {
    const res = await apiFetch(`${API_BASE}/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        role,
        ...settings,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }

    const data = await res.json();
    if (epoch !== _requestEpoch) return;
    renderCompare(data);
    return data;
  } catch (err) {
    if (epoch !== _requestEpoch) return;
    renderError(err, compareGrid, () => runCompare(query, role, settings));
    compareBannerText.innerHTML = "Compare failed";
  } finally {
    if (epoch === _requestEpoch) setLoadingCompare(false);
  }
}

// ── Ask mode (Fase 4) ──
// Same request shape and session rules as /query; the response adds an
// AI answer with mechanically validated [doc_id] citations. The button is
// available only when the health probe enables the provider.

const askBtn = document.getElementById("ask-btn");

function updateAskButtonVisibility() {
  const button = document.getElementById("ask-btn");
  if (!button) return;
  button.hidden = currentMode !== "single" || ASK_ENABLED !== true;
  button.disabled = ASK_ENABLED !== true;
  button.title = ASK_ENABLED === true ? "Generate an answer using the selected context. This calls the configured model provider." : "Answer provider is disabled. Query, Compare, Documents and the guide work without a model key.";
  const hint = document.getElementById("ask-availability");
  if (hint) {
    hint.hidden = ASK_ENABLED === true || currentMode !== "single";
    hint.textContent = "Answer generation is unavailable; evidence retrieval is ready.";
  }
}

if (askBtn) {
  askBtn.addEventListener("click", async () => {
    const query = input.value.trim();
    if (!form.reportValidity() || !query || currentMode !== "single" || ASK_ENABLED !== true) return;
    const role = selectedRole();
    const policy =
      SESSION && !SESSION.is_admin
        ? "full_policy"
        : document.querySelector('input[name="policy"]:checked')?.value ||
          "full_policy";
    await runAsk(query, role, policy);
  });
}

async function runAsk(query, role, policy = "full_policy", settings = requestSettings()) {
  if (!form.reportValidity()) return;
  const epoch = ++_requestEpoch;
  setLoadingAsk(true);
  try {
    const body = { query, ...settings };
    if (!SESSION) {
      body.role = role;
      body.policy_name = policy;
    } else if (SESSION.is_admin) {
      body.role = role;
      body.policy_name = policy;
    }
    const res = await apiFetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }

    const data = await res.json();
    if (epoch !== _requestEpoch) return;
    await loadBaselineAccess(data);
    if (epoch !== _requestEpoch) return;
    // The Ask response is a superset of /query — render the normal result
    // view (cards, blocked section, trace) and put the answer panel on top.
    renderSingleResult(data, data.decision_trace?.user_context?.role || role, data.decision_trace?.policy_config?.name || policy);
    resultsSection.insertAdjacentHTML("afterbegin", buildAskPanelHTML(data));
    wireAskPanel(resultsSection);
  } catch (err) {
    if (epoch !== _requestEpoch) return;
    renderError(err, resultsSection, () => runAsk(query, role, policy, settings));
  } finally {
    if (epoch === _requestEpoch) setLoadingAsk(false);
  }
}

function setLoadingAsk(on) {
  resultsSection.setAttribute("aria-busy",String(on));
  askBtn.disabled = on || ASK_ENABLED !== true;
  askBtn.classList.toggle("loading", on);
  submitBtn.disabled = on;
  if (on) {
    document.getElementById("empty-state")?.remove();
    resultsSection.classList.remove("results-stale");
    document.getElementById("scenario-picker").open = false;
    resultsSection.innerHTML = skeletonSingleHTML();
  }
}

function buildAskPanelHTML(data) {
  const usage = data.usage || {};
  const count = new Set((data.context || []).map(d => d.doc_id)).size;
  const trimmed = data.context_trimmed;
  return `<div class="ask-panel"><div class="ask-panel-header"><h2 class="ask-panel-title">${data.model === "not_called" ? "No answer generated" : "Model-generated answer"}</h2><span class="ask-grounding">${count} documents sent · ${(data.context || []).length} fragments</span></div>
    <div class="ask-answer">${renderSafeMarkdown(data.answer || "", data.citations || [])}</div>
    <p class="ask-usage">${escapeHTML(data.model || "")} · Provider-reported usage: ${usage.input_tokens ?? 0} input / ${usage.output_tokens ?? 0} output tokens${data.cached ? " · cached response, no new model call" : ""}.</p>
    <p class="trace-explanation">${data.total_tokens ?? 0} estimated context tokens · ${trimmed ? `${((data.selected_context || []).length - (data.context || []).length)} fragments removed by the prompt cap` : "No additional context trim"}.</p>
    <p class="capability-note">Citation checks cover source IDs only. Review each claim against the cited text.</p>
    <details class="trace-method"><summary>Context accounting</summary><p>Initial selection: ${(data.selected_context || []).length} fragments / ${data.selected_total_tokens ?? 0} estimated tokens. Prompt cap: ${data.context_limit_tokens ?? "—"} tokens. The context and trace below describe what was actually sent. Provider usage includes the question and system instructions.</p>${trimmed ? '<p>Initial selection before prompt trimming: ' + escapeHTML((data.selected_context || []).map(d => d.chunk_id || d.doc_id).join(", ")) + '</p>' : ""}</details></div>`;
}

// Deliberately small Markdown renderer: all text is escaped, raw HTML is inert,
// links permit http(s) only, and citations are checked against server membership.
function renderSafeMarkdown(source, citations = []) {
  const valid = new Map(citations.map(c => [c.doc_id,c.valid]));
  function inline(text) {
    const token = /(`[^`]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|\[([a-zA-Z0-9_.-]+(?:\s*,\s*[a-zA-Z0-9_.-]+)*)\])/g;
    let result = "", cursor = 0;
    for (const match of text.matchAll(token)) {
      result += escapeHTML(text.slice(cursor,match.index));
      const raw=match[0];
      if (raw.startsWith("`")) result += `<code>${escapeHTML(raw.slice(1,-1))}</code>`;
      else if (raw.startsWith("**")) result += `<strong>${escapeHTML(raw.slice(2,-2))}</strong>`;
      else if (raw.startsWith("*")) result += `<em>${escapeHTML(raw.slice(1,-1))}</em>`;
      else if (/^\[.+\]\(https?:/.test(raw)) {
        const parts = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        result += `<a href="${escapeHTML(parts[2])}" target="_blank" rel="noopener noreferrer">${escapeHTML(parts[1])}</a>`;
      } else {
        const ids=raw.slice(1,-1).split(",").map(v=>v.trim());
        if (ids.some(id => valid.has(id) || id.startsWith("doc_"))) result += ids.map(id => valid.get(id) === true
          ? `<button type="button" class="citation-chip" data-cite="${escapeHTML(id)}" title="Identifier is in the sent context; inspect its text">${escapeHTML(id)}</button>`
          : `<span class="citation-chip citation-invalid" title="Identifier is absent from the sent context">${escapeHTML(id)} (invalid)</span>`).join(" ");
        else result += escapeHTML(raw);
      }
      cursor=match.index+raw.length;
    }
    return result+escapeHTML(text.slice(cursor));
  }
  const output=[]; let paragraph=[], list=[], listType=null, code=null;
  const flushP=()=>{ if(paragraph.length) { output.push(`<p>${inline(paragraph.join(" "))}</p>`); paragraph=[]; } };
  const flushL=()=>{ if(list.length) { output.push(`<${listType}>${list.map(line=>`<li>${inline(line)}</li>`).join("")}</${listType}>`); list=[]; listType=null; } };
  for(const line of String(source).split(/\r?\n/)) {
    if(line.startsWith("```")) { flushP();flushL(); if(code!==null) {output.push(`<pre><code>${escapeHTML(code.join("\n"))}</code></pre>`);code=null;} else code=[]; continue; }
    if(code!==null) {code.push(line);continue;}
    if(!line.trim()) {flushP();flushL();continue;}
    const heading=line.match(/^(#{1,6})\s+(.+)$/); const item=line.match(/^\s*(?:([-*+])|\d+\.)\s+(.+)$/);
    if(heading) {flushP();flushL();const level=Math.min(4,heading[1].length+1);output.push(`<h${level}>${inline(heading[2])}</h${level}>`);}
    else if(item) {flushP();const kind=item[1]?"ul":"ol";if(listType&&kind!==listType)flushL();listType=kind;list.push(item[2]);}
    else {flushL();paragraph.push(line);}
  }
  flushP();flushL();if(code!==null)output.push(`<pre><code>${escapeHTML(code.join("\n"))}</code></pre>`);
  return output.join("");
}

function wireAskPanel(container) {
  container.querySelectorAll(".citation-chip[data-cite]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const target = Array.from(container.querySelectorAll(".result-card[data-doc-id]")).find(card => card.dataset.docId === chip.dataset.cite);
      if (!target) return;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      target.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      target.classList.remove("card-highlight");
      void target.offsetWidth; // restart the highlight animation
      target.classList.add("card-highlight");
      setTimeout(() => target.classList.remove("card-highlight"), 1800);
    });
  });
}

// ── Loading states ──

function setLoadingSingle(on) {
  submitBtn.disabled = on;
  askBtn.disabled = on || ASK_ENABLED !== true;
  resultsSection.setAttribute("aria-busy",String(on));
  submitBtn.classList.toggle("loading", on);
  if (on) {
    document.getElementById("empty-state")?.remove();
    // Drop the stale-results modifier before the skeleton renders so it
    // doesn't inherit the 60% opacity applied to stale cards (UI-B).
    resultsSection.classList.remove("results-stale");
    document.getElementById("scenario-picker").open = false;
    resultsSection.innerHTML = skeletonSingleHTML();
  }
}

function setLoadingCompare(on) {
  compareGrid.setAttribute("aria-busy",String(on));
  submitBtn.disabled = on;
  submitBtn.classList.toggle("loading", on);
  if (on) {
    // UI-C: drop the Compare onboarding empty state once a comparison starts.
    document.getElementById("compare-empty-state")?.remove();
    const compareBanner = document.getElementById("compare-banner");
    if (compareBanner) compareBanner.hidden = false;
    document.getElementById("scenario-picker").open = false;
    compareGrid.innerHTML = skeletonCompareHTML();
    compareBannerText.innerHTML = "Running comparison…";
  }
}

function skeletonSingleHTML() {
  return Array.from({ length: 3 }, () => `
    <div class="skeleton-card">
      <div class="skeleton-line short"></div>
      <div class="skeleton-line long"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-line tiny"></div>
    </div>
  `).join("");
}

function skeletonCompareHTML() {
  return `
    <div class="compare-skeleton">
      ${["naive", "rbac", "full"]
        .map(
          () => `
        <div class="compare-skeleton-col">
          <div class="compare-skeleton-header"></div>
          <div class="compare-skeleton-stats"></div>
          <div class="compare-skeleton-body">
            <div class="skeleton-line short"></div>
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line tiny"></div>
          </div>
        </div>`
        )
        .join("")}
    </div>`;
}

// ── Render: single-policy result ──

// ── Chunk grouping (Fase 5 Etapa B) ──
// Context items are chunks; the UI renders one card per parent DOCUMENT:
// best-scoring chunk visible, all matched chunks available via expand.

function groupContextByDoc(context) {
  const groups = new Map();
  (context || []).forEach(item => {
    if (!groups.has(item.doc_id)) groups.set(item.doc_id, []);
    groups.get(item.doc_id).push(item);
  });
  return Array.from(groups.values()).map(chunks => {
    const ordered = [...chunks].sort((a,b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0));
    const best = chunks.reduce((a,b) => (b.score ?? 0) > (a.score ?? 0) ? b : a);
    return { ...best, matchedSections: chunks.length, totalSections: best.chunk_count ?? chunks.length,
      token_count: chunks.reduce((sum, c) => sum + (c.token_count || 0), 0),
      selectionScore: ((chunks[0].score ?? 0) + (chunks[0].freshness_score ?? 0)) / 2,
      fullContent: ordered.map(c => c.content || "").join("\n[…]\n") };
  });
}

// Group trace fragments by parent document while summing all token counts.
function groupTraceEntries(list) {
  const groups = new Map();
  (list || []).forEach(entry => {
    if (!groups.has(entry.doc_id)) groups.set(entry.doc_id, { ...entry, token_count: 0, chunk_ids: [], chunk_total: 0 });
    const group = groups.get(entry.doc_id);
    group.token_count += entry.token_count || 0;
    group.chunk_total++;
    if (entry.chunk_id) group.chunk_ids.push(entry.chunk_id);
  });
  return Array.from(groups.values());
}

function docCount(metrics, key) {
  // Prefer the doc-level counts (post-chunking traces); fall back to raw.
  return metrics?.[`${key}_doc_count`] ?? metrics?.[`${key}_count`] ?? 0;
}

async function loadBaselineAccess(data) {
  if (!data.decision_trace?.policy_config?.skip_permission_filter) return;
  try {
    const response = await apiFetch(`${API_BASE}/documents?workspace=${encodeURIComponent(CURRENT_WORKSPACE || "")}`);
    if (!response.ok) return;
    const payload = await response.json();
    const rank = ROLE_RANKS[data.decision_trace.user_context.role];
    const requirements = new Map((payload.documents || []).map(d => [d.id || d.doc_id, ROLE_RANKS[d.min_role]]));
    const docs = groupContextByDoc(data.context);
    if (!Number.isFinite(rank) || docs.some(d => !Number.isFinite(requirements.get(d.doc_id)))) return;
    _baselineAccess.set(data, new Set(docs.filter(d => requirements.get(d.doc_id) > rank).map(d => d.doc_id)));
  } catch (_) { /* Keep the unfiltered-baseline warning if metadata is unavailable. */ }
}

function renderSingleResult(data, role, policy) {
  mainEl.classList.add("has-results");
  const trace = data.decision_trace;
  role = trace?.user_context?.role || role;
  policy = trace?.policy_config?.name || policy;
  const meta = POLICY_META[policy] || { label: policy, variant: "full" };
  const metrics = trace?.metrics || {};
  const context = (data.context || []).map(chunk => ({ ...chunk,
    token_count: chunk.token_count ?? trace?.included?.find(d => (d.chunk_id || d.doc_id) === (chunk.chunk_id || chunk.doc_id))?.token_count ?? 0 }));
  const docs = groupContextByDoc(context);
  const isAsk = Object.hasOwn(data, "answer");
  const header = `<div class="result-heading"><p class="eyebrow">${isAsk ? "Context sent to the answer provider" : "Context only · no answer generated"}</p>
    <h2 id="executed-query">${escapeHTML(data.query)}</h2>
    <p class="result-provenance">${escapeHTML(WORKSPACE_META?.name || CURRENT_WORKSPACE)} · ${escapeHTML(SESSION?.name || "Guest laboratory")} · Effective document role: <strong>${escapeHTML(roleLabel(role))}</strong></p></div>`;
  const fields = [ ["Policy", meta.label], ["Documents", docs.length], ["Fragments", context.length],
    ["Context tokens (est.)", data.total_tokens ?? 0], ["Budget", trace?.policy_config?.skip_budget ? "Not applied" : `${trace?.policy_config?.token_budget ?? "—"} tokens`] ];
  const summary = `<div class="summary-bar">${fields.map(([label,value]) => `<div class="memo-field"><span class="memo-label">${escapeHTML(label)}</span><span class="memo-value">${escapeHTML(value)}</span></div>`).join("")}
    <button class="export-btn" id="export-single" type="button">Export JSON</button></div>`;
  const staleMap = new Map((trace?.demoted_as_stale || []).map(d => [d.doc_id,d]));
  const empty = docs.length ? "" : emptyResultHTML(data);
  const traceHTML = trace ? buildTracePanelHTML(trace, docs.length === 0, role) : "";
  const cards = docs.map((doc,i) => singleCardHTML(doc,i,policy,staleMap,trace,_baselineAccess.get(data)?.has(doc.doc_id))).join("");
  const outcome = `<p class="context-outcome${trace?.policy_config?.skip_permission_filter ? " outcome-warning" : ""}">${trace?.policy_config?.skip_permission_filter ? `Unfiltered baseline: permissions and budget were not checked.${_baselineAccess.has(data) ? ` ${_baselineAccess.get(data).size} included documents are outside this role’s access.` : ""}` : `${docCount(metrics, "blocked")} documents blocked · ${metrics.dropped_count ?? 0} fragments excluded · permissions enforced`}</p>`;
  resultsSection.innerHTML = header + summary + outcome + empty + traceHTML + (docs.length ? '<h3 class="section-heading">Included documents</h3>' : "") + cards;
  wireTraceToggles(resultsSection);
  wireExpandButtons(resultsSection);
  animateBars(resultsSection);
  resultsSection.querySelector("#export-single")?.addEventListener("click", () => downloadJSON(data, `querytrace_${CURRENT_WORKSPACE}_${role}_${policy}.json`));
  _lastRenderedRole = role;
  _lastRenderedPolicy = policy;
  _lastRenderedQuery = data.query;
  _lastSingleData = { data, role, policy };
  evaluateSingleStale();
}

function emptyResultHTML(data) {
  const trace = data.decision_trace || {};
  const status = trace.result_status || data.result_status || (
    trace.metrics?.blocked_count > 0 ? "blocked_by_permissions" : trace.metrics?.dropped_count > 0 ? "budget_exhausted" : "insufficient_evidence");
  const messages = {
    empty_corpus: ["This corpus is empty", "Add documents using Upload with an administrator, or choose a populated workspace."],
    insufficient_evidence: ["Insufficient relevant evidence", "Try a more specific question about this corpus. Inspect Documents to see its scope."],
    blocked_by_permissions: ["Relevant candidates were blocked by permissions", "The trace explains the access requirements. Use an authorized account; changing the query does not grant access."],
    budget_exhausted: ["No fragment fits the context budget", "The trace retains the candidates and their token costs. Use a narrower question or review the configured budget."],
  };
  const [title,detail] = messages[status] || ["No context selected", "Inspect the decision trace for the final outcome of each candidate."];
  return `<div class="no-results" data-result-status="${escapeHTML(status)}" role="status"><h3>${title}</h3><p>${detail}</p></div>`;
}

// ── Render: single result card ──

function singleCardHTML(chunk, index, policy, staleMap = new Map(), trace = {}, unauthorized = false) {
  const score = chunk.score ?? 0;
  const freshness = chunk.freshness_score ?? 0;
  const scorePct = Math.round(score * 100);
  const freshPct = Math.round(freshness * 100);
  const skipFreshness = (POLICY_META[policy] || {}).skipFreshness === true;

  const tagsHTML = (chunk.tags || [])
    .map((t) => `<span class="tag">${escapeHTML(t)}</span>`)
    .join("");

  const title = chunk.title || chunk.doc_id;
  const docTypeLabel = formatDocType(chunk.doc_type);
  const dateLabel = formatDate(chunk.date);
  // Sections badge (Fase 5 Etapa B): how many of the doc's chunks matched
  const matched = chunk.matchedSections ?? 1;
  const totalSections = chunk.totalSections ?? chunk.chunk_count ?? 1;
  const sectionsLabel = totalSections > 1
    ? `${matched < totalSections ? "Partial inclusion · " : ""}${matched} of ${totalSections} fragments included`
    : null;
  const metaParts = [
    `<span class="card-meta-badge">REF: ${escapeHTML(chunk.doc_id)}</span>`,
    `${chunk.token_count ?? 0} estimated tokens`,
    docTypeLabel ? escapeHTML(docTypeLabel) : null,
    dateLabel ? escapeHTML(dateLabel) : null,
    sectionsLabel
      ? `<span class="card-sections-badge" title="The document is indexed as ${totalSections} chunks; ${matched} made it into this context">${escapeHTML(sectionsLabel)}</span>`
      : null,
  ].filter(Boolean).join(" · ");

  // Staleness detection: prefer chunk.superseded_by (IDEA 2), fall back to trace staleMap
  const staleInfo = staleMap.get(chunk.doc_id);
  const supersededBy = chunk.superseded_by || staleInfo?.superseded_by || null;
  const isSuperseded = supersededBy != null;
  const penaltyLabel = staleInfo?.penalty_applied != null
    ? `${staleInfo.penalty_applied}×`
    : "0.5×";

  const staleHTML = isSuperseded ? `
    <div class="stale-badge">
      <span class="stamp stamp-superseded" aria-hidden="true">Superseded</span>
      <span class="stale-text">Superseded by <strong>${escapeHTML(supersededBy)}</strong>${skipFreshness ? " · this policy applies no freshness penalty" : staleInfo ? ` · freshness multiplier ${escapeHTML(penaltyLabel)}` : ""}</span>
    </div>` : "";

  const rawShort = (chunk.content || "").slice(0, 300);
  // Expand shows every matched chunk of the doc, joined with […] separators
  const rawFull = chunk.fullContent || chunk.content || "";
  const hasMore = rawFull.length > 300;
  _cardExcerpts.set(index, { short: rawShort, full: rawFull });

  const freshnessMetricHTML = skipFreshness
    ? `<div class="metric">
        <div class="metric-label">Freshness</div>
        <span class="metric-na">N/A — skipped by policy</span>
       </div>`
    : `<div class="metric">
        <div class="metric-label">Freshness</div>
        <div class="metric-bar-container">
          <div class="metric-bar">
            <div class="metric-bar-fill freshness" style="width: 0%" data-w="${freshPct}"></div>
          </div>
          <span class="metric-value">${freshness.toFixed(2)}</span>
        </div>
       </div>`;

  return `
    <article class="result-card" data-card-idx="${index}" data-doc-id="${escapeHTML(chunk.doc_id)}" style="animation-delay: ${index * 50}ms">
      <div class="card-header">
        <h4 class="card-title">${escapeHTML(title)}</h4>
        <span class="card-folio">Exhibit ${String(index + 1).padStart(2, "0")}</span>
      </div>
      <div class="card-meta">${metaParts}</div>
      ${unauthorized ? '<p class="doc-flag flag-blocked">Outside this role’s access · included by the unfiltered baseline</p>' : ""}
      ${staleHTML}
      <div class="card-content">
        <p class="card-content-text">${escapeHTML(rawShort)}</p>
      </div>
      ${hasMore ? `<button class="card-expand-btn" type="button" aria-expanded="false">Read source</button>` : ""}

      <details class="result-details"><summary>Ranking, freshness &amp; tags</summary>
      <p class="ranking-note">Selection priority: <strong>${chunk.selectionScore.toFixed(3)}</strong>. Fragments are packed by a 50/50 blend of relative rank and freshness${skipFreshness ? " (fixed at 0 for this policy)" : ""}, then grouped by document. This is not confidence. Scores below describe this document’s highest-ranked included fragment.</p>
      <div class="card-metrics">
        <div class="metric">
          <div class="metric-label" title="Relative ranking score, not a probability of relevance">Relative rank score</div>
          <div class="metric-bar-container">
            <div class="metric-bar">
              <div class="metric-bar-fill relevance" style="width: 0%" data-w="${scorePct}"></div>
            </div>
            <span class="metric-value">${score.toFixed(3)}</span>
          </div>
        </div>
        ${freshnessMetricHTML}
      </div>
      ${tagsHTML ? `<div class="card-tags">${tagsHTML}</div>` : ""}
      </details>
    </article>`;
}

// ── Render: compare view ──

function renderCompare(data) {
  mainEl.classList.add("has-results");
  _lastCompareData = data;
  compareBannerText.innerHTML = `<span class="eyebrow">Context comparison</span><strong>${escapeHTML(data.query)}</strong><span>${escapeHTML(roleLabel(data.role))} · k=${data.results?.naive_top_k?.decision_trace?.policy_config?.top_k ?? selectedTopK()}</span><details class="compare-accounting-note"><summary>How counts work</summary>Document groups can overlap when fragments have different outcomes. Decision Trace reconciles the fragment counts.</details><span id="compare-input-note" class="scenario-limit" hidden>Input changed. These results still describe the query above.</span>`;

  // Build cross-policy highlights: which doc_ids are blocked or dropped in full_policy?
  const fullResult = data.results["full_policy"];
  const blockedInFull = new Set(
    (fullResult?.decision_trace?.blocked_by_permission || []).map((b) => b.doc_id)
  );
  const exposed = groupContextByDoc(data.results.naive_top_k?.context).filter(doc => blockedInFull.has(doc.doc_id));
  compareBannerText.insertAdjacentHTML("beforeend", `<p class="comparison-finding">${exposed.length
    ? `<strong>Top-k includes ${exposed.length} document${exposed.length === 1 ? "" : "s"} this role cannot access.</strong> Full Policy blocks them.<br><span>${exposed.map(doc => escapeHTML(doc.title || doc.doc_id)).join(" · ")}</span>`
    : "No permission difference in the selected Top-k context for this query and role."}</p>`);

  const columns = COMPARE_ORDER.filter((p) => data.results[p]);

  compareBannerText.insertAdjacentHTML("beforeend", `<div class="comparison-overview" role="region" aria-label="Policy outcomes" tabindex="0"><table>
    <caption>Policy outcomes · document counts</caption><thead><tr><th scope="col">Policy</th><th scope="col">Included</th><th scope="col">Blocked</th><th scope="col">Penalized</th></tr></thead>
    <tbody>${columns.map(p => { const r = data.results[p]; return `<tr><th scope="row">${escapeHTML(POLICY_META[p]?.label || p)}</th><td>${groupContextByDoc(r.context).length}</td><td>${docCount(r.decision_trace?.metrics, "blocked")}</td><td>${docCount(r.decision_trace?.metrics, "stale")}</td></tr>`; }).join("")}</tbody></table></div>`);

  compareGrid.innerHTML = columns
    .map((policyName, colIdx) =>
      buildCompareColumnHTML(
        policyName,
        data.results[policyName],
        { blockedInFull },
        colIdx,
        data.role
      )
    )
    .join("");

  // Wire all trace toggles in the compare grid
  wireTraceToggles(compareGrid);
  animateBars(compareGrid);

  // Append (or replace) the Export JSON button in the compare banner.
  const compareBanner = document.getElementById("compare-banner");
  if (compareBanner) {
    compareBanner
      .querySelectorAll(".export-btn")
      .forEach((b) => b.remove());
    const btn = document.createElement("button");
    btn.className = "export-btn";
    btn.id = "export-compare";
    btn.type = "button";
    btn.setAttribute("aria-label", "Download the full comparison as JSON");
    btn.title = "Download full /compare response as JSON";
    btn.innerHTML =
      `${uiIcon('download')}<span class="export-btn-label">Export JSON</span>`;
    btn.addEventListener("click", () => {
      downloadJSON(data, `querytrace_compare_${data.role}.json`);
    });
    compareBanner.appendChild(btn);
  }
}

// ── Build compare column HTML ──

function buildCompareColumnHTML(policyName, result, highlights, colIdx, userRole) {
  const meta = POLICY_META[policyName] || {
    label: policyName.toUpperCase(),
    desc: "",
    variant: "unknown",
    skipFreshness: false,
  };
  const trace = result.decision_trace;
  const metrics = trace?.metrics;

  // Stats cells — doc-level counts (chunk entries deduped to parent docs)
  const groupedDocs = groupContextByDoc(result.context);
  const blockedVal = docCount(metrics, "blocked");
  const staleVal = docCount(metrics, "stale");
  const droppedVal = metrics?.dropped_count ?? 0;
  const ttftMs = trace ? Math.round(trace.ttft_proxy_ms) : "—";

  const statsHTML = `
    <div class="col-stats">
      <div class="col-stat">
        <span class="col-stat-val">${groupedDocs.length}</span>
        <span class="col-stat-lbl">docs included</span>
      </div>
      <div class="col-stat">
        <span class="col-stat-val">${result.total_tokens.toLocaleString()}</span>
        <span class="col-stat-lbl">Estimated tokens</span>
      </div>
      <div class="col-stat stat-blocked">
        <span class="col-stat-val${blockedVal === 0 ? " zero" : ""}">${blockedVal}</span>
        <span class="col-stat-lbl">docs blocked</span>
      </div>
      <div class="col-stat stat-stale">
        <span class="col-stat-val${staleVal === 0 ? " zero" : ""}">${staleVal}</span>
        <span class="col-stat-lbl">docs penalized</span>
      </div>
      <div class="col-stat stat-dropped">
        <span class="col-stat-val${droppedVal === 0 ? " zero" : ""}">${droppedVal}</span>
        <span class="col-stat-lbl">fragments excluded</span>
      </div>
      <div class="col-stat">
        <span class="col-stat-val">${ttftMs}ms</span>
        <span class="col-stat-lbl">latency proxy</span>
      </div>
    </div>`;

  // Document cards — one per parent doc (chunks grouped)
  const docsHTML =
    groupedDocs.length > 0
      ? groupedDocs
          .map((doc, i) => {
            const wouldBeBlocked =
              policyName === "naive_top_k" &&
              highlights.blockedInFull.has(doc.doc_id);
            return buildCompareCardHTML(doc, i, wouldBeBlocked, policyName);
          })
          .join("")
      : emptyResultHTML(result);

  // Keep decisions discoverable above cards; empty outcomes open their explanation.
  const traceHTML = trace
    ? `<div class="col-trace">${buildTracePanelHTML(trace, groupedDocs.length === 0, userRole, true)}</div>`
    : "";

  const leaked = groupedDocs.filter(doc => highlights.blockedInFull.has(doc.doc_id)).length;
  const verdictHTML = policyName === "naive_top_k" && leaked > 0
    ? `<p class="comparison-warning">${leaked} unauthorized document${leaked === 1 ? "" : "s"} included</p>` : "";

  return `
    <div class="compare-col" data-policy="${escapeHTML(policyName)}" style="animation-delay: ${colIdx * 60}ms">
      <div class="col-header col-header-${meta.variant}">
        <h3 class="col-badge col-badge-${meta.variant}">${escapeHTML(meta.label)}</h3>
        <div class="col-policy-info">
          <span class="col-policy-name">${escapeHTML(policyName)}</span>
          <span class="col-policy-desc">${escapeHTML(meta.desc)}</span>
        </div>
        ${verdictHTML}
      </div>
      ${statsHTML}
      <details class="baseline-definition"><summary>Selection limits</summary><p>${escapeHTML(baselineDescription(trace))}</p></details>
      ${traceHTML}
      <div class="col-docs">${docsHTML}</div>
    </div>`;
}

// ── Build compact compare card ──

function buildCompareCardHTML(doc, index, wouldBeBlocked, policyName) {
  const score = doc.score ?? 0;
  const freshness = doc.freshness_score ?? 0;
  const scorePct = Math.min(100, Math.round(score * 100));
  const freshPct = Math.min(100, Math.round(freshness * 100));
  const skipFreshness = (POLICY_META[policyName] || {}).skipFreshness === true;

  const flagHTML = wouldBeBlocked
    ? `<span class="doc-flag flag-blocked">Included here · blocked by Full Policy</span>`
    : "";

  const compareStaleHTML = doc.superseded_by
    ? `<span class="compare-stale-badge" title="Superseded by ${escapeHTML(doc.superseded_by)}">Superseded</span>`
    : "";

  const compareTitle = doc.title || doc.doc_id;
  const docTypeLabel = formatDocType(doc.doc_type);
  const dateLabel = formatDate(doc.date);
  const compareSections = (doc.totalSections ?? 1) > 1
    ? `${doc.matchedSections ?? 1}/${doc.totalSections} fragments included`
    : null;
  const compareMetaParts = [
    `<span class="card-meta-badge">REF: ${escapeHTML(doc.doc_id)}</span>`,
    compareSections ? escapeHTML(compareSections) : null,
  ].filter(Boolean).join(" · ");

  const contentSnippet = escapeHTML((doc.content || "").slice(0, 120));

  const freshnessHTML = skipFreshness
    ? `<div class="mini-metric"><span class="mini-na">freshness N/A</span></div>`
    : `<div class="mini-metric">
        <span class="mini-bar-wrap">
          <span class="mini-bar" style="width: 0%; background: var(--fresh-high)" data-w="${freshPct}"></span>
        </span>
        <span class="mini-val">${freshness.toFixed(2)}</span>
       </div>`;

  return `
    <article class="compare-card" data-doc-id="${escapeHTML(doc.doc_id)}" style="animation-delay: ${index * 35}ms">
      <p class="source-policy">${escapeHTML(POLICY_META[policyName]?.label || policyName)}</p>
      <div class="compare-card-header">
        <h4 class="compare-card-title">${escapeHTML(compareTitle)}</h4>
        ${flagHTML}
      </div>
      <div class="card-meta compare-card-meta">${compareMetaParts}</div>
      ${compareStaleHTML}
      <p class="compare-card-content">${contentSnippet}</p>
      <details class="compare-source"><summary>Read selected fragments</summary>
        <p class="capability-note">${doc.matchedSections} of ${doc.totalSections} fragments included by ${escapeHTML(POLICY_META[policyName]?.label || policyName)}.</p>
        <div class="document-text" tabindex="0" role="region" aria-label="Selected fragments: ${escapeHTML(compareTitle)} · ${escapeHTML(POLICY_META[policyName]?.label || policyName)}">${escapeHTML(doc.fullContent || doc.content || "")}</div>
      </details>
      <details class="result-details"><summary>Ranking &amp; freshness</summary><p class="card-meta">${escapeHTML(docTypeLabel)} · ${escapeHTML(dateLabel)}</p><p class="ranking-note">Selection priority ${doc.selectionScore.toFixed(3)}: 50% relative rank + 50% freshness${skipFreshness ? " (fixed at 0)" : ""}. Order follows the first included fragment; scores below describe the highest-ranked included fragment. Not confidence.</p><div class="compare-card-scores">
        <div class="mini-metric">
          <span class="mini-bar-wrap">
            <span class="mini-bar" style="width: 0%; background: var(--score-high)" data-w="${scorePct}"></span>
          </span>
          <span class="mini-val" title="Relative rank score; not confidence">rank ${score.toFixed(3)}</span>
        </div>
        ${freshnessHTML}
      </div></details>
    </article>`;
}

// ── Render: blocked documents section (single mode) ──

function buildWithheldStripHTML(summary) {
  if (!summary || summary.count === 0) return "";
  const req = summary.required_roles || [];
  const minReq = req.length
    ? req.reduce((a, b) => ((ROLE_RANKS[a] || 9) <= (ROLE_RANKS[b] || 9) ? a : b))
    : null;
  const reqLabel = minReq ? `requires ${escapeHTML(minReq)}+` : "requires higher clearance";
  const myRole = SESSION?.role || "guest";
  const myRank = ROLE_RANKS[myRole] ?? "?";
  const reqDetail = [...req]
    .sort((a, b) => (ROLE_RANKS[a] || 9) - (ROLE_RANKS[b] || 9))
    .map((r) => `${escapeHTML(r)} (${ROLE_RANKS[r] ?? "?"})`)
    .join(", ");
  const plural = summary.count === 1 ? "document" : "documents";
  return `
    <div class="withheld-strip" role="note">
      ${uiIcon('lock')}
      <span class="withheld-text">${summary.count} ${plural} withheld · ${reqLabel}</span>
      <details class="withheld-why">
        <summary>Why?</summary>
        <div class="withheld-why-body">
          Your role: <strong>${escapeHTML(myRole)} (${myRank})</strong> &lt; required:
          <strong>${reqDetail}</strong>. Access is enforced server-side — the withheld
          titles were never sent to your browser.
        </div>
      </details>
    </div>`;
}

function buildBlockedSectionHTML(blockedRaw, userRole) {
  // Entries are per-chunk since Fase 5 Etapa B — dedupe to parent docs
  const blocked = groupTraceEntries(blockedRaw);
  if (!blocked || blocked.length === 0) return "";

  const count = blocked.length;
  const headerLabel = `${count} document${count === 1 ? "" : "s"} blocked by permissions`;

  const cardsHTML = blocked
    .map((b) => {
      const title = b.title || b.doc_id;
      const typeLabel = formatDocType(b.doc_type);
      const reason = b.reason === "unknown_min_role"
        ? `Unknown role requirement: <strong>${escapeHTML(b.required_role)}</strong>`
        : `Requires <strong>${escapeHTML(b.required_role)}</strong> role — you are <strong>${escapeHTML(userRole || b.user_role)}</strong>`;

      const metaParts = [
        `<span class="card-meta-badge">REF: ${escapeHTML(b.doc_id)}</span>`,
        typeLabel ? escapeHTML(typeLabel) : null,
      ].filter(Boolean).join(" · ");

      return `
        <div class="blocked-card">
          <span class="stamp stamp-blocked" aria-hidden="true">Blocked</span>
          <div class="blocked-card-title">${escapeHTML(title)}</div>
          <div class="card-meta blocked-card-meta">${metaParts}</div>
          <div class="blocked-card-reason">${reason}</div>
        </div>`;
    })
    .join("");

  return `
    <section class="blocked-section" aria-label="Documents blocked by permissions">
      <button class="blocked-header" type="button" aria-expanded="false">
        ${uiIcon('lock')}
        <span class="blocked-header-label">${escapeHTML(headerLabel)}</span>
        <span class="blocked-caret">${uiIcon('chevron')}</span>
      </button>
      <div class="blocked-body">
        <div class="blocked-body-inner">${cardsHTML}</div>
      </div>
    </section>`;
}

function wireBlockedSectionToggle(container) {
  container.querySelectorAll(".blocked-section").forEach((section) => {
    const btn = section.querySelector(".blocked-header");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const isOpen = section.classList.toggle("open");
      btn.setAttribute("aria-expanded", isOpen);
    });
  });
}

// ── Evals dashboard ──

async function runEvals() {
  evalsContent.innerHTML = skeletonEvalsHTML();
  try {
    const res = await apiFetch(
      `${API_BASE}/evals?workspace=${encodeURIComponent(CURRENT_WORKSPACE || "")}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }
    const data = await res.json();
    evalsLoaded = true;
    renderEvals(data);
  } catch (err) {
    renderError(err, evalsContent);
  }
}

function skeletonEvalsHTML() {
  return `
    <div class="evals-loading">
      <div class="evals-loading-spinner"></div>
      <p class="evals-loading-text">Running the benchmark queries…</p>
    </div>`;
}

// Completion and coverage are independent of permission metrics.
function buildEvaluationStatusHTML(agg, status = "not_run") {
  const completed = agg.queries_completed ?? agg.queries_run ?? 0;
  const total = agg.queries_total ?? completed + (agg.queries_failed ?? 0);
  const rate = agg.permission_violation_rate;
  const statusLabel = { complete: "Complete", incomplete: "Incomplete", failed: "Failed", not_run: "Not run", unavailable: "Unavailable" }[status] || status;
  return `<div class="evaluation-status" data-evaluation-status="${escapeHTML(status)}" role="status"><h3>Evaluation: ${escapeHTML(statusLabel)}</h3><p>${completed} / ${total} queries completed · ${agg.queries_attempted ?? total} attempted · ${agg.queries_failed ?? 0} failed · ${agg.queries_skipped ?? 0} skipped.</p><p>${completed && rate != null ? `${fmtPct(rate)} of completed queries returned unauthorized documents.` : "No permission metric is available without completed queries."} ${status !== "complete" ? "This is not a complete evaluation." : "This benchmark only; not a certification."}</p></div>`;
}

function renderEvals(data) {
  const agg = data.aggregate || {};
  const queries = data.per_query || [];
  const completed = agg.queries_completed ?? agg.queries_run ?? 0;
  const failed = agg.queries_failed ?? 0;
  const status = data.status || agg.status || (failed ? (completed ? "incomplete" : "failed") : completed ? "complete" : "not_run");
  const value = (v,n=2) => v == null || completed === 0 ? "—" : Number(v).toFixed(n);
  const metrics = [
    ["Precision@5", value(agg.avg_precision_at_5), "Relevant unique documents among the first 5 returned results, divided by the smaller of 5 and the number of unique returned documents."],
    ["Recall", value(agg.avg_recall), "Expected relevant documents found, divided by expected relevant documents."],
    ["Unauthorized document occurrences", completed && agg.permission_document_violation_rate != null ? fmtPct(agg.permission_document_violation_rate) : "—", `${agg.permission_violation_documents ?? "—"} unauthorized / ${agg.returned_documents ?? "—"} returned document occurrences; each document is counted once per completed query.`],
    ["Unauthorized fragments", completed && agg.permission_chunk_violation_rate != null ? fmtPct(agg.permission_chunk_violation_rate) : "—", `${agg.permission_violation_chunks ?? "—"} unauthorized / ${agg.returned_chunks ?? "—"} returned fragment occurrences across completed queries.`],
    ["Average freshness", data.policy?.skip_freshness ? "Not applied" : value(agg.avg_freshness_score), "Mean freshness of included fragments, using the corpus reference date; not a quality or truth score."],
    ["Average budget utilization", data.policy?.skip_budget ? "Not applied" : completed && agg.avg_budget_utilization != null ? fmtPct(agg.avg_budget_utilization) : "—", "Estimated selected context tokens divided by the applied selection budget."],
    ["Documents / query", value(agg.avg_context_docs,1), "Average unique documents in completed queries."],
    ["Estimated context tokens / query", value(agg.avg_total_tokens,0), "Local token estimate for the final selected context."],
    ["Blocked documents / query", value(agg.avg_blocked_count,1), "Average unique documents with fragments blocked by permissions."],
    ["Penalized documents / query", value(agg.avg_stale_count,1), "Superseded candidate documents penalized before final selection."],
    ["Excluded documents / query", value(agg.avg_dropped_count,1), "Documents with fragments excluded by evidence or selection limits; may also be partially included."],
  ];
  evalsContent.innerHTML = `<h3 class="section-heading">${escapeHTML(POLICY_META[data.policy_name]?.label || data.policy_name || "Full Policy")} benchmark</h3><p class="trace-explanation">Retrieval against expected-document lists; not answer quality. <button type="button" class="text-button" id="evals-compare">Compare policies on a question</button>.</p>` + buildEvaluationStatusHTML(agg,status) +
    (data.message || data.reason ? `<p class="trace-explanation">${escapeHTML(data.message || data.reason)}</p>` : "") +
    `<p class="trace-explanation">Workspace: ${escapeHTML(WORKSPACE_META?.name || CURRENT_WORKSPACE)}. Policy: ${escapeHTML(POLICY_META[data.policy_name]?.label || data.policy_name || "Full Policy")}. Metrics use completed queries only.</p>` +
    (completed ? `<div class="evals-table-wrap" tabindex="0" role="region" aria-label="Aggregate evaluation metrics"><table class="evals-table metrics-table"><tbody>${metrics.map(([label,v,note]) => `<tr><th>${escapeHTML(label)}</th><td class="metrics-value">${v}</td><td class="metrics-note"><details><summary>Definition</summary>${note}</details></td></tr>`).join("")}</tbody></table></div>` : "") +
    (queries.length ? `<h3 class="section-heading">Benchmark queries</h3><div class="evals-table-wrap" tabindex="0" role="region" aria-label="Benchmark query results"><table class="evals-table"><thead><tr><th>Executed query</th><th>Role</th><th>Status</th><th>P@5</th><th>Recall</th><th>Documents</th><th>Tokens</th><th>Unauthorized documents</th></tr></thead><tbody>${queries.map(q => `<tr><td class="evals-query-cell"><strong>${escapeHTML(q.id || "")}</strong> ${escapeHTML(q.query || "")}</td><td>${escapeHTML(q.role || "")}</td><td>${escapeHTML(q.error ? `Failed: ${q.error}` : (q.status === "skipped" ? `Skipped: ${q.reason || "configured skip"}` : q.status || "complete"))}</td><td>${(q.error || q.status === "skipped") ? "—" : value(q.precision_at_5)}</td><td>${(q.error || q.status === "skipped") ? "—" : value(q.recall)}</td><td>${(q.error || q.status === "skipped") ? "—" : q.context_docs ?? "—"}</td><td>${(q.error || q.status === "skipped") ? "—" : q.total_tokens ?? "—"}</td><td>${(q.error || q.status === "skipped") ? "Not evaluated" : escapeHTML((q.permission_violations || []).join(", ") || "none")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="no-results">${status === "unavailable" ? "No evaluation set is configured. Query and Documents remain available for this corpus." : "No evaluation queries have completed."}</p>`) +
    `<details class="evaluation-provenance"><summary>Run provenance and metric definitions</summary><p>Precision counts only documents in this workspace’s expected-document lists. It does not measure answer quality. Failed and skipped queries are excluded from metric averages and remain visible in the completion denominator.</p><p>Run: ${escapeHTML(data.run_id || "Not recorded")} · ${escapeHTML(data.generated_at || "")}</p><p>Corpus fingerprint: ${escapeHTML(data.corpus_fingerprint || "Not recorded")}</p><dl>${Object.entries(data.metric_definitions || {}).map(([label,definition]) => `<dt>${escapeHTML(label.replace(/_/g," "))}</dt><dd>${escapeHTML(definition)}</dd>`).join("")}</dl></details>` +
    '<button type="button" class="export-btn" id="export-evals">Export evaluation JSON</button>';
  document.getElementById("evals-compare").addEventListener("click", () => { switchMode("compare"); input.focus(); });
  document.getElementById("export-evals").addEventListener("click", () => downloadJSON(data,`querytrace_${CURRENT_WORKSPACE}_evaluation.json`));
}

// Budget cell with an inline fill bar (F.2) — animated by animateBars (A.7)
function budgetCellHTML(utilization) {
  const pct = Math.min(100, Math.round((utilization ?? 0) * 100));
  return `
    <td class="mono-cell evals-budget-cell">
      <span class="budget-cell-bar" aria-hidden="true"><span class="mini-bar" style="width: 0%; background: var(--status-info)" data-w="${pct}"></span></span>${fmtPct(utilization ?? 0)}
    </td>`;
}

// ── Narrative banner for Evals (IDEA 6) ──

function buildEvalsNarrative(agg) {
  return `<p class="trace-explanation">Metrics describe ${agg.queries_completed ?? agg.queries_run ?? 0} completed benchmark queries. They do not establish safety beyond this evaluation set.</p>`;
}

function fmtPct(v) {
  return (v * 100).toFixed(1) + "%";
}

const _copyTexts = [];

function copyBtnHTML(text) {
  const idx = _copyTexts.length;
  _copyTexts.push(text);
  return `<button class="copy-query-btn" data-copy-idx="${idx}" title="Copy query">⎘</button>`;
}

function wireCopyButtons(container) {
  container.querySelectorAll(".copy-query-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = _copyTexts[Number(btn.dataset.copyIdx)] ?? "";
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "✓";
        setTimeout(() => { btn.textContent = "⎘"; }, 1200);
      }).catch(() => {});
    });
  });
}

// ── Session Audit (MET-B) ──

async function fetchSessionAudit() {
  try {
    const res = await apiFetch(`${API_BASE}/session-audit?workspace=${encodeURIComponent(CURRENT_WORKSPACE || "")}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    renderSessionAudit(data);
  } catch (err) {
    sessionAuditContent.innerHTML = `<div class="session-audit-section">
      <h3 class="evals-section-label">Session Audit</h3>
      <p class="session-audit-error">Failed to load session audit: ${escapeHTML(err.message)}</p>
    </div>`;
  }
}

function fmtRelativeTime(isoStr) {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffS = Math.max(0, Math.floor((now - then) / 1000));
  if (diffS < 60) return `${diffS}s ago`;
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function renderSessionAudit(data) {
  const entries = data.entries || [];
  const scopes = { workspace_authenticated_and_lab: "Administrator view of authenticated and public laboratory executions", workspace_public_lab: "Public guest laboratory executions only" };
  const scope = scopes[data.scope] || data.scope || "Authorized executions";
  const rows = entries.map(entry => {
    const metrics = entry.metrics || {};
    const execution = entry.execution || {};
    const docs = entry.doc_ids || {};
    const identity = execution.identity || entry.username || entry.user || "Guest laboratory";
    const kind = { query: "Query", compare: "Compare", ask: "Ask" }[entry.kind] || entry.kind || "Query";
    const status = entry.status === "failed" ? "Failed" : "Complete";
    const parameterDetails = `<details><summary>Parameters and decisions</summary><dl class="audit-parameters"><dt>Candidate setting k</dt><dd>${execution.top_k ?? entry.top_k ?? "—"}</dd><dt>Applied token budget</dt><dd>${execution.budget_applied === false ? "Not applied by this policy" : execution.token_budget ?? "—"}</dd><dt>Corpus version</dt><dd>${escapeHTML(execution.corpus_version || "Not recorded")}</dd></dl>${entry.requested_query && entry.requested_query !== entry.query ? `<p>Requested input: ${escapeHTML(entry.requested_query)}</p><p>The cached answer records its original executed query above.</p>` : ""}<p>Included documents: ${escapeHTML((docs.included || []).join(", ") || "none")}</p><p>Blocked: ${escapeHTML((docs.blocked || []).join(", ") || "none")}</p><p>Penalized candidates: ${escapeHTML((docs.stale || []).join(", ") || "none")}</p><p>Excluded: ${escapeHTML((docs.dropped || []).join(", ") || "none")}</p><p>Prompt-trimmed: ${escapeHTML((docs.prompt_excluded || []).join(", ") || "none")}</p></details>`;
    return `<tr><td class="evals-query-cell">${escapeHTML(entry.query || "")}${parameterDetails}</td><td>${escapeHTML(kind)} · ${status}${entry.cached ? "<br>Cached replay" : ""}<br>${escapeHTML(entry.created_at ? new Date(entry.created_at).toLocaleString() : "—")}${entry.error ? `<p class="audit-error">${escapeHTML(entry.error)}</p>` : ""}</td><td>${escapeHTML(identity)}${execution.authenticated_role ? `<br>Account role: ${escapeHTML(execution.authenticated_role)}` : ""}<br>Effective role: ${escapeHTML(execution.effective_role || entry.role || "")}<br>${escapeHTML(execution.workspace || entry.workspace || data.workspace || CURRENT_WORKSPACE)}</td><td>${escapeHTML(POLICY_META[entry.policy_name]?.label || entry.policy_name || "")}</td><td>${metrics.included_count ?? "—"} documents<br>${metrics.total_tokens ?? "—"} estimated tokens</td></tr>`;
  }).join("");
  sessionAuditContent.innerHTML = `<p class="trace-explanation">Workspace: ${escapeHTML(data.workspace || CURRENT_WORKSPACE)} · ${escapeHTML(scope)}. In-memory records reset when the server restarts.</p>` +
    (!entries.length ? '<p class="no-results">No executions in this scope. Retrieve evidence and return to Audit.</p>' : `<div class="evals-table-wrap" tabindex="0" role="region" aria-label="Execution audit"><table class="evals-table audit-table"><thead><tr><th>Executed query</th><th>Execution</th><th>Identity and role</th><th>Policy</th><th>Context</th></tr></thead><tbody>${rows}</tbody></table></div><button type="button" id="export-audit" class="export-btn">Export audit JSON</button>`);
  document.getElementById("export-audit")?.addEventListener("click", () => downloadJSON(data, `querytrace_${CURRENT_WORKSPACE}_audit.json`));
}

// ── Build natural-language Decision Trace summary (IDEA 4) ──

function buildTraceSummary(trace, userRole, compact) {
  const m = trace.metrics || {};
  const included = (trace.included || []).length;
  const blocked = m.blocked_count ?? (trace.blocked_by_permission || []).length;
  const dropped = (trace.dropped_by_budget || []).length;
  const trimmed = (trace.prompt_excluded || []).length;
  const docN = new Set((trace.included || []).map(d => d.doc_id)).size;
  const staleCandidates = m.stale_candidate_doc_count ?? new Set((trace.demoted_as_stale || []).map(d => d.doc_id)).size;
  const penalized = trace.policy_config?.skip_freshness ? 0 : new Set((trace.demoted_as_stale || []).map(d => d.doc_id)).size;
  const staleIncluded = m.stale_included_doc_count ?? new Set((trace.included || []).filter(d => d.superseded_by).map(d => d.doc_id)).size;
  let text = `<strong>${included}</strong> fragments from <strong>${docN}</strong> documents included · <strong>${m.total_tokens ?? trace.total_tokens ?? 0}</strong> estimated tokens. `;
  const reasons = new Map();
  (trace.dropped_by_budget || []).forEach(d => { const key=d.reason || "token_budget"; reasons.set(key,(reasons.get(key) || 0)+1); });
  const reasonNames = { token_budget: "token budget", document_limit: "document limit", insufficient_evidence: "insufficient evidence", prompt_budget: "prompt budget" };
  const exclusions = Array.from(reasons, ([reason,count]) => `${count} for ${reasonNames[reason] || escapeHTML(reason)}`).join(", ");
  text += `${blocked} fragments blocked by permissions; ${dropped ? `excluded: ${exclusions}` : "0 excluded"}${trimmed ? `; ${trimmed} trimmed for the model prompt` : ""}. `;
  if (staleCandidates || penalized || staleIncluded) text += `Superseded documents: ${staleCandidates} candidates, ${penalized} freshness-penalized, ${staleIncluded} in the final context. `;
  if (m.partially_included_doc_count) text += `${m.partially_included_doc_count} documents are partially included. `;
  return text;
}

// ── Build Decision Trace panel HTML ──

// ── Decision Record rows (Fase 6 D.2) ──
// One ledger row per parent doc per ACTION: TITLE · REF · flat action mark ·
// readable basis. Inline basis text replaces the old chip tooltips (which
// were unreachable on touch). All dynamic strings are escaped by the callers.

function recordRowHTML(action, stampCls, title, ref, basisHTML) {
  const titleHTML = title
    ? `<span class="record-title">${escapeHTML(title)}</span>`
    : `<span class="record-untitled">—</span>`;
  return `
    <tr>
      <td class="record-doc">${titleHTML}<details class="record-reference"><summary>Reference</summary><span class="record-ref">${escapeHTML(ref)}</span></details></td>
      <td class="record-action"><span class="stamp stamp-flat ${stampCls}">${action}</span></td>
      <td class="record-basis">${basisHTML}</td>
    </tr>`;
}

function buildDecisionRecordHTML(trace, userRole) {
  const rows = [];
  const stale = new Map((trace.demoted_as_stale || []).map(d => [d.chunk_id || d.doc_id,d]));
  const includedDocs = new Set((trace.included || []).map(d => d.doc_id));
  const droppedDocs = new Set((trace.dropped_by_budget || []).map(d => d.doc_id));
  (trace.document_summaries || []).filter(d => d.status === "partial").forEach(d => droppedDocs.add(d.doc_id));
  const annotation = d => {
    const penalty = stale.get(d.chunk_id || d.doc_id);
    return penalty ? ` · superseded by ${escapeHTML(penalty.superseded_by)}; freshness ×${penalty.penalty_applied}` : "";
  };
  const add = (entry, action, cls, basis) => rows.push(recordRowHTML(action,cls,entry.title,
    `${entry.doc_id}${entry.chunk_id ? ` / ${entry.chunk_id}` : ""}`,basis + annotation(entry)));
  (trace.included || []).forEach(d => add(d, droppedDocs.has(d.doc_id) ? "Partially included" : "Included", "stamp-approved", `${trace.policy_config?.skip_permission_filter ? "Selected by the unfiltered baseline" : "Permitted for this role and selected within the context limits"} · ${d.token_count} estimated tokens · selection priority ${(((d.score ?? 0) + (d.freshness_score ?? 0)) / 2).toFixed(3)} · relative rank ${(d.score ?? 0).toFixed(3)}`));
  const reasons = { token_budget: "exceeds remaining token budget", document_limit: "maximum number of documents reached", insufficient_evidence: "insufficient relevance evidence", prompt_budget: "removed to fit model prompt" };
  (trace.dropped_by_budget || []).forEach(d => add(d, "Excluded", "stamp-overbudget", `${d.token_count ?? 0} estimated tokens · ${escapeHTML(reasons[d.reason] || d.reason || "exceeds remaining token budget")}${includedDocs.has(d.doc_id) ? " · other fragments of this document are included" : ""}`));
  (trace.prompt_excluded || []).forEach(d => add(d, "Prompt trim", "stamp-overbudget", `${d.token_count ?? 0} estimated tokens · removed after initial selection to fit model prompt`));
  (trace.blocked_by_permission || []).forEach(d => add(d, "Blocked", "stamp-blocked", `requires ${escapeHTML(d.required_role)} · effective role ${escapeHTML(userRole || d.user_role)}`));
  if (trace.blocked_summary?.count && !(trace.blocked_by_permission || []).length) rows.push(recordRowHTML("Blocked", "stamp-blocked", "Titles withheld by server", `${trace.blocked_summary.count} documents`, `${trace.metrics?.blocked_count ?? "—"} fragments · requires ${(trace.blocked_summary.required_roles || []).map(escapeHTML).join(", ")}`));
  return `<div class="record-table-wrap" tabindex="0" role="region" aria-label="Fragment decision table"><table class="record-table"><thead><tr><th>Document</th><th>Final outcome</th><th>Reason and annotations</th></tr></thead><tbody>${rows.join("") || '<tr><td colspan="3">No candidates selected. See the evidence status above.</td></tr>'}</tbody></table></div>`;
}

// Compact chips — Compare columns only (the acta table needs more width)
function buildTraceChipsHTML(trace) {
  const chunkSuffix = (d) =>
    (d.chunk_ids || []).length > 1 ? `<em> ·${d.chunk_ids.length} chunks</em>` : "";
  const chunkTitle = (d) =>
    (d.chunk_ids || []).length ? ` · ${escapeHTML(d.chunk_ids.join(", "))}` : "";

  const includedChips = groupTraceEntries(trace.included || [])
    .map(
      (d) =>
        `<span class="trace-chip trace-chip-included" title="score: ${d.score.toFixed(2)} · ${d.token_count} tokens${chunkTitle(d)}">${escapeHTML(d.doc_id)}${chunkSuffix(d)}</span>`
    )
    .join("") || `<span class="trace-chip-empty">none</span>`;

  const blockedChips = groupTraceEntries(trace.blocked_by_permission || [])
    .map(
      (d) =>
        `<span class="trace-chip trace-chip-blocked" title="requires: ${escapeHTML(d.required_role)}${chunkTitle(d)}">${escapeHTML(d.doc_id)}<em> ·${escapeHTML(d.required_role)}</em></span>`
    )
    .join("") || `<span class="trace-chip-empty">none</span>`;

  const staleChips = groupTraceEntries(trace.demoted_as_stale || [])
    .map(
      (d) =>
        `<span class="trace-chip trace-chip-stale" title="superseded by: ${escapeHTML(d.superseded_by)} · penalty: ${d.penalty_applied}×${chunkTitle(d)}">${escapeHTML(d.doc_id)}<em> →${escapeHTML(d.superseded_by)}</em></span>`
    )
    .join("") || `<span class="trace-chip-empty">none</span>`;

  const droppedChips = groupTraceEntries(trace.dropped_by_budget || [])
    .map(
      (d) =>
        `<span class="trace-chip trace-chip-dropped" title="${d.token_count} tokens · score: ${d.score.toFixed(2)}${chunkTitle(d)}">${escapeHTML(d.doc_id)}<em> ·${d.token_count}t</em></span>`
    )
    .join("") || `<span class="trace-chip-empty">none</span>`;

  return `
    <div class="trace-row">
      <div class="trace-section">
        <span class="trace-section-label trace-label-included">Included</span>
        <div class="trace-chips">${includedChips}</div>
      </div>
      <div class="trace-section">
        <span class="trace-section-label trace-label-blocked">Blocked</span>
        <div class="trace-chips">${blockedChips}</div>
      </div>
    </div>
    <div class="trace-row">
      <div class="trace-section">
        <span class="trace-section-label trace-label-stale">Stale</span>
        <div class="trace-chips">${staleChips}</div>
      </div>
      <div class="trace-section">
        <span class="trace-section-label trace-label-dropped">Dropped</span>
        <div class="trace-chips">${droppedChips}</div>
      </div>
    </div>`;
}

// Every trace uses the same fragment-level decision table, including empty outcomes.
function buildTracePanelHTML(trace, startOpen, userRole, compact = false) {
  const config = trace.policy_config || {};
  const metrics = trace.metrics || {};
  const summary = buildTraceSummary(trace,userRole,compact);
  const evidence = trace.evidence?.applied ? `Evidence gate: ${trace.evidence.sufficient ? "sufficient" : "insufficient"} · maximum permitted semantic similarity ${trace.evidence.max_semantic_similarity == null ? "unavailable" : trace.evidence.max_semantic_similarity.toFixed(3)} · threshold ${trace.evidence.threshold}. This is a heuristic evidence check, not an entailment guarantee.` : "";
  const freshness = config.skip_freshness ? "Freshness is not applied by this policy." : `Freshness is measured against ${escapeHTML(config.reference_date || trace.freshness_reference_date || "the corpus reference date (latest document)")}; a superseded candidate receives a penalty before budget selection.`;
  return `<div class="trace-panel${startOpen ? " open" : ""}">
    <button type="button" class="trace-toggle" aria-expanded="${startOpen}"><span class="trace-toggle-label">Decision Trace</span><span class="trace-toggle-summary">${metrics.retrieved_count ?? 0} candidate fragments → ${(trace.included || []).length} included</span><span class="trace-caret">${uiIcon('chevron')}</span></button>
    <div class="trace-body"${startOpen ? "" : " hidden"}>
      <div class="trace-summary">${summary}</div>
      <details class="trace-method"><summary>Methodology &amp; evidence check</summary><p class="trace-explanation">${escapeHTML(baselineDescription(trace))} Packing order uses 50% relative rank + 50% freshness${config.skip_freshness ? " (fixed at 0)" : ""}, shown as selection priority. Neither score is confidence. A document can have both included and excluded fragments. A freshness penalty changes selection priority; the final outcome is shown below. ${freshness}</p><p class="trace-explanation">${evidence}</p></details>
      ${buildDecisionRecordHTML(trace,userRole)}
      <p class="trace-explanation">Context tokens are local estimates. ${config.skip_budget ? "No selection token budget applied." : `Selection budget: ${config.token_budget ?? "—"} tokens.`} Latency proxy: ${Math.round(trace.ttft_proxy_ms ?? 0)} ms (estimate, not measured model latency).</p>
    </div></div>`;
}

function baselineDescription(trace) {
  const config = trace?.policy_config || {};
  const k = config.top_k ?? DEFAULT_TOP_K;
  if (config.name === "whole_corpus") return "Whole-corpus baseline: every indexed fragment; no permissions, freshness or token budget.";
  if (config.name === "naive_top_k") return `Top-k baseline: up to ${k} ranked fragments; no permissions, freshness or token budget.`;
  return `Up to ${(config.candidate_multiplier ?? 6) * k} ranked candidate fragments, at most ${k} selected documents, ${config.token_budget ?? "—"} estimated context tokens. Permissions ${config.skip_permission_filter ? "not applied" : "enforced"}.`;
}

// ── Wire trace toggle expand/collapse ──

function wireExpandButtons(container) {
  container.querySelectorAll(".card-expand-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".result-card");
      const idx = parseInt(card.dataset.cardIdx, 10);
      const excerpts = _cardExcerpts.get(idx);
      const contentEl = card.querySelector(".card-content");
      const textEl = contentEl.querySelector(".card-content-text");
      const expanded = contentEl.classList.toggle("expanded");
      textEl.textContent = expanded ? excerpts.full : excerpts.short;
      btn.textContent = expanded ? "Collapse source" : "Read source";
      btn.setAttribute("aria-expanded", String(expanded));
    });
  });
}

function wireTraceToggles(container) {
  container.querySelectorAll(".trace-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.closest(".trace-panel");
      const isOpen = panel.classList.toggle("open");
      btn.setAttribute("aria-expanded", isOpen);
      if (panel.querySelector(".trace-body")) panel.querySelector(".trace-body").hidden = !isOpen;
    });
  });
}

// ── Fill-bar entrance (A.7) ──
// Bars render at width:0 with the real percentage in data-w; setting the
// final width one frame later lets the CSS width transition actually play.
// Under prefers-reduced-motion the transition is disabled, so bars snap.
function animateBars(container) {
  const bars = container.querySelectorAll("[data-w]");
  if (bars.length === 0) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bars.forEach((bar) => {
        bar.style.width = `${bar.dataset.w}%`;
      });
    });
  });
}

// ── Error state ──

function requestSettings() {
  return { top_k: selectedTopK(), token_budget: selectedBudget(), workspace: CURRENT_WORKSPACE };
}

function renderError(err, container, retry) {
  const isNetwork =
    err.message === "Failed to fetch" ||
    err.message.includes("NetworkError");
  const title = isNetwork ? "Backend unavailable" : "Request failed";
  const detail = isNetwork
    ? "Check the server connection. For local use, start uvicorn src.main:app --reload and open /app/ on the same server."
    : err.message;

  container.innerHTML = `
    <div class="error-state">
      <div class="error-icon">!</div>
      <p class="error-title">${escapeHTML(title)}</p>
      <p class="error-detail">${escapeHTML(detail)}</p>
      ${retry ? '<p class="capability-note">Retry uses the original question and settings.</p>' : ""}
      <button type="button" class="guide-button error-retry">Try again</button>
    </div>`;
  container.querySelector(".error-retry")?.addEventListener("click", () => {
    if (retry) retry();
    else if (container === evalsContent) runEvals();
    else if (container.id === "documents-content") loadDocuments();
    else location.reload();
  });
}

// ── Utility ──

function formatDocType(raw) {
  return (raw || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [year, month] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[ch]));
}

// ── Export: download the complete API response payload as JSON ──
// Uses Blob + createObjectURL; revokes the object URL after the click to
// avoid leaking Blob references for the lifetime of the document.
function downloadJSON(data, filename) {
  try {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (err) {
    console.error("Export failed:", err);
  }
}

// ── Admin / ingest ──

const adminForm = document.getElementById("admin-form");
const adminSubmit = document.getElementById("admin-submit");
const adminStatus = document.getElementById("admin-status");
const adminFileInput = document.getElementById("admin-file");

function setAdminStatus(kind, message) {
  if (!adminStatus) return;
  adminStatus.hidden = false;
  adminStatus.className = `admin-status admin-status-${kind}`;
  adminStatus.innerHTML = message;
}

function clearAdminStatus() {
  if (!adminStatus) return;
  adminStatus.hidden = true;
  adminStatus.className = "admin-status";
  adminStatus.textContent = "";
}

// Human labels for the ingest job states (Fase 3: POST /ingest → 202 + job).
const JOB_STATE_LABELS = {
  queued: "Queued — waiting for the ingest worker…",
  extracting: "Persisting extracted text…",
  embedding: "Generating embeddings…",
  indexing: "Updating FAISS + BM25 indexes…",
};
const JOB_STATE_ORDER = ["queued", "extracting", "embedding", "indexing"];
const JOB_POLL_MS = 1000;
const JOB_POLL_MAX = 120; // give up after ~2 minutes

function renderJobProgress(state) {
  const idx = JOB_STATE_ORDER.indexOf(state);
  const steps = JOB_STATE_ORDER.map((s, i) => {
    const cls = i < idx ? "job-step done" : i === idx ? "job-step active" : "job-step";
    return `<span class="${cls}" title="${escapeHTML(JOB_STATE_LABELS[s])}"></span>`;
  }).join("");
  const label = JOB_STATE_LABELS[state] || state;
  return `<span class="job-progress">${steps}</span> ${escapeHTML(label)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollIngestJob(jobId) {
  for (let i = 0; i < JOB_POLL_MAX; i++) {
    const res = await apiFetch(`${API_BASE}/ingest/jobs/${encodeURIComponent(jobId)}`);
    const job = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(job?.detail || `HTTP ${res.status}`);
    }
    if (job.state === "done" || job.state === "failed") return job;
    setAdminStatus("loading", renderJobProgress(job.state));
    await sleep(JOB_POLL_MS);
  }
  throw new Error("Timed out waiting for the ingest job to finish.");
}

async function uploadDocument(event) {
  event.preventDefault();
  if (!adminForm || !adminSubmit) return;

  const file = adminFileInput?.files?.[0];
  if (!file) {
    setAdminStatus("error", "Please pick a file (.pdf, .txt, .md or .docx).");
    return;
  }

  const fd = new FormData(adminForm);
  fd.set("workspace", CURRENT_WORKSPACE || ""); // ingest into the active workspace
  adminSubmit.disabled = true;
  adminSubmit.classList.add("loading");
  setAdminStatus("loading", "Uploading and validating the file…");

  try {
    const res = await apiFetch(`${API_BASE}/ingest`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detail = data?.detail || `HTTP ${res.status}`;
      setAdminStatus("error", `Upload failed: ${escapeHTML(detail)}`);
      return;
    }

    // 202: validated + queued. Poll the job until it reaches a terminal state.
    setAdminStatus("loading", renderJobProgress(data.state || "queued"));
    const job = await pollIngestJob(data.job_id);

    if (job.state === "failed") {
      const detail = job.error?.detail || "Ingest job failed.";
      setAdminStatus("error", `Upload failed: ${escapeHTML(detail)}`);
      return;
    }

    const result = job.result || {};
    setAdminStatus(
      "success",
      `Indexed <strong>${escapeHTML(result.doc_id)}</strong> — ${escapeHTML(
        result.title
      )}. Corpus now contains ${result.total_documents} documents. It is searchable in Query, Compare and Ask. Previous results and evaluations have been cleared.`
    );
    const warnings = result.warnings || [];
    if (warnings.length) adminStatus.insertAdjacentHTML("beforeend", `<p>Extraction warnings: ${warnings.map(escapeHTML).join("; ")}</p>`);
    invalidateResults("Corpus updated. Retrieve evidence against the new corpus version.");
    evalsLoaded = false;
    documentsLoaded = false;
    DOCUMENTS = [];
    evalsContent.innerHTML = "";
    sessionAuditContent.innerHTML = "";
    await loadWorkspaceMeta(CURRENT_WORKSPACE);
    renderRoleControls();
    renderScenarios();
    renderAdminFormOptions();
    applySessionUI();
    adminForm.reset();
  } catch (err) {
    setAdminStatus(
      "error",
      `Network error: ${escapeHTML(err?.message || String(err))}`
    );
  } finally {
    adminSubmit.disabled = false;
    adminSubmit.classList.remove("loading");
  }
}

if (adminForm) {
  adminForm.addEventListener("submit", uploadDocument);
}

// ── Corpus explorer and explicit retrieval controls ──
function selectedTopK() {
  const value = Number(document.getElementById("query-top-k")?.value || DEFAULT_TOP_K);
  return Math.min(50, Math.max(1, value));
}
function selectedBudget() {
  const raw = document.getElementById("token-budget")?.value;
  return raw === "" || raw == null ? 2048 : Math.min(32768, Math.max(0, Number(raw)));
}
["query-top-k", "token-budget"].forEach(id => document.getElementById(id)?.addEventListener("change", () => {
  invalidateResults("Retrieval settings changed. Retrieve evidence or compare policies with the new limits.");
}));

async function loadDocuments() {
  const container = document.getElementById("documents-content");
  container.innerHTML = '<p class="no-results" role="status">Loading documents…</p>';
  try {
    const response = await apiFetch(`${API_BASE}/documents?workspace=${encodeURIComponent(CURRENT_WORKSPACE || "")}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `Server returned ${response.status}`);
    DOCUMENTS = payload.documents || [];
    documentsLoaded = true;
    container.dataset.visibleDocs = payload.visible_docs ?? DOCUMENTS.length;
    container.dataset.totalDocs = payload.total_docs ?? DOCUMENTS.length;
    container.dataset.corpusVersion = payload.corpus_version || "";
    renderDocuments();
  } catch (error) { renderError(error,container); }
}
function renderDocuments() {
  const container = document.getElementById("documents-content");
  const query = (document.getElementById("document-search")?.value || "").toLowerCase();
  const docs = DOCUMENTS.filter(d => [d.title,d.id,d.doc_id,d.type,d.min_role,d.sensitivity,...(d.tags || [])].join(" ").toLowerCase().includes(query));
  container.innerHTML = `<p class="document-count">${container.dataset.visibleDocs || DOCUMENTS.length} accessible documents of ${container.dataset.totalDocs || DOCUMENTS.length} in this workspace · ${docs.length} shown${SESSION ? ` · account role ${escapeHTML(roleLabel(SESSION.role))}` : " · laboratory disclosure"}</p>` +
    (docs.length ? `<div class="document-list">${docs.map(d => `<article class="document-item" data-doc-id="${escapeHTML(d.id || d.doc_id)}"><h3>${escapeHTML(d.title || d.id || d.doc_id)}</h3><dl class="document-classification"><div><dt>Reference</dt><dd>${escapeHTML(d.id || d.doc_id)}</dd></div><div><dt>Type</dt><dd>${escapeHTML(formatDocType(d.type || d.doc_type))}</dd></div><div><dt>Minimum role</dt><dd>${escapeHTML(roleLabel(d.min_role))}</dd></div><div><dt>Sensitivity</dt><dd>${escapeHTML(d.sensitivity || "Unspecified")}</dd></div><div><dt>Document date</dt><dd>${escapeHTML(d.date || "Unspecified")}</dd></div></dl>${d.superseded_by ? `<p class="scenario-limit">Superseded by ${escapeHTML(d.superseded_by)}. Full Policy penalizes this version before selection; other policies may still include it.</p>` : ""}<details><summary>Read extracted text</summary>${d.tags?.length ? `<p class="document-tags">Tags: ${d.tags.map(escapeHTML).join(", ")}</p>` : ""}<div class="document-text">${escapeHTML(d.content || "No extracted text is available.")}</div></details></article>`).join("")}</div>` : `<p class="no-results">${query ? "No documents match this filter. Clear the filter to see the corpus." : "No documents are accessible in this workspace. Choose another workspace or use an authorized account."}</p>`);
}
document.getElementById("document-search")?.addEventListener("input",renderDocuments);
document.getElementById("audit-refresh")?.addEventListener("click",fetchSessionAudit);

// ── Result-backed tutorial. Only successful operations unlock the next step. ──
const TOUR_KEY = "qt_tutorial_v1";
let tourStep = 0;
let tourSnapshot = null;
let tourReturnFocus = null;
let tourRun = null; // Kept in memory only; never persist source text or authenticated results.
let tourBusy = false;
let tourError = "";
let tourEpoch = 0;
function readTourState() {
  try { return JSON.parse(localStorage.getItem(TOUR_KEY) || "null"); } catch (_) { return null; }
}
function saveTourState(status) {
  try { localStorage.setItem(TOUR_KEY, JSON.stringify({version: 2, status, step: tourStep, variationSkipped: !!tourRun?.variationSkipped})); } catch (_) { /* The current run remains usable without storage. */ }
}
function initializeTour() {
  document.getElementById("welcome-corpus-note").textContent = WORKSPACE_META?.is_demo
    ? "These organizations and documents are fictional. Demo accounts have different document permissions."
    : "Use a question about this workspace’s documents. A configured example is optional.";
  if (!readTourState() && !WORKSPACE_META?.unavailable && (SESSION || can("lab_enabled"))) document.getElementById("welcome-dialog").showModal();
}
function compatibleScenario() {
  return [...(WORKSPACE_META?.scenarios || []), ...(WORKSPACE_META?.example_queries || [])]
    .find(s => s.query && (!s.role || canUseRole(s.role)));
}
function captureTourWork() {
  return {query: input.value, role: selectedRole(), policy: selectedPolicy(), mode: currentMode,
    hasPriorWork: !!(input.value.trim() || _lastSingleData || _lastCompareData),
    topK: selectedTopK(), budget: selectedBudget(), corpusVersion: WORKSPACE_META?.corpus_version,
    single: _lastSingleData, compare: _lastCompareData};
}
function setTourControls(query, role, settings) {
  input.value = query;
  const roleRadio = Array.from(document.querySelectorAll('input[name="role"]')).find(r => r.value === role);
  if (roleRadio && !roleRadio.disabled) roleRadio.checked = true;
  document.querySelector('input[name="policy"][value="full_policy"]').checked = true;
  document.getElementById("query-top-k").value = settings.top_k;
  document.getElementById("token-budget").value = settings.token_budget;
  updateRoleDescription(selectedRole());
  updatePolicyDescription("full_policy");
  renderIdentityContext();
  evaluateSingleStale();
}
function startTour() {
  document.getElementById("welcome-dialog").close();
  if (tourSnapshot) { focusTour("tour-title"); return; }
  tourReturnFocus = document.activeElement;
  tourSnapshot = captureTourWork();
  if (!tourRun || tourRun.corpusVersion !== WORKSPACE_META?.corpus_version) resetTourRun();
  const panel = document.getElementById("tour-panel");
  mainEl.prepend(panel);
  panel.hidden = false;
  document.body.classList.add("tour-active");
  renderTour();
  focusTour("tour-title");
}
function resetTourRun() {
  tourEpoch++;
  tourBusy = false;
  tourError = "";
  const scenario = compatibleScenario();
  tourRun = {query: scenario?.query || input.value.trim(), role: scenario?.role || selectedRole(),
    settings: requestSettings(), corpusVersion: WORKSPACE_META?.corpus_version,
    single: null, compare: null, inspected: false, variation: null, variationQuery: "", variationSkipped: false};
  tourStep = 0;
}
function closeTour(status = "paused") {
  const wasBusy = tourBusy;
  tourEpoch++;
  _requestEpoch++; // An in-flight guide response must not overwrite restored work.
  tourBusy = false;
  setLoadingSingle(false);
  setLoadingCompare(false);
  saveTourState(status);
  document.getElementById("tour-panel").hidden = true;
  document.body.classList.remove("tour-active");
  if (tourSnapshot?.hasPriorWork) {
    const prior = tourSnapshot;
    const sameCorpus = prior.corpusVersion === WORKSPACE_META?.corpus_version;
    setTourControls(prior.query, prior.role, {top_k: prior.topK, token_budget: prior.budget});
    const policy = document.querySelector(`input[name="policy"][value="${prior.policy}"]`);
    if (policy && !policy.disabled) policy.checked = true;
    // Clear both buffers before restoring: a guide comparison cannot survive beside a prior draft.
    invalidateResults("Your draft has been restored. Retrieve evidence to inspect its context.");
    if (sameCorpus && prior.single) {
      const {data, role, policy} = prior.single;
      renderSingleResult(data, role, policy);
      if (Object.hasOwn(data, "answer")) {
        resultsSection.insertAdjacentHTML("afterbegin", buildAskPanelHTML(data));
        wireAskPanel(resultsSection);
      }
    }
    if (sameCorpus && prior.compare) {
      renderCompare(prior.compare);
      document.getElementById("compare-banner").hidden = false;
      document.getElementById("compare-input-note").hidden = prior.query.trim() === prior.compare.query;
    }
    updatePolicyDescription(selectedPolicy());
    evaluateSingleStale();
    switchMode(prior.mode);
  }
  if (!tourSnapshot?.hasPriorWork && wasBusy) {
    invalidateResults("Guide request cancelled. Retrieve evidence when you are ready.");
    if (tourRun.single) renderSingleResult(tourRun.variation || tourRun.single, tourRun.role, "full_policy");
    if (tourRun.compare) { renderCompare(tourRun.compare); document.getElementById("compare-banner").hidden = false; }
  }
  tourSnapshot = null;
  tourError = "";
  const target = tourReturnFocus?.isConnected && tourReturnFocus.getClientRects().length ? tourReturnFocus : document.getElementById("guide-button");
  target?.focus();
}
function focusTour(id) {
  const el = document.getElementById(id);
  el?.focus({preventScroll: true});
  el?.scrollIntoView({block: "nearest", behavior: "instant"});
}
function tourCount(value, noun) { return `${value} ${noun}${value === 1 ? "" : "s"}`; }
function tourResultSummary(data) {
  const trace = data.decision_trace || {};
  return `<p>${tourCount(groupContextByDoc(data.context).length, "document")} · ${tourCount((data.context || []).length, "fragment")} · ${data.total_tokens ?? 0} estimated tokens.</p>` +
    `<p>${tourCount(trace.metrics?.blocked_count ?? 0, "fragment")} blocked by permissions; ${(trace.dropped_by_budget || []).length} excluded by selection limits. Full Policy checked permissions, freshness and the token budget.</p>`;
}
function tourComparisonSummary() {
  if (!tourRun.compare) return "<p>Unfiltered comparison was not run: your account only permits Full Policy.</p>";
  const data = tourRun.compare;
  const blocked = new Set((data.results.full_policy.decision_trace.blocked_by_permission || []).map(d => d.doc_id));
  const exposed = groupContextByDoc(data.results.naive_top_k?.context).filter(d => blocked.has(d.doc_id));
  return `<p>${exposed.length ? `Top-k includes ${exposed.length} document${exposed.length === 1 ? "" : "s"} outside ${escapeHTML(roleLabel(data.role))} access. Full Policy blocks ${exposed.length === 1 ? "it" : "them"}: ${exposed.map(d => escapeHTML(d.title || d.doc_id)).join("; ")}.` : "No permission difference in the selected Top-k context for this question and role."}</p>` +
    `<p>${COMPARE_ORDER.filter(p => data.results[p]).map(p => `${escapeHTML(POLICY_META[p].label)}: ${tourCount(groupContextByDoc(data.results[p].context).length, "document")}`).join(" · ")}.</p>`;
}
function tourEvidence() { return tourRun.compare?.results.full_policy || tourRun.single; }
function tourDecisionHTML() {
  const data = tourEvidence();
  const source = data?.context?.[0];
  if (!source) return emptyResultHTML(data) + "<p>No selected source is available to read. The trace remains available below; this guide will record that limit.</p>";
  const trace = data.decision_trace;
  const selected = (trace.included || []).find(d => (d.chunk_id || d.doc_id) === (source.chunk_id || source.doc_id));
  // Use only records the server disclosed. Restricted identities never fetch blocked text.
  const excerptTrace = {...trace, included: selected ? [selected] : [], dropped_by_budget: [], prompt_excluded: [],
    blocked_by_permission: (trace.blocked_by_permission || []).slice(0, 1)};
  return buildDecisionRecordHTML(excerptTrace, tourRun.role) +
    `<p><strong>Selected source: ${escapeHTML(source.title || source.doc_id)}</strong> · Full Policy</p><div class="tour-source" tabindex="0" role="region" aria-label="Selected source fragment">${escapeHTML(source.content || "No source text returned.")}</div>`;
}
function tourStepDone() {
  return [!!tourRun.single, !!tourRun.compare || !!tourRun.comparisonUnavailable, tourRun.inspected,
    !!tourRun.variation || tourRun.variationSkipped, true][tourStep];
}
function renderTour() {
  if (!tourSnapshot) return;
  saveTourState("active");
  const run = tourRun;
  const role = escapeHTML(roleLabel(run.role));
  const steps = [
    {title: "Start with one question", body: `<p>See which passages can reach a model, and why others are left out.</p>${run.query ? `<p class="tour-question">${escapeHTML(run.query)}</p>` : '<p>No scenario is configured. Enter a question about your documents.</p><label for="tour-question">Your question</label><input id="tour-question" class="search-input tour-question-input" maxlength="2000" required>'}<p>Retrieve evidence uses Full Policy. It does not generate an answer.</p>`, action: "Retrieve evidence"},
    {title: can("can_compare") ? "Compare the same question and role" : "Your account’s document access", body: `<p class="tour-question">${escapeHTML(run.query)}</p><p>Effective document role: <strong>${role}</strong>. ${SESSION ? "Your signed-in identity stays unchanged." : "This is a simulated role; no account is changed."}</p><p>${can("can_compare") ? "Compare Top-k without filters, Permissions Only and Full Policy using the same question and retrieval limits." : "Your account cannot run unfiltered comparisons. Continue with the Full Policy decisions returned for your account."}</p>`, action: can("can_compare") ? "Compare policies" : "Continue with my permitted evidence"},
    {title: "Read a decision and its source", body: "<p>Read the outcome and reason, then the selected passage. The complete Decision Trace remains below.</p>", action: tourEvidence()?.context?.length ? "Read decision and source" : "Inspect empty result"},
    {title: "Try your own question", body: `<p>Change the question and retrieve again as ${role}. ${run.compare ? "The original comparison stays available." : "Your original Full Policy evidence stays available."}</p><label for="tour-question">Your variation</label><input id="tour-question" class="search-input tour-question-input" maxlength="2000" value="${escapeHTML(run.variationQuery || run.query)}" required>`, action: "Retrieve evidence"},
    {title: run.variationSkipped ? "Example finished · variation skipped" : "Your evidence experiment", body: `<p class="tour-question">${escapeHTML(run.query)}</p><p>Full Policy retrieved the evidence below as ${role}. ${run.inspected && tourEvidence()?.context?.length ? "You opened a decision and its selected source." : "No selected source was available to read."}</p>`, action: ""},
  ];
  const step = steps[tourStep];
  document.getElementById("tour-progress").textContent = `Step ${tourStep + 1} of ${steps.length}`;
  document.getElementById("tour-title").textContent = step.title;
  document.getElementById("tour-content").innerHTML = step.body;
  const field = document.getElementById("tour-question");
  field?.addEventListener("input", () => { if (tourStep === 3) run.variationQuery = field.value; });
  let outcome = "";
  if (tourStep === 0 && run.single) outcome = tourResultSummary(run.single);
  if (tourStep === 1 && tourStepDone()) outcome = tourComparisonSummary();
  if (tourStep === 2 && run.inspected) outcome = tourDecisionHTML();
  if (tourStep === 3 && run.variation) outcome = `<p><strong>${escapeHTML(run.variation.query)}</strong></p>` + tourResultSummary(run.variation);
  if (tourStep === 4) outcome = tourResultSummary(run.single) + tourComparisonSummary() +
    `<p>${run.variation ? `Your variation retrieved ${tourCount(run.variation.context.length, "fragment")}.` : "Own-question variation skipped explicitly."} No answer was generated.</p><p>${ASK_ENABLED ? "Optional next: Generate answer sends selected evidence to the configured model and may incur a cost." : "Answer generation is disabled; retrieval remains available."} Sign in and workspace tools are available outside the guide.</p>`;
  document.getElementById("tour-result").innerHTML = outcome;
  const action = document.getElementById("tour-action");
  action.hidden = tourStepDone();
  action.disabled = tourBusy;
  action.textContent = tourBusy ? (tourStep === 1 ? "Comparing…" : "Retrieving…") : tourError ? `Try again · ${step.action}` : step.action;
  document.getElementById("tour-action-note").textContent = tourError || (tourBusy ? "Waiting for the server. You can exit at any time." : outcome && tourStep !== 4 ? (tourStep === 2 ? (tourEvidence()?.context?.length ? "Decision and source opened below." : "Empty result opened below; no selected source is available.") : "Result received. Continue when you have read it.") : "");
  const next = document.getElementById("tour-next");
  next.hidden = !tourStepDone();
  next.disabled = tourBusy || !tourStepDone();
  next.textContent = tourStep === 4 ? "Finish guide" : [can("can_compare") ? "Compare this evidence" : "Inspect my access", "Read a decision", "Try a variation", "See what happened"][tourStep];
  document.getElementById("tour-back").disabled = tourStep === 0 || tourBusy;
  document.getElementById("tour-reset").hidden = tourStep === 0 && !run.single;
  document.getElementById("tour-reset").disabled = tourBusy;
  document.getElementById("tour-skip").hidden = tourStep !== 3 || !!run.variation;
  document.getElementById("tour-skip").disabled = tourBusy;
}
async function executeTourAction() {
  if (tourBusy || !tourSnapshot || tourStepDone()) return;
  if (tourRun.corpusVersion !== WORKSPACE_META?.corpus_version) {
    resetTourRun(); renderTour(); focusTour("tour-title"); return;
  }
  const run = tourRun;
  const step = tourStep;
  const epoch = ++tourEpoch;
  const field = document.getElementById("tour-question");
  const question = step === 3 || !run.query ? field?.value.trim() : run.query;
  if ((step === 0 || step === 3) && (!question || (step === 3 && question === run.query))) {
    field?.setCustomValidity(question ? "Change the question, or continue without a variation." : "Enter a question about your documents.");
    field?.reportValidity();
    field?.addEventListener("input", () => field.setCustomValidity(""), {once: true});
    return;
  }
  tourError = "";
  if (step === 0 || step === 1 || step === 3) {
    if (step === 0) run.query = question;
    if (step === 3) run.variationQuery = question;
    setTourControls(question, run.role, run.settings);
    switchMode(step === 1 && can("can_compare") ? "compare" : "single");
    if (step === 1 && !can("can_compare")) run.comparisonUnavailable = true;
    else {
      tourBusy = true;
      renderTour();
      const data = step === 1 ? await runCompare(run.query, run.role, run.settings) : await runSingleQuery(question, run.role, "full_policy", run.settings);
      if (epoch !== tourEpoch || !tourSnapshot) return;
      tourBusy = false;
      if (data) {
        if (step === 0) { run.single = data; run.role = data.decision_trace.user_context.role; }
        if (step === 1) run.compare = data;
        if (step === 3) run.variation = data;
      } else tourError = "No successful result received. Check the error below and try again.";
    }
  } else if (step === 2) {
    if (run.compare) { switchMode("compare"); renderCompare(run.compare); document.getElementById("compare-banner").hidden = false; }
    else { switchMode("single"); renderSingleResult(run.single, run.role, "full_policy"); }
    const trace = (run.compare ? compareGrid.querySelector('[data-policy="full_policy"]') : resultsSection).querySelector(".trace-panel");
    if (trace) {
      trace.classList.add("open");
      trace.querySelector(".trace-toggle").setAttribute("aria-expanded", "true");
      trace.querySelector(".trace-body").hidden = false;
    }
    run.inspected = true;
  }
  renderTour();
  focusTour(tourError ? "tour-action" : "tour-result");
}
document.getElementById("tour-start")?.addEventListener("click", startTour);
document.getElementById("tour-explore")?.addEventListener("click", () => {
  saveTourState("dismissed"); document.getElementById("welcome-dialog").close(); input.focus();
});
document.getElementById("welcome-dialog")?.addEventListener("cancel", () => saveTourState("dismissed"));
document.getElementById("guide-button")?.addEventListener("click", startTour);
document.getElementById("tour-action")?.addEventListener("click", executeTourAction);
document.getElementById("tour-next")?.addEventListener("click", () => {
  if (!tourStepDone() || tourBusy) return;
  if (tourStep === 4) closeTour("completed");
  else { tourStep++; tourError = ""; renderTour(); focusTour("tour-title"); }
});
document.getElementById("tour-back")?.addEventListener("click", () => {
  if (tourStep > 0 && !tourBusy) { tourStep--; tourError = ""; renderTour(); focusTour("tour-title"); }
});
document.getElementById("tour-close")?.addEventListener("click", () => closeTour());
document.getElementById("tour-reset")?.addEventListener("click", () => {
  resetTourRun(); renderTour(); focusTour("tour-title");
});
document.getElementById("tour-skip")?.addEventListener("click", () => {
  if (tourBusy || tourStep !== 3) return;
  tourRun.variationSkipped = true; tourStep = 4; renderTour(); focusTour("tour-title");
});
document.getElementById("tour-panel")?.addEventListener("focusin", event => {
  if (event.target.matches("button, input, .tour-source, .record-table-wrap, summary")) {
    event.target.scrollIntoView({block: "nearest", behavior: "instant"});
  }
});
document.getElementById("tour-panel")?.addEventListener("keydown", event => {
  if (event.key === "Escape") { event.preventDefault(); closeTour(); }
});

// Keep keyboard focus inside the identity chooser while it covers the app.
document.getElementById("login-screen")?.addEventListener("keydown",event=>{
  if(event.key==="Escape" && can("lab_enabled")){document.getElementById("guest-link").click();return;}
  if(event.key!=="Tab")return;
  const items=Array.from(event.currentTarget.querySelectorAll('button:not(:disabled), select:not(:disabled), a[href], input:not(:disabled)')).filter(el=>!el.closest("[hidden]"));
  if(!items.length)return;
  const first=items[0],last=items.at(-1);
  if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}
  else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}
});

// Custom workspaces can authenticate private accounts without publishing cards.
document.getElementById("login-form")?.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = document.getElementById("login-submit");
  const error = document.getElementById("login-form-error");
  submit.disabled = true;
  error.hidden = true;
  try {
    const response = await apiFetch(`${API_BASE}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: document.getElementById("login-username").value,
        password: document.getElementById("login-password").value, workspace: CURRENT_WORKSPACE })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.detail || `Sign-in failed (${response.status}).`);
    }
    document.getElementById("login-password").value = "";
    sessionStorage.removeItem("qt_guest");
    location.reload();
  } catch (failure) {
    error.textContent = failure.message || "Sign-in failed. Check the account and try again.";
    error.hidden = false;
    submit.disabled = false;
  }
});

const appHeader = document.querySelector(".header");
function syncHeaderHeight() {
  const height = getComputedStyle(appHeader).position === "sticky" ? appHeader.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty("--header-height", `${height}px`);
}
new ResizeObserver(syncHeaderHeight).observe(appHeader);

document.addEventListener("click", event => {
  const menu = document.getElementById("tools-menu");
  if (!menu.contains(event.target)) menu.open = false;
});
document.getElementById("tools-menu").addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.currentTarget.open = false;
    event.currentTarget.querySelector("summary").focus();
    event.stopPropagation();
  }
});
