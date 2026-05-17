'use strict';

// ── Toast ───────────────────────────────────────────────────────────
function showToast(msg, type='info') {
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

function handleRoute() {
  const hash = window.location.hash.replace('#','') || '/login';
  const [basePath, ...rest] = hash.split('?');
  const params = {};
  rest.join('?').split('&').forEach(p=>{ const [k,v]=p.split('='); if(k) params[k]=decodeURIComponent(v||''); });

  const user = Auth.getUser();

  // Not logged in — always show login
  if (!user) { showLoginPage(); return; }

  // Logged in but on login page — redirect to dashboard
  if (basePath === '/login') { navigate(`/${user.role}/dashboard`); return; }

  const fn = routes[basePath];
  if (fn) {
    updateSidebar(user, basePath);
    fn(params);
  } else {
    navigate(`/${user.role}/dashboard`);
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
document.addEventListener('DOMContentLoaded', () => {
  seedData();
  setupLoginPage();
  setupModalClose();

  window.addEventListener('hashchange', handleRoute);

  const user = Auth.getUser();
  if (!user) { showLoginPage(); }
  handleRoute();

  // Dismiss loading spinner
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';
    setTimeout(() => loader.remove(), 450);
  }
});

function setupModalClose() {
  const ov = document.getElementById('modal-overlay');
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
  ov.querySelector('.modal-close').addEventListener('click', closeModal);
}

function setupLoginPage() {
  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;
    const res   = Auth.login(email, pass);
    if (!res.ok) {
      document.getElementById('login-err').textContent = res.error;
    } else {
      navigate(`/${res.user.role}/dashboard`);
    }
  });

  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('login-email').value = btn.dataset.email;
      document.getElementById('login-pass').value  = btn.dataset.pass;
      // Auto-submit on single click for demo ease
      const res = Auth.login(btn.dataset.email, btn.dataset.pass);
      if (res.ok) navigate(`/${res.user.role}/dashboard`);
    });
  });

  document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());
}
