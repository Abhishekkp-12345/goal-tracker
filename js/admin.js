'use strict';

// ══════════════════ COMPLETION DASHBOARD ══════════════════
route('/admin/completion', () => {
  const user = Auth.require(['admin']); if (!user) return;
  setTitle('Completion Dashboard');
  const employees = DB.getAllEmployees();
  const managers  = DB.getAllManagers();
  const quarters  = ['Q1','Q2','Q3','Q4'];
  const cycle     = DB.getCycleByYear(2026);
  const phase     = getActivePhase(cycle);

  function ciStatus(emp, q) {
    const sheet = DB.getSheetByEmployee(emp.id, 2026);
    if (!sheet || sheet.status !== 'approved') return 'no_sheet';
    const goals = DB.getGoalsBySheet(sheet.id).filter(g=>g.isLocked);
    if (!goals.length) return 'no_goals';
    const done = goals.every(g => DB.getCheckIn(g.id, q));
    return done ? 'done' : 'pending';
  }

  function mgrCiStatus(mgr, q) {
    const team = DB.getEmployeesByManager(mgr.id);
    if (!team.length) return 'no_team';
    const allCommented = team.every(emp => {
      const sheet = DB.getSheetByEmployee(emp.id, 2026);
      const goals = sheet ? DB.getGoalsBySheet(sheet.id).filter(g=>g.isLocked) : [];
      return goals.every(g => { const ci=DB.getCheckIn(g.id,q); return ci && ci.managerComment; });
    });
    return allCommented ? 'done' : 'pending';
  }

  const statusBadge = (s) => ({
    done: '<span class="badge badge-approved">✓ Done</span>',
    pending: '<span class="badge badge-submitted">Pending</span>',
    no_sheet: '<span class="badge badge-draft">No Sheet</span>',
    no_goals: '<span class="badge badge-draft">No Goals</span>',
    no_team: '<span class="badge badge-draft">No Team</span>',
  }[s] || '—');

  // Escalation: employees without submitted goals >14 days after phase1 opened
  const phase1Open = cycle?.phase1Open ? new Date(cycle.phase1Open) : null;
  const daysSinceOpen = phase1Open ? Math.floor((new Date()-phase1Open)/86400000) : 0;
  const escalations = employees.filter(e => {
    const s = DB.getSheetByEmployee(e.id,2026);
    return !s || s.status === 'draft';
  });

  setContent(`
    <div class="page-header"><div><h2>Completion Dashboard</h2><p>Real-time view of goal sheet and check-in status across the organisation</p></div></div>

    ${escalations.length > 0 && daysSinceOpen > 7 ? `
    <div class="alert alert-danger">
      🚨 <strong>Escalation:</strong> ${escalations.length} employee(s) have not submitted their goal sheet yet —
      ${daysSinceOpen} days since Phase 1 opened.
      <ul style="margin-top:6px;padding-left:20px">${escalations.map(e=>`<li>${e.name} (${e.department})</li>`).join('')}</ul>
    </div>` : ''}

    <div class="card mb-3">
      <div class="card-header"><h3>Employee Check-in Status</h3></div>
      <div class="card-body" style="padding:0"><div class="table-wrap"><table>
        <thead><tr><th>Employee</th><th>Dept</th><th>Sheet</th>${quarters.map(q=>`<th>${q}</th>`).join('')}</tr></thead>
        <tbody>${employees.map(e => {
          const s = DB.getSheetByEmployee(e.id,2026);
          return `<tr>
            <td class="fw-600">${e.name}</td>
            <td>${e.department}</td>
            <td><span class="badge badge-${s?.status||'draft'}">${s?.status||'None'}</span></td>
            ${quarters.map(q=>`<td>${statusBadge(ciStatus(e,q))}</td>`).join('')}
          </tr>`;
        }).join('')}</tbody>
      </table></div></div>
    </div>

    <div class="card mb-3">
      <div class="card-header"><h3>Manager Check-in Comments Status</h3></div>
      <div class="card-body" style="padding:0"><div class="table-wrap"><table>
        <thead><tr><th>Manager</th><th>Team Size</th>${quarters.map(q=>`<th>${q} Comments</th>`).join('')}</tr></thead>
        <tbody>${managers.map(m => {
          const team = DB.getEmployeesByManager(m.id);
          return `<tr>
            <td class="fw-600">${m.name}</td>
            <td>${team.length} direct reports</td>
            ${quarters.map(q=>`<td>${statusBadge(mgrCiStatus(m,q))}</td>`).join('')}
          </tr>`;
        }).join('')}</tbody>
      </table></div></div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Goal Lock / Unlock (Admin Override)</h3></div>
      <div class="card-body">
        <div class="alert alert-warning" style="margin-bottom:16px">Unlocking a goal allows the employee to edit it. All changes are logged in the Audit Trail.</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Employee</th><th>Goal Title</th><th>Thrust Area</th><th>Lock Status</th><th>Action</th></tr></thead>
          <tbody id="goal-lock-table">${renderGoalLockRows()}</tbody>
        </table></div>
      </div>
    </div>
  `);
});

window.renderCompletionDashboard = function() { navigate('/admin/completion'); };

function renderGoalLockRows() {
  const goals = DB.getGoals().filter(g => {
    const sheet = DB.getSheetByEmployee(g.employeeId, 2026);
    return sheet?.status === 'approved';
  });
  if (!goals.length) return `<tr><td colspan="5" style="text-align:center;color:var(--t3);padding:20px">No approved goals found.</td></tr>`;
  return goals.map(g => {
    const emp = DB.getUserById(g.employeeId);
    const locked = g.isLocked;
    return `<tr id="glr-${g.id}">
      <td class="fw-700">${emp?.name||'—'}</td>
      <td>${g.title}</td>
      <td>${g.thrustArea}</td>
      <td>${locked ? '<span class="badge badge-locked">🔒 Locked</span>' : '<span class="badge badge-unlocked">🔓 Unlocked</span>'}</td>
      <td><button class="btn btn-sm ${locked?'btn-warning':'btn-ghost'}" onclick="toggleGoalLock('${g.id}')">${locked?'Unlock':'Lock'}</button></td>
    </tr>`;
  }).join('');
}

window.toggleGoalLock = function(goalId) {
  const goal = DB.getGoalById(goalId);
  if (!goal) return;
  const wasLocked = goal.isLocked;
  goal.isLocked = !wasLocked;
  goal.updatedAt = new Date().toISOString();
  DB.saveGoal(goal);
  DB.addAudit({ userId: Auth.getUser().id, userName: Auth.getUser().name, action: wasLocked?'ADMIN_UNLOCK':'ADMIN_LOCK', entityType:'goal', entityId: goalId, field:'isLocked', oldValue: String(wasLocked), newValue: String(!wasLocked) });
  // Re-render just the table rows in-place
  const tbody = document.getElementById('goal-lock-table');
  if (tbody) tbody.innerHTML = renderGoalLockRows();
  showToast(wasLocked ? '🔓 Goal unlocked for editing.' : '🔒 Goal locked.', wasLocked?'warning':'success');
};


route('/admin/dashboard', () => {
  const user = Auth.require(['admin']); if (!user) return;
  setTitle('Admin Dashboard');
  const employees = DB.getAllEmployees();
  const sheets = employees.map(e => DB.getSheetByEmployee(e.id,2026));
  const approved = sheets.filter(s=>s?.status==='approved').length;
  const submitted = sheets.filter(s=>s?.status==='submitted').length;
  const drafts = sheets.filter(s=>!s||s.status==='draft').length;
  const allGoals = DB.getGoals();
  const audits = DB.getAudit().slice(0,5);
  const completionRate = employees.length ? Math.round(approved/employees.length*100) : 0;
  setContent(`
    <div class="stat-grid">
      <div class="stat-card p"><div class="stat-card-accent"></div><div class="stat-label">Total Employees</div><div class="stat-value">${employees.length}</div><div class="stat-sub">Across all departments</div></div>
      <div class="stat-card g"><div class="stat-card-accent"></div><div class="stat-label">Approved Sheets</div><div class="stat-value">${approved}</div><div class="stat-sub">Goals locked & finalised</div></div>
      <div class="stat-card a"><div class="stat-card-accent"></div><div class="stat-label">Pending Approval</div><div class="stat-value">${submitted}</div><div class="stat-sub">Awaiting manager review</div></div>
      <div class="stat-card s"><div class="stat-card-accent"></div><div class="stat-label">Total Goals</div><div class="stat-value">${allGoals.length}</div><div class="stat-sub">Across all employees</div></div>
    </div>
    <div class="card mb-3">
      <div class="card-header"><h3>Goal Sheet Completion Rate</h3><a href="#/admin/completion" class="btn btn-ghost btn-sm">Full Dashboard</a></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
          <div style="text-align:center;padding:20px;background:var(--g50);border-radius:var(--r);border:1px solid #A7F3D0">
            <div style="font-size:28px;font-weight:800;color:var(--green)">${approved}</div>
            <div class="text-sm" style="margin-top:4px;font-weight:600">Approved</div>
          </div>
          <div style="text-align:center;padding:20px;background:var(--a50);border-radius:var(--r);border:1px solid #FDE68A">
            <div style="font-size:28px;font-weight:800;color:var(--amber)">${submitted}</div>
            <div class="text-sm" style="margin-top:4px;font-weight:600">Pending</div>
          </div>
          <div style="text-align:center;padding:20px;background:var(--slate1);border-radius:var(--r);border:1px solid var(--border)">
            <div style="font-size:28px;font-weight:800;color:var(--t2)">${drafts}</div>
            <div class="text-sm" style="margin-top:4px;font-weight:600">Not Submitted</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:16px">
          <div class="progress-bar" style="flex:1;height:10px"><div class="progress-fill pf-green" style="width:${completionRate}%"></div></div>
          <span style="font-size:15px;font-weight:800;color:var(--green)">${completionRate}%</span>
        </div>
        <div class="text-sm mt-1">Goal sheet completion rate</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Recent Audit Activity</h3><a href="#/admin/audit" class="btn btn-ghost btn-sm">View All</a></div>
      <div class="card-body" style="padding:0">
        <div class="table-wrap"><table>
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th></tr></thead>
          <tbody>${audits.length ? audits.map(a=>`<tr>
            <td>${formatDateTime(a.ts)}</td><td>${a.userName||'—'}</td>
            <td><span class="badge badge-info">${a.action}</span></td>
            <td>${a.entityType} · ${a.field||''}</td>
          </tr>`).join('') : `<tr><td colspan="4" style="text-align:center;color:var(--t3);padding:24px">No activity yet</td></tr>`}</tbody>
        </table></div>
      </div>
    </div>`);
});

// ══════════════════ USER MANAGEMENT ══════════════════
route('/admin/users', () => {
  const user = Auth.require(['admin']); if (!user) return;
  setTitle('User Management');
  renderAdminUsers();
});

function renderAdminUsers() {
  const users = DB.getUsers();
  const managers = DB.getAllManagers();
  setContent(`
    <div class="page-header">
      <div><h2>User Management</h2><p>Manage employees, managers and administrators</p></div>
      <button class="btn btn-primary" onclick="openUserModal(null)">+ Add User</button>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>All Users (${users.length})</h3>
        <input id="user-search" type="text" placeholder="Search by name, email or role…" oninput="filterUsers()" style="padding:8px 14px;border:1.5px solid var(--border);border-radius:var(--r);font-family:inherit;font-size:13px;width:260px;outline:none;transition:border-color .15s" onfocus="this.style.borderColor='var(--p)'" onblur="this.style.borderColor='var(--border)'"/>
      </div>
      <div class="card-body" style="padding:0">
        <div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Manager</th><th>Actions</th></tr></thead>
          <tbody id="user-table-body">${renderUserRows(users)}</tbody>
        </table></div>
      </div>
    </div>`);
}

function renderUserRows(users) {
  return users.map(u=>{
    const mgr = u.managerId ? DB.getUserById(u.managerId) : null;
    return `<tr>
      <td><div class="fw-600">${u.name}</div><div class="text-sm">${u.designation||''}</div></td>
      <td>${u.email}</td>
      <td><span class="badge badge-${u.role==='admin'?'locked':u.role==='manager'?'submitted':'approved'}">${u.role}</span></td>
      <td>${u.department||'—'}</td>
      <td>${mgr?mgr.name:'—'}</td>
      <td class="td-actions">
        <button class="btn btn-ghost btn-sm" onclick='openUserModal(${JSON.stringify(u)})'>Edit</button>
        ${u.id!=='u_admin'?`<button class="btn btn-ghost btn-sm color-danger" onclick="deleteUserConfirm('${u.id}','${u.name}')">Delete</button>`:''}
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--t3);padding:24px">No users found.</td></tr>`;
}

window.filterUsers = function() {
  const q = document.getElementById('user-search')?.value.toLowerCase() || '';
  const filtered = DB.getUsers().filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    u.role.toLowerCase().includes(q) ||
    (u.department||'').toLowerCase().includes(q)
  );
  const tbody = document.getElementById('user-table-body');
  if (tbody) tbody.innerHTML = renderUserRows(filtered);
};

window.openUserModal = function(u) {
  const managers = DB.getAllManagers();
  const isEdit = !!u;
  u = u || { name:'', email:'', password:'', role:'employee', department:'', designation:'', managerId:'' };
  openModal(isEdit?'Edit User':'Add User', `
    <div class="form-row">
      <div class="form-group"><label>Full Name *</label><input id="u-name" value="${u.name}" /></div>
      <div class="form-group"><label>Email *</label><input id="u-email" type="email" value="${u.email}" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Password *</label><input id="u-pass" type="text" value="${u.password}" placeholder="Set password" /></div>
      <div class="form-group"><label>Role *</label>
        <select id="u-role">
          <option value="employee" ${u.role==='employee'?'selected':''}>Employee</option>
          <option value="manager" ${u.role==='manager'?'selected':''}>Manager</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>Admin/HR</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Department</label><input id="u-dept" value="${u.department||''}" /></div>
      <div class="form-group"><label>Designation</label><input id="u-desig" value="${u.designation||''}" /></div>
    </div>
    <div class="form-group"><label>Reports To (Manager)</label>
      <select id="u-mgr">
        <option value="">— None —</option>
        ${managers.map(m=>`<option value="${m.id}" ${u.managerId===m.id?'selected':''}>${m.name}</option>`).join('')}
      </select>
    </div>
    <div id="u-err" class="form-error" style="display:none"></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveUser('${u.id||''}')">Save</button>`);
};

window.saveUser = function(existingId) {
  const errEl = document.getElementById('u-err');
  const name  = document.getElementById('u-name').value.trim();
  const email = document.getElementById('u-email').value.trim();
  const pass  = document.getElementById('u-pass').value.trim();
  const role  = document.getElementById('u-role').value;
  const dept  = document.getElementById('u-dept').value.trim();
  const desig = document.getElementById('u-desig').value.trim();
  const mgr   = document.getElementById('u-mgr').value;
  if (!name||!email||!pass) { errEl.textContent='Name, email and password are required.'; errEl.style.display='block'; return; }
  const u = { id: existingId||DB.id('u'), name, email, password:pass, role, department:dept, designation:desig, managerId:mgr||null };
  DB.saveUser(u);
  closeModal(); showToast('User saved.','success'); renderAdminUsers();
};

window.deleteUserConfirm = function(id, name) {
  openModal('Delete User',`<p>Delete <strong>${name}</strong>? This cannot be undone.</p>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" onclick="doDeleteUser('${id}')">Delete</button>`);
};
window.doDeleteUser = function(id) { DB.deleteUser(id); closeModal(); showToast('User deleted.','success'); renderAdminUsers(); };

// ══════════════════ CYCLE CONFIG ══════════════════
route('/admin/cycles', () => {
  const user = Auth.require(['admin']); if (!user) return;
  setTitle('Cycle Configuration');
  renderCycles();
});

function renderCycles() {
  let cycle = DB.getCycleByYear(2026) || { id:'cy_2026',year:2026,phase1Open:'2026-05-01',phase1Close:'2026-06-30',q1Open:'2026-07-01',q1Close:'2026-07-31',q2Open:'2026-10-01',q2Close:'2026-10-31',q3Open:'2027-01-01',q3Close:'2027-01-31',q4Open:'2027-03-01',q4Close:'2027-04-30' };
  const phase = getActivePhase(cycle);
  const fields = [
    { key:'phase1', label:'Phase 1 — Goal Setting', openKey:'phase1Open', closeKey:'phase1Close' },
    { key:'q1', label:'Q1 Check-in (July)', openKey:'q1Open', closeKey:'q1Close' },
    { key:'q2', label:'Q2 Check-in (October)', openKey:'q2Open', closeKey:'q2Close' },
    { key:'q3', label:'Q3 Check-in (January)', openKey:'q3Open', closeKey:'q3Close' },
    { key:'q4', label:'Q4 / Annual (March–April)', openKey:'q4Open', closeKey:'q4Close' },
  ];
  setContent(`
    <div class="page-header"><div><h2>Cycle Configuration — FY 2026</h2><p>Configure check-in windows and phase dates</p></div></div>
    ${phase ? `<div class="alert alert-success">✓ Currently active: <strong>${phase.name}</strong> (${formatDate(phase.open)} – ${formatDate(phase.close)})</div>` : '<div class="alert alert-warning">No phase is currently active.</div>'}
    <div class="card">
      <div class="card-header"><h3>Check-in Windows</h3></div>
      <div class="card-body">
        <div class="table-wrap"><table>
          <thead><tr><th>Phase</th><th>Window Opens</th><th>Window Closes</th><th>Status</th></tr></thead>
          <tbody>${fields.map(f=>`<tr>
            <td class="fw-600">${f.label}</td>
            <td><input type="date" id="cy-${f.openKey}" value="${cycle[f.openKey]||''}" class="inline-edit" style="border:1.5px solid var(--border);padding:4px 8px;border-radius:4px" /></td>
            <td><input type="date" id="cy-${f.closeKey}" value="${cycle[f.closeKey]||''}" class="inline-edit" style="border:1.5px solid var(--border);padding:4px 8px;border-radius:4px" /></td>
            <td>${phase?.key===f.key ? '<span class="badge badge-approved">Active Now</span>' : '<span class="badge badge-draft">Inactive</span>'}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        <div style="text-align:right;margin-top:16px">
          <button class="btn btn-primary" onclick="saveCycle()">Save Configuration</button>
        </div>
      </div>
    </div>`);
}

window.saveCycle = function() {
  let cycle = DB.getCycleByYear(2026) || { id:'cy_2026', year:2026 };
  ['phase1Open','phase1Close','q1Open','q1Close','q2Open','q2Close','q3Open','q3Close','q4Open','q4Close'].forEach(k=>{
    const el = document.getElementById('cy-'+k); if(el) cycle[k]=el.value;
  });
  DB.saveCycle(cycle); showToast('Cycle configuration saved.','success'); renderCycles();
};

// ══════════════════ AUDIT TRAIL ══════════════════
route('/admin/audit', () => {
  const user = Auth.require(['admin']); if (!user) return;
  setTitle('Audit Trail');
  const logs = DB.getAudit();
  setContent(`
    <div class="page-header"><div><h2>Audit Trail</h2><p>All changes made to goals after lock date</p></div></div>
    <div class="card">
      <div class="card-body" style="padding:0">
        <div class="table-wrap"><table>
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Field</th><th>Old Value</th><th>New Value</th></tr></thead>
          <tbody>${logs.length ? logs.map(a=>`<tr>
            <td style="white-space:nowrap">${formatDateTime(a.ts)}</td>
            <td>${a.userName||'—'}</td>
            <td><span class="badge badge-info">${a.action}</span></td>
            <td>${a.entityType}</td>
            <td>${a.field||'—'}</td>
            <td style="color:var(--danger)">${a.oldValue||'—'}</td>
            <td style="color:var(--success)">${a.newValue||'—'}</td>
          </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:32px">No audit entries yet.</td></tr>`}</tbody>
        </table></div>
      </div>
    </div>`);
});

// ══════════════════ ACHIEVEMENT REPORT ══════════════════
route('/admin/reports', () => {
  const user = Auth.require(['admin']); if (!user) return;
  setTitle('Achievement Report');
  const employees = DB.getAllEmployees();
  const quarters = ['Q1','Q2','Q3','Q4'];
  let selQ = 'Q1';
  setContent(`
    <div class="page-header">
      <div><h2>Achievement Report</h2><p>Planned vs Actual for all employees</p></div>
      <div class="flex gap-2">
        <button class="btn btn-ghost" onclick="printReport()">🖨 Print / PDF</button>
        <button class="btn btn-success" onclick="exportCSV()">⬇ Export CSV</button>
      </div>
    </div>
    <div class="tabs" id="rpt-tabs">
      ${quarters.map(q=>`<div class="tab ${q===selQ?'active':''}" onclick="switchRptTab('${q}')">${q}</div>`).join('')}
    </div>
    <div id="rpt-content">${renderReport(employees,'Q1')}</div>`);
});

window.switchRptTab = function(q) {
  document.querySelectorAll('#rpt-tabs .tab').forEach(t=>t.classList.toggle('active',t.textContent===q));
  document.getElementById('rpt-content').innerHTML = renderReport(DB.getAllEmployees(),q);
};

function renderReport(employees, quarter) {
  const rows = [];
  employees.forEach(e => {
    const sheet = DB.getSheetByEmployee(e.id,2026);
    if (!sheet) return;
    const goals = DB.getGoalsBySheet(sheet.id).filter(g=>g.isLocked);
    goals.forEach(g => {
      const ci = DB.getCheckIn(g.id,quarter);
      const score = computeScore(g,ci);
      const uomSuffix = {pct_min:'%',pct_max:'%'}[g.uomType]||'';
      rows.push({ emp:e.name, dept:e.department, goal:g.title, thrust:g.thrustArea, uom:getUomLabel(g.uomType), target:(g.uomType==='timeline'?formatDate(g.targetDate):(g.target||'—')+uomSuffix), weightage:g.weightage+'%', actual:ci?(g.uomType==='timeline'?formatDate(ci.completionDate):(ci.actual??'—')+uomSuffix):'—', status:ci?.status||'not_started', score:score!==null?score+'%':'—' });
    });
  });
  if (!rows.length) return `<div class="empty-state"><div class="empty-icon">📊</div><p>No approved goals with check-ins for ${quarter} yet.</p></div>`;
  return `<div class="card"><div class="card-body" style="padding:0"><div class="table-wrap"><table>
    <thead><tr><th>Employee</th><th>Dept</th><th>Goal</th><th>UoM</th><th>Target</th><th>Actual</th><th>Weight</th><th>Status</th><th>Score</th></tr></thead>
    <tbody>${rows.map(r=>`<tr>
      <td class="fw-600">${r.emp}</td><td>${r.dept}</td><td>${r.goal}</td>
      <td style="white-space:nowrap">${r.uom}</td>
      <td>${r.target}</td><td>${r.actual}</td><td>${r.weightage}</td>
      <td><span class="badge badge-${r.status}">${r.status.replace('_',' ')}</span></td>
      <td>${r.score!=='—'?`<span class="score-chip ${parseInt(r.score)>=80?'chip-green':parseInt(r.score)>=50?'chip-amber':'chip-red'}">${r.score}</span>`:'—'}</td>
    </tr>`).join('')}</tbody>
  </table></div></div></div>`;
}

window.exportCSV = function() {
  const quarter = document.querySelector('#rpt-tabs .tab.active')?.textContent||'Q1';
  const employees = DB.getAllEmployees();
  const rows = [['Employee','Department','Goal','Thrust Area','UoM','Target','Actual','Weightage','Status','Score']];
  employees.forEach(e => {
    const sheet = DB.getSheetByEmployee(e.id,2026);
    if (!sheet) return;
    DB.getGoalsBySheet(sheet.id).filter(g=>g.isLocked).forEach(g=>{
      const ci = DB.getCheckIn(g.id,quarter);
      const score = computeScore(g,ci);
      rows.push([e.name,e.department,g.title,g.thrustArea,getUomLabel(g.uomType),g.uomType==='timeline'?g.targetDate:g.target,ci?.actual??'',g.weightage+'%',ci?.status||'not_started',score!==null?score+'%':'']);
    });
  });
  const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download = `achievement_report_${quarter}.csv`;
  a.click();
  showToast('CSV exported successfully!','success');
};

window.printReport = function() {
  const quarter = document.querySelector('#rpt-tabs .tab.active')?.textContent||'Q1';
  const printContent = document.getElementById('rpt-content')?.innerHTML || '';
  const win = window.open('','_blank','width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head><title>Achievement Report — ${quarter}</title>
    <style>body{font-family:system-ui,sans-serif;padding:32px;color:#0F172A}table{width:100%;border-collapse:collapse}th,td{padding:8px 12px;border:1px solid #E2E8F0;font-size:12px}th{background:#F8FAFC;font-weight:700}h1{font-size:20px;margin-bottom:4px}p{color:#64748B;font-size:13px;margin-bottom:20px}.score-chip{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700}.chip-green{background:#D1FAE5;color:#065F46}.chip-amber{background:#FEF3C7;color:#92400E}.chip-red{background:#FEE2E2;color:#991B1B}.badge{padding:2px 8px;border-radius:12px;font-size:11px}</style>
    </head><body><h1>GoalTrack — Achievement Report</h1><p>Quarter: ${quarter} · FY 2026 · Generated: ${new Date().toLocaleDateString()}</p>${printContent}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(()=>{ win.print(); win.close(); }, 400);
};

// ══════════════════ ANALYTICS ══════════════════
route('/admin/analytics', () => {
  const user = Auth.require(['admin']); if (!user) return;
  setTitle('Analytics');
  const employees = DB.getAllEmployees();
  const allGoals  = DB.getGoals().filter(g=>g.isLocked);

  const thrustCount = {};
  allGoals.forEach(g=>{ thrustCount[g.thrustArea]=(thrustCount[g.thrustArea]||0)+1; });
  const uomCount = {};
  allGoals.forEach(g=>{ uomCount[g.uomType]=(uomCount[g.uomType]||0)+1; });

  const quarters = ['Q1','Q2','Q3','Q4'];
  const qCompletion = quarters.map(q => {
    const cis = DB.getCheckInsByQuarter(q);
    return { q, count: new Set(cis.map(c=>c.employeeId)).size };
  });

  const sheets = employees.map(e=>DB.getSheetByEmployee(e.id,2026));
  const approved = sheets.filter(s=>s?.status==='approved').length;
  const submitted = sheets.filter(s=>s?.status==='submitted').length;
  const drafts = sheets.filter(s=>!s||s.status==='draft').length;

  setContent(`
    <div class="page-header"><div><h2>Analytics</h2><p>Quarter-on-quarter trends and goal distribution</p></div></div>
    <div class="stat-grid">
      <div class="stat-card p"><div class="stat-card-accent"></div><div class="stat-label">Total Employees</div><div class="stat-value">${employees.length}</div><div class="stat-sub">Across all departments</div></div>
      <div class="stat-card g"><div class="stat-card-accent"></div><div class="stat-label">Locked Goals</div><div class="stat-value">${allGoals.length}</div><div class="stat-sub">Active goal count</div></div>
      <div class="stat-card a"><div class="stat-card-accent"></div><div class="stat-label">Thrust Areas Used</div><div class="stat-value">${Object.keys(thrustCount).length}</div><div class="stat-sub">Strategic focus areas</div></div>
      <div class="stat-card s"><div class="stat-card-accent"></div><div class="stat-label">Total Check-ins</div><div class="stat-value">${DB.getCheckIns().length}</div><div class="stat-sub">Filed across all quarters</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="card">
        <div class="card-header"><h3>Goal Sheet Status</h3></div>
        <div class="card-body" style="display:flex;align-items:center;justify-content:center;padding:24px">
          <canvas id="chartSheetStatus" width="220" height="220" style="max-width:220px"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Check-in Completion by Quarter</h3></div>
        <div class="card-body" style="padding:24px">
          <canvas id="chartQCompletion" height="180"></canvas>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="card">
        <div class="card-header"><h3>Goals by Thrust Area</h3></div>
        <div class="card-body" style="padding:24px">
          <canvas id="chartThrust" height="200"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>UoM Type Distribution</h3></div>
        <div class="card-body" style="display:flex;align-items:center;justify-content:center;padding:24px">
          <canvas id="chartUom" width="220" height="220" style="max-width:220px"></canvas>
        </div>
      </div>
    </div>
    <div class="card"><div class="card-header"><h3>Goal Sheet Status by Employee</h3></div>
      <div class="card-body" style="padding:0"><div class="table-wrap"><table>
        <thead><tr><th>Employee</th><th>Department</th><th>Manager</th><th>Sheet Status</th><th>Goals</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th></tr></thead>
        <tbody>${employees.map(e=>{
          const sheet = DB.getSheetByEmployee(e.id,2026);
          const goals = sheet?DB.getGoalsBySheet(sheet.id).filter(g=>g.isLocked):[];
          const mgr   = e.managerId?DB.getUserById(e.managerId):null;
          const qStatus = ['Q1','Q2','Q3','Q4'].map(q=>{
            if(!goals.length) return '—';
            const done = goals.every(g=>DB.getCheckIn(g.id,q));
            return done?'<span class="badge badge-approved">Done</span>':'<span class="badge badge-draft">Pending</span>';
          });
          return `<tr>
            <td class="fw-600">${e.name}</td>
            <td>${e.department}</td>
            <td>${mgr?.name||'—'}</td>
            <td><span class="badge badge-${sheet?.status||'draft'}">${sheet?.status||'Not Started'}</span></td>
            <td>${goals.length}</td>
            ${qStatus.map(s=>`<td>${s}</td>`).join('')}
          </tr>`;
        }).join('')}</tbody>
      </table></div></div>
    </div>`);

  // ── Draw Charts ─────────────────────────────────────────────
  requestAnimationFrame(() => {
    const PALETTE = ['#4F46E5','#10B981','#F59E0B','#0EA5E9','#EF4444','#8B5CF6','#06B6D4','#84CC16'];

    // Sheet status doughnut
    const ctxSheet = document.getElementById('chartSheetStatus')?.getContext('2d');
    if (ctxSheet) new Chart(ctxSheet, { type:'doughnut', data:{ labels:['Approved','Pending','Not Started'], datasets:[{ data:[approved,submitted,drafts], backgroundColor:['#10B981','#F59E0B','#94A3B8'], borderWidth:0, hoverOffset:6 }] }, options:{ cutout:'72%', plugins:{ legend:{ position:'bottom', labels:{ font:{family:'Outfit,Inter,sans-serif',size:12}, padding:16 } } } } });

    // Q completion bar
    const ctxQ = document.getElementById('chartQCompletion')?.getContext('2d');
    if (ctxQ) new Chart(ctxQ, { type:'bar', data:{ labels:qCompletion.map(q=>q.q), datasets:[{ label:'Employees with check-ins', data:qCompletion.map(q=>q.count), backgroundColor:['#4F46E5','#0EA5E9','#10B981','#F59E0B'], borderRadius:8, borderSkipped:false }] }, options:{ plugins:{ legend:{display:false} }, scales:{ y:{ beginAtZero:true, max:employees.length||5, ticks:{stepSize:1,font:{family:'Outfit,Inter,sans-serif'}}, grid:{color:'rgba(0,0,0,.05)'} }, x:{ grid:{display:false}, ticks:{font:{family:'Outfit,Inter,sans-serif'}} } } } });

    // Thrust area horizontal bar
    const thrustEntries = Object.entries(thrustCount).sort((a,b)=>b[1]-a[1]);
    const ctxThrust = document.getElementById('chartThrust')?.getContext('2d');
    if (ctxThrust) new Chart(ctxThrust, { type:'bar', data:{ labels:thrustEntries.map(([k])=>k), datasets:[{ label:'Goals', data:thrustEntries.map(([,v])=>v), backgroundColor:PALETTE, borderRadius:6, borderSkipped:false }] }, options:{ indexAxis:'y', plugins:{ legend:{display:false} }, scales:{ x:{ beginAtZero:true, ticks:{stepSize:1,font:{family:'Outfit,Inter,sans-serif'}}, grid:{color:'rgba(0,0,0,.05)'} }, y:{ grid:{display:false}, ticks:{font:{family:'Outfit,Inter,sans-serif',size:11}} } } } });

    // UoM doughnut
    const uomLabels = Object.keys(uomCount).map(k=>getUomLabel(k));
    const ctxUom = document.getElementById('chartUom')?.getContext('2d');
    if (ctxUom) new Chart(ctxUom, { type:'doughnut', data:{ labels:uomLabels, datasets:[{ data:Object.values(uomCount), backgroundColor:PALETTE, borderWidth:0, hoverOffset:6 }] }, options:{ cutout:'65%', plugins:{ legend:{ position:'bottom', labels:{ font:{family:'Outfit,Inter,sans-serif',size:11}, padding:12 } } } } });
  });
});

// ══════════════════ GOAL UNLOCK (standalone function kept for backward compat) ══════════════════
window.unlockGoal = function(goalId) {
  const goal = DB.getGoalById(goalId);
  if (!goal) return;
  goal.isLocked = false; goal.updatedAt = new Date().toISOString();
  DB.saveGoal(goal);
  DB.addAudit({ userId: Auth.getUser().id, userName: Auth.getUser().name, action:'ADMIN_UNLOCK', entityType:'goal', entityId:goalId, field:'isLocked', oldValue:'true', newValue:'false' });
  showToast('Goal unlocked.','success');
};
