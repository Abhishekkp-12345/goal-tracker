'use strict';

// ── Toast ───────────────────────────────────────────────────────────
function showToast(msg, type='info') { // type: success | error | warning | info
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = {success:'✓',error:'✕',warning:'⚠',info:'ℹ'};
  t.innerHTML = `<span style="font-size:16px;color:var(--${type==='error'?'danger':type==='warning'?'warning':'success'})">${icons[type]||'ℹ'}</span><span class="toast-msg">${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>{ t.style.animation='fadeOut .3s ease forwards'; setTimeout(()=>t.remove(),300); }, 3500);
}

// ── Modal ────────────────────────────────────────────────────────────
function openModal(title, bodyHtml, footerHtml='') {
  const ov = document.getElementById('modal-overlay');
  ov.querySelector('.modal-header h3').textContent = title;
  ov.querySelector('.modal-body').innerHTML = bodyHtml;
  ov.querySelector('.modal-footer').innerHTML = footerHtml;
  ov.classList.add('open');
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

// ── Router ───────────────────────────────────────────────────────────
const routes = {};
function route(path, fn) { routes[path] = fn; }
function navigate(path) { window.location.hash = '#' + path; }

function showLoginPage() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

// Navigate to the user's dashboard — change hash then let handleRoute fire via hashchange
function goToDashboard(user) {
  const dashPath = `/${user.role}/dashboard`;
  const current  = window.location.hash.replace('#', '');
  if (current === dashPath) {
    // Hash hasn't changed — hashchange won't fire, call directly
    handleRoute();
  } else {
    window.location.hash = '#' + dashPath;
    // hashchange will fire handleRoute automatically
  }
}

function handleRoute() {
  const hash = window.location.hash.replace('#','') || '/login';
  const [basePath, ...rest] = hash.split('?');
  const params = {};
  rest.join('?').split('&').forEach(p=>{ const [k,v]=p.split('='); if(k) params[k]=decodeURIComponent(v||''); });

  const user = Auth.getUser();

  // Not logged in — show login
  if (!user) { showLoginPage(); return; }

  // On login page while already logged in — go to dashboard
  if (basePath === '/login' || basePath === '') {
    goToDashboard(user);
    return;
  }

  const fn = routes[basePath];
  if (fn) {
    updateSidebar(user, basePath);
    fn(params);
  } else {
    goToDashboard(user);
  }
}

// ── Sidebar ──────────────────────────────────────────────────────────
function updateSidebar(user, activePath) {
  const loginPage = document.getElementById('login-page');
  const appEl = document.getElementById('app');
  loginPage.style.display = 'none';
  appEl.style.display = 'flex';

  document.getElementById('sb-user-name').textContent = user.name;
  document.getElementById('sb-user-role').textContent = user.role.charAt(0).toUpperCase()+user.role.slice(1);
  const avatarEl = document.getElementById('sb-avatar');
  if (avatarEl) avatarEl.textContent = user.name.split(' ').map(w=>w[0]).join('').substr(0,2).toUpperCase();

  const cycle = DB.getCycleByYear(2026);
  const phase = getActivePhase(cycle);
  const phaseBadge = document.getElementById('phase-badge');
  const phaseText  = document.getElementById('phase-text');
  if (phase) {
    if (phaseText) phaseText.textContent = phase.name + ' Active';
    phaseBadge.style.display = 'flex';
  } else {
    phaseBadge.style.display = 'none';
  }

  const navEl = document.getElementById('sidebar-nav');
  const navItems = getSidebarNav(user.role);
  navEl.innerHTML = navItems.map(item => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    const active = activePath === item.path ? 'active' : '';
    return `<a class="nav-item ${active}" href="#${item.path}">${item.icon}${item.label}</a>`;
  }).join('');
}

function getSidebarNav(role) {
  const icon = (d) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${d}</svg>`;
  const ICONS = {
    dashboard: icon('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
    goals: icon('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>'),
    checkin: icon('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    team: icon('<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>'),
    approve: icon('<path d="M9 11l3 3L22 4"/><circle cx="12" cy="12" r="10"/>'),
    shared: icon('<path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>'),
    users: icon('<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>'),
    cycle: icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    report: icon('<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
    audit: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    analytics: icon('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'),
  };

  if (role === 'employee') return [
    { section: 'My Work' },
    { path:'/employee/dashboard', label:'Dashboard', icon:ICONS.dashboard },
    { path:'/employee/goals', label:'My Goal Sheet', icon:ICONS.goals },
    { path:'/employee/checkin', label:'Quarterly Check-in', icon:ICONS.checkin },
  ];
  if (role === 'manager') return [
    { section: 'Team Management' },
    { path:'/manager/dashboard', label:'Dashboard', icon:ICONS.dashboard },
    { path:'/manager/team', label:'Team Goals', icon:ICONS.team },
    { path:'/manager/checkin-review', label:'Check-in Review', icon:ICONS.checkin },
    { path:'/manager/shared-goal', label:'Push Shared Goal', icon:ICONS.shared },
  ];
  if (role === 'admin') return [
    { section: 'Administration' },
    { path:'/admin/dashboard', label:'Dashboard', icon:ICONS.dashboard },
    { path:'/admin/users', label:'User Management', icon:ICONS.users },
    { path:'/admin/cycles', label:'Cycle Configuration', icon:ICONS.cycle },
    { section: 'Reports & Compliance' },
    { path:'/admin/reports', label:'Achievement Report', icon:ICONS.report },
    { path:'/admin/completion', label:'Completion Dashboard', icon:ICONS.approve },
    { path:'/admin/analytics', label:'Analytics', icon:ICONS.analytics },
    { path:'/admin/audit', label:'Audit Trail', icon:ICONS.audit },
  ];
  return [];
}

function setContent(html) {
  document.getElementById('content').innerHTML = html;
}
function setTitle(t) {
  document.getElementById('page-title').textContent = t;
}

// ── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  seedData();
  setupLoginPage();
  setupModalClose();

  window.addEventListener('hashchange', handleRoute);

  // Helper: always dismiss the loader
  function dismissLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.style.opacity = '0';
      loader.style.pointerEvents = 'none';
      setTimeout(() => loader.remove(), 450);
    }
  }

  // Handle Google redirect result (when popup was blocked and redirect was used)
  // Wrap in a 3-second timeout so a slow/failed Firebase call never blocks the UI
  let redirectRes = null;
  try {
    redirectRes = await Promise.race([
      Auth.handleRedirectResult(),
      new Promise(resolve => setTimeout(() => resolve(null), 3000))
    ]);
  } catch (_) { redirectRes = null; }

  if (redirectRes && redirectRes.ok) {
    showToast(`Welcome, ${redirectRes.user.name}!`, 'success');
    goToDashboard(redirectRes.user);
    dismissLoader();
    return;
  }

  // handleRoute() will call showLoginPage() if no user — no need to duplicate it
  handleRoute();
  dismissLoader();
});


function setupModalClose() {
  const ov = document.getElementById('modal-overlay');
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
  ov.querySelector('.modal-close').addEventListener('click', closeModal);
}

function setupLoginPage() {
  let selectedRole = 'employee';

  // ── Panel switcher ──────────────────────────────────────────────────
  function showPanel(id) {
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  // ── Role card colours & labels ──────────────────────────────────────
  const ROLE_META = {
    admin:    { label:'Admin',    pill:'background:#EEF2FF;color:#4F46E5', subtitle:'Sign in to the Admin dashboard',    regSub:'Register as Admin — GoalTrack' },
    manager:  { label:'Manager',  pill:'background:#F0F9FF;color:#0EA5E9', subtitle:'Sign in to the Manager dashboard', regSub:'Register as Manager — GoalTrack' },
    employee: { label:'Employee', pill:'background:#ECFDF5;color:#065F46', subtitle:'Sign in to your Employee account', regSub:'Join GoalTrack as an Employee' },
  };

  // ── Role card click ─────────────────────────────────────────────────
  document.querySelectorAll('.role-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedRole = card.dataset.role;
      const meta = ROLE_META[selectedRole];
      const isEmployee = selectedRole === 'employee';
      const isPriv     = !isEmployee;

      // Login form: update pill + subtitle
      const pill = document.getElementById('signin-role-pill');
      const sub  = document.getElementById('signin-subtitle');
      if (pill) { pill.textContent = meta.label; pill.style.cssText = meta.pill; }
      if (sub)  sub.textContent = meta.subtitle;

      // Login form: access code field (Admin/Manager only)
      const codeGrp  = document.getElementById('access-code-group');
      const codeHint = document.getElementById('access-code-hint');
      const codeInp  = document.getElementById('login-access-code');
      if (codeGrp) codeGrp.style.display = isPriv ? 'block' : 'none';
      if (codeInp) codeInp.value = '';
      if (codeHint) codeHint.textContent = isPriv
        ? `Contact your administrator for the ${meta.label} access code.`
        : '';

      // Login form: Google + Employee register vs Privileged register
      const gBtn       = document.getElementById('google-signin-btn');
      const gDiv       = document.getElementById('google-divider');
      const regSwitch  = document.getElementById('register-switch');
      const privSwitch = document.getElementById('priv-register-switch');
      if (gBtn)       gBtn.style.display       = isEmployee ? 'flex'  : 'none';
      if (gDiv)       gDiv.style.display       = isEmployee ? 'flex'  : 'none';
      if (regSwitch)  regSwitch.style.display  = isEmployee ? 'block' : 'none';
      if (privSwitch) privSwitch.style.display = isPriv     ? 'block' : 'none';

      // Register form: update pill + subtitle + show/hide Google + code
      const regPill   = document.getElementById('reg-role-pill');
      const regSub    = document.getElementById('reg-subtitle');
      const gRegBtn   = document.getElementById('google-register-btn');
      const gRegDiv   = document.querySelector('#auth-register .lf-divider');
      const regCGrp   = document.getElementById('reg-access-code-group');
      const regCInp   = document.getElementById('reg-access-code');
      if (regPill) { regPill.textContent = meta.label; regPill.style.cssText = meta.pill; }
      if (regSub)  regSub.textContent = meta.regSub;
      if (gRegBtn) gRegBtn.style.display = isEmployee ? 'flex'  : 'none';
      if (gRegDiv) gRegDiv.style.display = isEmployee ? 'flex'  : 'none';
      if (regCGrp) regCGrp.style.display = isPriv     ? 'block' : 'none';
      if (regCInp) regCInp.value = '';

      // Clear errors
      ['login-err','register-err'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
      });

      showPanel('auth-signin');
    });
  });


  // ── Back links ──────────────────────────────────────────────────────
  const backToRoles    = document.getElementById('back-to-roles');
  const backToSignin   = document.getElementById('back-to-signin');
  const goRegister     = document.getElementById('go-register-link');
  const goPrivRegister = document.getElementById('go-priv-register-link');
  const goLogin        = document.getElementById('go-login-link');

  if (backToRoles)    backToRoles.addEventListener('click',    e => { e.preventDefault(); showPanel('auth-role-select'); });
  if (backToSignin)   backToSignin.addEventListener('click',   e => { e.preventDefault(); showPanel('auth-signin'); });
  if (goRegister)     goRegister.addEventListener('click',     e => { e.preventDefault(); showPanel('auth-register'); });
  if (goPrivRegister) goPrivRegister.addEventListener('click', e => { e.preventDefault(); showPanel('auth-register'); });
  if (goLogin)        goLogin.addEventListener('click',        e => { e.preventDefault(); showPanel('auth-signin'); });

  // ── Password show/hide ──────────────────────────────────────────────
  document.querySelectorAll('.toggle-pass').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.target);
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
  });

  // ── Forgot password ─────────────────────────────────────────────────
  const forgotLink = document.getElementById('forgot-pass-link');
  if (forgotLink) {
    forgotLink.addEventListener('click', async e => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      if (!email) { document.getElementById('login-err').textContent = 'Enter your email first.'; return; }
      try {
        await firebaseAuth.sendPasswordResetEmail(email);
        showToast('Password reset email sent! Check your inbox.', 'success');
      } catch (_) {
        showToast('Could not send reset email. Check the address.', 'error');
      }
    });
  }

  // ── Loading helper ──────────────────────────────────────────────────
  function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    const txt = btn.querySelector('.btn-text');
    const sp  = btn.querySelector('.btn-spinner');
    if (txt) txt.style.display = loading ? 'none' : '';
    if (sp)  sp.style.display  = loading ? 'inline-block' : 'none';
  }

  // ── Sign In ─────────────────────────────────────────────────────────
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email  = document.getElementById('login-email').value.trim();
      const pass   = document.getElementById('login-pass').value;
      const code   = (document.getElementById('login-access-code') || {}).value || '';
      const errEl  = document.getElementById('login-err');
      // Reset any green "success" styling from previous registration
      errEl.style.color = '';
      errEl.style.background = '';
      errEl.style.borderColor = '';
      errEl.textContent = '';
      setLoading('login-submit-btn', true);

      let res;
      if (selectedRole === 'employee') {
        res = await Auth.login(email, pass);
        // Confirm role
        if (res.ok && res.user.role !== 'employee') {
          Auth.logout();
          res = { ok: false, error: 'This account is not an Employee. Select the correct role.' };
        }
      } else {
        res = await Auth.loginWithCode(email, pass, selectedRole, code);
      }

      setLoading('login-submit-btn', false);
      if (!res.ok) {
        errEl.textContent = res.error;
      } else {
        showToast(`Welcome back, ${res.user.name}!`, 'success');
        goToDashboard(res.user);
      }
    });
  }

  // ── Register ────────────────────────────────────────────────────────
  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', async e => {
      e.preventDefault();
      const name  = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const pass  = document.getElementById('reg-pass').value;
      const pass2 = document.getElementById('reg-pass2').value;
      const code  = (document.getElementById('reg-access-code') || {}).value || '';
      const errEl = document.getElementById('register-err');
      errEl.textContent = '';
      if (!name)           { errEl.textContent = 'Please enter your full name.'; return; }
      if (pass !== pass2)  { errEl.textContent = 'Passwords do not match.'; return; }
      if (pass.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
      setLoading('register-submit-btn', true);

      let res;
      if (selectedRole === 'employee') {
        res = await Auth.register(name, email, pass, 'employee');
      } else {
        res = await Auth.registerWithCode(name, email, pass, selectedRole, code);
      }

      setLoading('register-submit-btn', false);
      if (!res.ok) {
        errEl.textContent = res.error;
      } else {
        // Sign out from Firebase cleanly
        try { await firebaseAuth.signOut(); } catch(_) {}
        DB.clearSession();

        // Pre-fill their email in the login form for convenience
        const loginEmailEl = document.getElementById('login-email');
        const loginPassEl  = document.getElementById('login-pass');
        if (loginEmailEl) loginEmailEl.value = email;
        if (loginPassEl)  loginPassEl.value  = '';
        if (loginPassEl)  loginPassEl.focus();

        // Clear the access-code field (for admin/manager re-login)
        const loginCodeEl = document.getElementById('login-access-code');
        if (loginCodeEl) loginCodeEl.value = '';

        // Show success message on login form
        const loginErrEl = document.getElementById('login-err');
        if (loginErrEl) {
          loginErrEl.style.color       = '#16a34a';
          loginErrEl.style.background  = '#f0fdf4';
          loginErrEl.style.border      = '1px solid #bbf7d0';
          loginErrEl.style.padding     = '10px 12px';
          loginErrEl.style.borderRadius= '8px';
          loginErrEl.textContent = `✓ Account created! Please enter your password and sign in.`;
        }

        // Go back to sign-in panel
        showPanel('auth-signin');
        showToast(`Registered successfully as ${res.user.name}!`, 'success');
      }
    });
  }

  // ── Google Sign-In ──────────────────────────────────────────────────
  async function handleGoogle(errElId) {
    const errEl = document.getElementById(errElId);
    if (errEl) errEl.textContent = '';
    const res = await Auth.loginWithGoogle();
    if (!res.ok) {
      if (errEl && res.error) errEl.textContent = res.error;
    } else {
      showToast(`Welcome, ${res.user.name}!`, 'success');
      goToDashboard(res.user);
    }
  }

  const gSignIn = document.getElementById('google-signin-btn');
  const gReg    = document.getElementById('google-register-btn');
  if (gSignIn) gSignIn.addEventListener('click', () => handleGoogle('login-err'));
  if (gReg)    gReg.addEventListener('click',    () => handleGoogle('register-err'));

  // ── Logout ──────────────────────────────────────────────────────────
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());
}


