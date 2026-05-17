'use strict';

// ═══════════════════════ MANAGER PAGES ═══════════════════════

// ── Dashboard ───────────────────────────────────────────────────────
route('/manager/dashboard', () => {
  const user = Auth.require(['manager']); if (!user) return;
  setTitle('Manager Dashboard');

  const team   = DB.getEmployeesByManager(user.id);
  const sheets = team.map(e => DB.getSheetByEmployee(e.id, 2026));
  const pending = sheets.filter(s => s?.status === 'submitted').length;
  const approved = sheets.filter(s => s?.status === 'approved').length;
  const cycle  = DB.getCycleByYear(2026);
  const phase  = getActivePhase(cycle);
  const qKey   = phase && ['q1','q2','q3','q4'].includes(phase?.key) ? phase.key.toUpperCase() : null;

  let ciCount = 0;
  if (qKey) {
    team.forEach(e => {
      const goals = (DB.getSheetByEmployee(e.id,2026) ? DB.getGoalsBySheet(DB.getSheetByEmployee(e.id,2026).id) : []).filter(g=>g.isLocked);
      if (goals.length > 0 && goals.every(g=>DB.getCheckIn(g.id,qKey))) ciCount++;
    });
  }

  setContent(`
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Team Members</div>
        <div class="stat-value accent">${team.length}</div>
        <div class="stat-sub">Direct reports</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">Pending Approval</div>
        <div class="stat-value">${pending}</div>
        <div class="stat-sub">Goal sheets awaiting review</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">Approved Sheets</div>
        <div class="stat-value">${approved}</div>
        <div class="stat-sub">of ${team.length} employees</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${qKey||'Q1'} Check-ins Done</div>
        <div class="stat-value">${ciCount}</div>
        <div class="stat-sub">of ${team.length} employees</div>
      </div>
    </div>

    ${pending > 0 ? `<div class="alert alert-warning">⚠️ <strong>${pending} goal sheet(s)</strong> are waiting for your approval. <a href="#/manager/team">Review now →</a></div>` : ''}

    <div class="card">
      <div class="card-header"><h3>Team Overview</h3><a href="#/manager/team" class="btn btn-ghost btn-sm">View All</a></div>
      <div class="card-body" style="padding:0">
        <div class="table-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Department</th><th>Goals</th><th>Sheet Status</th><th>Action</th></tr></thead>
          <tbody>
            ${team.map(e => {
              const s = DB.getSheetByEmployee(e.id,2026);
              const gc = s ? DB.getGoalsBySheet(s.id).length : 0;
              return `<tr>
                <td><div class="fw-600">${e.name}</div><div class="text-sm">${e.designation||''}</div></td>
                <td>${e.department}</td>
                <td>${gc}</td>
                <td><span class="badge badge-${s?.status||'draft'}">${s?.status||'Not Started'}</span></td>
                <td><a href="#/manager/review?emp=${e.id}" class="btn btn-ghost btn-sm">Review</a></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  `);
});

// ── Team Goals ──────────────────────────────────────────────────────
route('/manager/team', () => {
  const user = Auth.require(['manager']); if (!user) return;
  setTitle('Team Goals');

  const team = DB.getEmployeesByManager(user.id);

  setContent(`
    <div class="page-header"><div><h2>Team Goal Sheets</h2><p>Review and manage your team's goals</p></div></div>
    <div class="card">
      <div class="card-body" style="padding:0">
        <div class="table-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Department</th><th>Goals</th><th>Weightage</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
          <tbody>
            ${team.map(e => {
              const s = DB.getSheetByEmployee(e.id,2026);
              const goals = s ? DB.getGoalsBySheet(s.id) : [];
              const totalW = goals.reduce((sum,g)=>sum+g.weightage,0);
              return `<tr>
                <td><div class="fw-600">${e.name}</div><div class="text-sm">${e.designation||''}</div></td>
                <td>${e.department}</td>
                <td>${goals.length}/8</td>
                <td><span class="${totalW===100?'color-success':totalW>100?'color-danger':'color-warning'} fw-600">${totalW}%</span></td>
                <td><span class="badge badge-${s?.status||'draft'}">${s?.status||'Not Started'}</span></td>
                <td>${formatDate(s?.submittedAt)||'—'}</td>
                <td class="td-actions">
                  <a href="#/manager/review?emp=${e.id}" class="btn btn-primary btn-sm">
                    ${s?.status==='submitted'?'Review & Approve':'View'}
                  </a>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  `);
});

// ── Review Goal Sheet ───────────────────────────────────────────────
route('/manager/review', (params) => {
  const user = Auth.require(['manager']); if (!user) return;
  const emp  = DB.getUserById(params.emp);
  if (!emp) { navigate('/manager/team'); return; }
  setTitle(`Review: ${emp.name}`);
  renderManagerReview(user, emp);
});

function renderManagerReview(manager, emp) {
  const sheet = DB.getSheetByEmployee(emp.id, 2026);
  if (!sheet) { setContent(`<div class="alert alert-info">This employee has not created a goal sheet yet.</div>`); return; }
  const goals = DB.getGoalsBySheet(sheet.id);
  const totalW = goals.reduce((s,g)=>s+g.weightage,0);
  const canApprove = sheet.status === 'submitted' && totalW === 100;
  const isLocked   = sheet.status === 'approved';

  setContent(`
    <div class="page-header">
      <div>
        <a href="#/manager/team" class="btn btn-ghost btn-sm" style="margin-bottom:8px">← Back to Team</a>
        <h2>${emp.name}'s Goal Sheet</h2>
        <p>${emp.department} · ${emp.designation}</p>
      </div>
      <div class="flex gap-2">
        ${canApprove ? `
          <button class="btn btn-danger" onclick="returnSheet('${sheet.id}')">Return for Rework</button>
          <button class="btn btn-success" onclick="approveSheet('${sheet.id}','${manager.id}')">Approve Goals</button>
        ` : ''}
        ${isLocked ? `<span class="badge badge-approved" style="font-size:13px;padding:8px 14px">✓ Approved</span>` : ''}
      </div>
    </div>

    <div class="weight-tracker">
      <span class="wt-label">Total Weightage</span>
      <div class="flex items-center gap-2">
        <span class="wt-value ${totalW===100?'ok':totalW>100?'over':'warn'}">${totalW}%</span>
        <span class="text-sm">/ 100%</span>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-header"><h3>Goals (${goals.length})</h3></div>
      <div class="card-body" style="padding:0">
        <div class="table-wrap">
        <table id="goals-review-table">
          <thead><tr>
            <th>#</th><th>Thrust Area</th><th>Goal Title</th><th>UoM</th>
            <th>Target</th><th>Weightage %</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${goals.map((g,i) => {
              const uomSuffix = {pct_min:'%',pct_max:'%'}[g.uomType]||'';
              const targetDisplay = g.uomType==='timeline'?formatDate(g.targetDate):(g.target||'—')+uomSuffix;
              return `<tr>
                <td>${i+1}</td>
                <td>${g.thrustArea}</td>
                <td>
                  ${!isLocked && sheet.status==='submitted' ? `<input class="inline-edit" id="t-title-${g.id}" value="${g.title}" onchange="inlineEditGoal('${g.id}','title',this.value,'${sheet.id}','${manager.id}')">` : g.title}
                  ${g.isShared?'<span class="badge badge-info" style="margin-left:6px;font-size:10px">Shared</span>':''}
                </td>
                <td style="white-space:nowrap">${getUomLabel(g.uomType)}</td>
                <td>
                  ${!isLocked && sheet.status==='submitted' && g.uomType!=='timeline' && g.uomType!=='zero' ?
                    `<input class="inline-edit" type="number" id="t-target-${g.id}" value="${g.target}" style="width:70px" onchange="inlineEditGoal('${g.id}','target',this.value,'${sheet.id}','${manager.id}')">` :
                    targetDisplay}
                </td>
                <td>
                  ${!isLocked && sheet.status==='submitted' ?
                    `<input class="inline-edit" type="number" id="t-weight-${g.id}" value="${g.weightage}" style="width:60px" min="10" max="100" onchange="inlineEditGoal('${g.id}','weightage',this.value,'${sheet.id}','${manager.id}')">` :
                    g.weightage+'%'}
                </td>
                <td><span class="badge badge-${g.isLocked?'locked':'draft'}">${g.isLocked?'Locked':'Pending'}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        </div>
      </div>
    </div>

    ${sheet.status==='submitted' ? `
    <div class="card">
      <div class="card-header"><h3>Manager Note (Optional)</h3></div>
      <div class="card-body">
        <div class="form-group">
          <textarea id="mgr-note" placeholder="Add a note for the employee (shown when returning for rework)...">${sheet.managerNote||''}</textarea>
        </div>
      </div>
    </div>` : sheet.managerNote ? `<div class="alert alert-info"><strong>Note sent:</strong> ${sheet.managerNote}</div>` : ''}
  `);
}

window.inlineEditGoal = function(goalId, field, value, sheetId, managerId) {
  const goal = DB.getGoalById(goalId);
  if (!goal) return;
  const old = goal[field];
  if (field === 'weightage') {
    const sheet = DB.getSheetById(sheetId);
    const others = DB.getGoalsBySheet(sheetId).filter(g=>g.id!==goalId);
    const newTotal = others.reduce((s,g)=>s+g.weightage,0) + parseInt(value);
    if (newTotal > 100) { showToast(`Weightage would exceed 100% (total: ${newTotal}%).`,'error'); return; }
    if (parseInt(value) < 10) { showToast('Minimum weightage is 10%.','error'); return; }
    goal.weightage = parseInt(value);
  } else {
    goal[field] = value;
  }
  goal.updatedAt = new Date().toISOString();
  DB.saveGoal(goal);
  DB.addAudit({ userId: managerId, userName: DB.getUserById(managerId)?.name, action:'INLINE_EDIT', entityType:'goal', entityId: goalId, field, oldValue: String(old), newValue: String(value) });
};

window.approveSheet = function(sheetId, managerId) {
  const sheet = DB.getSheetById(sheetId);
  const goals  = DB.getGoalsBySheet(sheetId);
  const totalW = goals.reduce((s,g)=>s+g.weightage,0);
  if (totalW !== 100) { showToast('Cannot approve: total weightage must equal 100%.','error'); return; }

  sheet.status = 'approved';
  sheet.approvedAt = new Date().toISOString();
  sheet.approvedBy = managerId;
  DB.saveSheet(sheet);

  goals.forEach(g => { g.isLocked = true; g.updatedAt = new Date().toISOString(); DB.saveGoal(g); });

  DB.addAudit({ userId: managerId, userName: DB.getUserById(managerId)?.name, action:'APPROVED', entityType:'goalSheet', entityId: sheetId, field:'status', oldValue:'submitted', newValue:'approved' });
  showToast('Goal sheet approved and goals locked!', 'success');
  renderManagerReview(Auth.getUser(), DB.getUserById(DB.getSheetById(sheetId).employeeId));
};

window.returnSheet = function(sheetId) {
  const note = document.getElementById('mgr-note')?.value || '';
  const sheet = DB.getSheetById(sheetId);
  sheet.status = 'returned';
  sheet.managerNote = note;
  DB.saveSheet(sheet);
  DB.addAudit({ userId: Auth.getUser().id, userName: Auth.getUser().name, action:'RETURNED', entityType:'goalSheet', entityId: sheetId, field:'status', oldValue:'submitted', newValue:'returned' });
  showToast('Goal sheet returned to employee for rework.', 'warning');
  navigate('/manager/team');
};

// ── Check-in Review ─────────────────────────────────────────────────
route('/manager/checkin-review', () => {
  const user = Auth.require(['manager']); if (!user) return;
  setTitle('Check-in Review');

  const team = DB.getEmployeesByManager(user.id);
  const quarters = ['Q1','Q2','Q3','Q4'];
  let selQ = 'Q1';
  const cycle = DB.getCycleByYear(2026);
  const phase = getActivePhase(cycle);
  if (phase && ['q1','q2','q3','q4'].includes(phase?.key)) selQ = phase.key.toUpperCase();

  setContent(`
    <div class="page-header"><div><h2>Check-in Review</h2><p>View team progress and add check-in comments</p></div></div>
    <div class="tabs" id="mgr-ci-tabs">
      ${quarters.map(q=>`<div class="tab ${q===selQ?'active':''}" onclick="switchMgrCiTab('${q}')">${q}</div>`).join('')}
    </div>
    <div id="mgr-ci-content">${renderMgrCiTab(team, selQ, user)}</div>
  `);
});

window.switchMgrCiTab = function(q) {
  document.querySelectorAll('#mgr-ci-tabs .tab').forEach(t=>t.classList.toggle('active',t.textContent===q));
  const user = Auth.getUser();
  const team = DB.getEmployeesByManager(user.id);
  document.getElementById('mgr-ci-content').innerHTML = renderMgrCiTab(team, q, user);
};

function renderMgrCiTab(team, quarter, manager) {
  if (!team.length) return `<div class="empty-state"><p>No team members found.</p></div>`;

  return team.map(emp => {
    const sheet = DB.getSheetByEmployee(emp.id, 2026);
    const goals = sheet ? DB.getGoalsBySheet(sheet.id).filter(g=>g.isLocked) : [];
    if (!goals.length) return `<div class="card mb-3"><div class="card-header"><h3>${emp.name}</h3></div><div class="card-body"><p class="text-sm">No approved goals.</p></div></div>`;

    const rows = goals.map(g => {
      const ci = DB.getCheckIn(g.id, quarter);
      const score = computeScore(g, ci);
      const uomSuffix = {pct_min:'%',pct_max:'%'}[g.uomType]||'';
      const targetDisplay = g.uomType==='timeline'?formatDate(g.targetDate):(g.target||'—')+uomSuffix;
      const actual = ci ? (g.uomType==='timeline' ? formatDate(ci.completionDate) : (ci.actual??'—')+uomSuffix) : '—';
      return `<tr>
        <td>${g.title}</td>
        <td>${targetDisplay}</td>
        <td>${actual}</td>
        <td>${ci ? `<span class="badge badge-${ci.status}">${ci.status.replace('_',' ')}</span>` : '—'}</td>
        <td>${score !== null ? `<span class="score-chip ${score>=80?'chip-green':score>=50?'chip-amber':'chip-red'}">${score}%</span>` : '—'}</td>
      </tr>`;
    }).join('');

    const firstGoalCi = DB.getCheckIn(goals[0].id, quarter);
    const existingComment = firstGoalCi?.managerComment || '';

    return `<div class="card mb-3">
      <div class="card-header">
        <h3>${emp.name} — ${quarter}</h3>
        <span class="badge badge-${sheet.status}">${sheet.status}</span>
      </div>
      <div class="card-body" style="padding:0">
        <div class="table-wrap"><table>
          <thead><tr><th>Goal</th><th>Target</th><th>Actual</th><th>Status</th><th>Score</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <div style="padding:16px;border-top:1px solid var(--border)">
          <div class="form-group" style="margin-bottom:8px">
            <label>Check-in Comment</label>
            <textarea id="mgr-comment-${emp.id}-${quarter}" placeholder="Add structured feedback for this quarter...">${existingComment}</textarea>
          </div>
          <button class="btn btn-primary btn-sm" onclick="saveMgrComment('${emp.id}','${quarter}')">Save Comment</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.saveMgrComment = function(empId, quarter) {
  const comment = document.getElementById(`mgr-comment-${empId}-${quarter}`)?.value || '';
  const sheet   = DB.getSheetByEmployee(empId, 2026);
  const goals   = sheet ? DB.getGoalsBySheet(sheet.id).filter(g=>g.isLocked) : [];
  goals.forEach(g => {
    const ci = DB.getCheckIn(g.id, quarter);
    if (ci) { ci.managerComment = comment; ci.updatedAt = new Date().toISOString(); DB.saveCheckIn(ci); }
  });
  showToast('Check-in comment saved.', 'success');
};

// ── Push Shared Goal ────────────────────────────────────────────────
route('/manager/shared-goal', () => {
  const user = Auth.require(['manager','admin']); if (!user) return;
  setTitle('Push Shared Goal');

  const employees = user.role === 'manager' ? DB.getEmployeesByManager(user.id) : DB.getAllEmployees();
  const thrustAreas = DB.getThrustAreas();

  setContent(`
    <div class="page-header"><div><h2>Push Shared Goal</h2><p>Push a departmental KPI to multiple employees</p></div></div>
    <div class="alert alert-info">Recipients can adjust <strong>weightage only</strong>. Goal title and target are read-only for them.</div>
    <div class="card">
      <div class="card-header"><h3>Shared Goal Details</h3></div>
      <div class="card-body">
        <div class="form-group"><label>Thrust Area</label>
          <select id="sg-thrust">${thrustAreas.map(a=>`<option>${a}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Goal Title *</label>
          <input id="sg-title" type="text" placeholder="e.g. Department Revenue Target" />
        </div>
        <div class="form-group"><label>Description</label>
          <textarea id="sg-desc" placeholder="Describe the KPI..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group"><label>UoM Type</label>
            <select id="sg-uom">
              <option value="numeric_min">Numeric — Higher is Better</option>
              <option value="numeric_max">Numeric — Lower is Better</option>
              <option value="pct_min">% — Higher is Better</option>
              <option value="pct_max">% — Lower is Better</option>
              <option value="timeline">Timeline</option>
              <option value="zero">Zero-based</option>
            </select>
          </div>
          <div class="form-group"><label>Target</label>
            <input id="sg-target" type="text" placeholder="Target value or date" />
          </div>
        </div>
        <div class="form-group"><label>Default Weightage (%)</label>
          <input id="sg-weight" type="number" min="10" max="100" value="15" />
        </div>
        <hr style="margin:16px 0;border:none;border-top:1px solid var(--border)">
        <div class="form-group"><label>Select Employees to Push To</label>
          <div style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;max-height:200px;overflow-y:auto">
            ${employees.map(e => `
              <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer">
                <input type="checkbox" id="sg-emp-${e.id}" value="${e.id}">
                <span>${e.name} <span class="text-sm">(${e.department})</span></span>
              </label>`).join('')}
          </div>
        </div>
        <div id="sg-err" class="form-error" style="display:none"></div>
        <div style="text-align:right;margin-top:16px">
          <button class="btn btn-primary" onclick="pushSharedGoal()">Push Goal to Selected Employees</button>
        </div>
      </div>
    </div>
  `);
});

window.pushSharedGoal = function() {
  const errEl  = document.getElementById('sg-err');
  const title  = document.getElementById('sg-title').value.trim();
  const thrust = document.getElementById('sg-thrust').value;
  const uom    = document.getElementById('sg-uom').value;
  const target = document.getElementById('sg-target').value.trim();
  const desc   = document.getElementById('sg-desc').value.trim();
  const weight = parseInt(document.getElementById('sg-weight').value)||0;

  const selectedEmps = [...document.querySelectorAll('[id^="sg-emp-"]:checked')].map(c=>c.value);

  if (!title) { errEl.textContent='Title is required.'; errEl.style.display='block'; return; }
  if (weight < 10) { errEl.textContent='Minimum weightage is 10%.'; errEl.style.display='block'; return; }
  if (selectedEmps.length === 0) { errEl.textContent='Select at least one employee.'; errEl.style.display='block'; return; }
  errEl.style.display = 'none';

  const srcId = DB.id('sg');
  const now   = new Date().toISOString();
  let pushed = 0;

  selectedEmps.forEach(empId => {
    let sheet = DB.getSheetByEmployee(empId, 2026);
    if (!sheet) {
      sheet = { id: DB.id('gs'), employeeId: empId, cycleYear: 2026, status:'draft', submittedAt:null, approvedAt:null, approvedBy:null, managerNote:'' };
      DB.saveSheet(sheet);
    }
    const existing = DB.getGoalsBySheet(sheet.id);
    if (existing.length >= 8) { showToast(`${DB.getUserById(empId)?.name} already has 8 goals. Skipped.`, 'warning'); return; }
    if (sheet.status === 'approved') { showToast(`${DB.getUserById(empId)?.name}'s sheet is locked. Skipped.`, 'warning'); return; }

    const g = { id: DB.id('g'), sheetId: sheet.id, employeeId: empId, thrustArea: thrust, title, description: desc, uomType: uom, target, targetDate:'', weightage: weight, isLocked: false, isShared: true, sharedFromId: srcId, createdAt: now, updatedAt: now };
    DB.saveGoal(g);
    pushed++;
    DB.addAudit({ userId: Auth.getUser().id, userName: Auth.getUser().name, action:'PUSH_SHARED_GOAL', entityType:'goal', entityId: g.id, field:'isShared', oldValue:'false', newValue:'true' });
  });

  showToast(`Shared goal pushed to ${pushed} employee(s)!`, 'success');
  navigate('/manager/team');
};
