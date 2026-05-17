'use strict';

// ═══════════════════════ EMPLOYEE PAGES ═══════════════════════

// ── Dashboard ───────────────────────────────────────────────────────
route('/employee/dashboard', () => {
  const user = Auth.require(['employee']); if (!user) return;
  setTitle('My Dashboard');
  const sheet = DB.getSheetByEmployee(user.id, 2026);
  const goals = sheet ? DB.getGoalsBySheet(sheet.id) : [];
  const cis    = DB.getCheckInsByEmployee(user.id);
  const cycle  = DB.getCycleByYear(2026);
  const phase  = getActivePhase(cycle);
  const totalW = goals.reduce((s,g)=>s+g.weightage,0);

  const statusColors = {draft:'warning',submitted:'info',approved:'success',returned:'danger'};
  const sheetStatus  = sheet ? sheet.status : 'not started';

  setContent(`
    <div class="stat-grid">
      <div class="stat-card accent">
        <div class="stat-label">Total Goals</div>
        <div class="stat-value">${goals.length}</div>
        <div class="stat-sub">of 8 maximum</div>
      </div>
      <div class="stat-card ${statusColors[sheetStatus]||''}">
        <div class="stat-label">Goal Sheet Status</div>
        <div class="stat-value" style="font-size:18px;text-transform:capitalize">${sheetStatus}</div>
        <div class="stat-sub">${sheet?.submittedAt ? 'Submitted '+formatDate(sheet.submittedAt) : 'Not yet submitted'}</div>
      </div>
      <div class="stat-card ${totalW===100?'success':'warning'}">
        <div class="stat-label">Total Weightage</div>
        <div class="stat-value">${totalW}%</div>
        <div class="stat-sub">${totalW===100?'✓ Balanced':'Must equal 100%'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Check-ins Filed</div>
        <div class="stat-value">${[...new Set(cis.map(c=>c.quarter))].length}</div>
        <div class="stat-sub">Quarters completed</div>
      </div>
    </div>

    ${phase ? `<div class="alert alert-info mb-3">📅 <strong>${phase.name}</strong> is currently active (${formatDate(phase.open)} – ${formatDate(phase.close)}).</div>` : ''}

    <div class="card section-gap">
      <div class="card-header">
        <h3>My Goals</h3>
        <a href="#/employee/goals" class="btn btn-primary btn-sm">Manage Goals</a>
      </div>
      <div class="card-body">
        ${goals.length === 0 ? `<div class="empty-state"><div class="empty-icon">🎯</div><p>No goals created yet. <a href="#/employee/goals">Start by creating your goal sheet.</a></p></div>` :
          goals.map((g,i) => `
          <div class="goal-item">
            <div class="goal-item-header">
              <div class="goal-num">${i+1}</div>
              <div class="goal-item-info">
                <div class="goal-item-title">${g.title}</div>
                <div class="goal-item-meta">${g.thrustArea} · ${getUomLabel(g.uomType)}</div>
              </div>
              <span class="goal-item-weight">${g.weightage}%</span>
              <span class="badge badge-${g.isLocked?'locked':'draft'}">${g.isLocked?'Locked':'Draft'}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>

    ${sheet?.managerNote ? `<div class="alert alert-warning"><strong>Manager Note:</strong> ${sheet.managerNote}</div>` : ''}
  `);
});

// ── Goal Sheet ──────────────────────────────────────────────────────
route('/employee/goals', () => {
  const user = Auth.require(['employee']); if (!user) return;
  setTitle('My Goal Sheet');
  renderGoalSheet(user);
});

function renderGoalSheet(user) {
  const year  = 2026;
  let sheet   = DB.getSheetByEmployee(user.id, year);
  if (!sheet) {
    sheet = { id: DB.id('gs'), employeeId: user.id, cycleYear: year, status:'draft', submittedAt:null, approvedAt:null, approvedBy:null, managerNote:'' };
    DB.saveSheet(sheet);
  }
  const goals   = DB.getGoalsBySheet(sheet.id);
  const totalW  = goals.reduce((s,g)=>s+g.weightage,0);
  const locked  = sheet.status === 'approved';
  const canEdit = !locked || goals.some(g=>!g.isLocked);
  const thrustAreas = DB.getThrustAreas();

  setContent(`
    <div class="page-header">
      <div>
        <h2>My Goal Sheet — FY 2026</h2>
        <p>Define your annual goals with targets and weightages</p>
      </div>
      <div class="flex gap-2">
        ${!locked && goals.length < 8 ? `<button class="btn btn-ghost" id="add-goal-btn">+ Add Goal</button>` : ''}
        ${!locked && goals.length > 0 && totalW === 100 && sheet.status !== 'submitted' ? `<button class="btn btn-primary" id="submit-sheet-btn">Submit for Approval</button>` : ''}
        ${sheet.status === 'submitted' ? `<span class="badge badge-submitted" style="font-size:13px;padding:8px 14px">Pending Approval</span>` : ''}
        ${locked ? `<span class="badge badge-approved" style="font-size:13px;padding:8px 14px">✓ Approved & Locked</span>` : ''}
      </div>
    </div>

    ${sheet.managerNote ? `<div class="alert alert-warning"><strong>Manager Feedback:</strong> ${sheet.managerNote}</div>` : ''}
    ${sheet.status === 'returned' ? `<div class="alert alert-danger">Your goal sheet was returned for rework. Please review the manager's feedback and resubmit.</div>` : ''}

    <div class="weight-tracker">
      <span class="wt-label">Total Weightage Used</span>
      <div class="flex items-center gap-2">
        <span class="wt-value ${totalW===100?'ok':totalW>100?'over':'warn'}">${totalW}%</span>
        <span class="text-sm">/ 100% required</span>
      </div>
    </div>

    <div id="goals-list">
      ${goals.length === 0 ? `<div class="empty-state"><div class="empty-icon">🎯</div><p>No goals yet. Click "Add Goal" to get started.</p></div>` :
        goals.map((g,i) => renderGoalCard(g, i, locked, thrustAreas)).join('')}
    </div>

    <div class="card mt-3">
      <div class="card-body">
        <div class="text-sm"><strong>Rules:</strong> Total weightage must equal 100% · Minimum 10% per goal · Maximum 8 goals</div>
      </div>
    </div>
  `);

  if (!locked) {
    document.getElementById('add-goal-btn')?.addEventListener('click', () => openGoalModal(null, sheet.id, user.id, thrustAreas));
    document.getElementById('submit-sheet-btn')?.addEventListener('click', () => submitSheet(sheet, goals));
  }
  goals.forEach(g => {
    document.getElementById(`edit-${g.id}`)?.addEventListener('click', () => openGoalModal(g, sheet.id, user.id, thrustAreas));
    document.getElementById(`del-${g.id}`)?.addEventListener('click', () => deleteGoalConfirm(g));
  });
}

function renderGoalCard(g, i, locked, thrustAreas) {
  const uomSuffix = {pct_min:'%',pct_max:'%'}[g.uomType]||'';
  const targetDisplay = g.uomType==='timeline' ? (g.targetDate?formatDate(g.targetDate):'Set date') : (g.target||'—')+uomSuffix;

  // Collect latest score across quarters
  const quarters = ['Q1','Q2','Q3','Q4'];
  const latestCi = quarters.map(q=>DB.getCheckIn(g.id,q)).filter(Boolean).pop();
  const latestScore = latestCi ? computeScore(g, latestCi) : null;
  const scoreChip = latestScore!==null
    ? `<span class="score-chip ${latestScore>=80?'chip-green':latestScore>=50?'chip-amber':'chip-red'}" title="Latest score">${latestScore}%</span>`
    : '';

  return `
    <div class="goal-item" id="gc-${g.id}">
      <div class="goal-item-header">
        <div class="goal-num">${i+1}</div>
        <div class="goal-item-info">
          <div class="goal-item-title">${g.title}${g.isShared?'<span class="badge badge-info" style="margin-left:8px;font-size:10px">Shared KPI</span>':''}</div>
          <div class="goal-item-meta">${g.thrustArea} · ${getUomLabel(g.uomType)}</div>
        </div>
        ${scoreChip}
        <span class="goal-item-weight">${g.weightage}%</span>
        ${g.isLocked ? `<span class="badge badge-locked">🔒 Locked</span>` : `<span class="badge badge-draft">Draft</span>`}
        ${!locked||!g.isLocked ? `<div class="flex gap-2"><button class="btn btn-ghost btn-sm" id="edit-${g.id}">Edit</button><button class="btn btn-ghost btn-sm color-danger" id="del-${g.id}">Delete</button></div>` : ''}
      </div>
      <div class="goal-item-body">
        <div class="form-row" style="gap:12px">
          <div><div class="text-sm">Description</div><div style="margin-top:4px;font-size:13px">${g.description||'—'}</div></div>
          <div><div class="text-sm">Target</div><div class="fw-600 mt-1">${targetDisplay}</div></div>
          ${latestCi?`<div><div class="text-sm">Latest Actual</div><div class="fw-600 mt-1 color-success">${g.uomType==='timeline'?formatDate(latestCi.completionDate):(latestCi.actual??'—')+uomSuffix}</div></div>`:''}
        </div>
      </div>
    </div>`;
}

function openGoalModal(goal, sheetId, empId, thrustAreas) {
  const isEdit = !!goal;
  const isShared = goal?.isShared;
  const readonly = (field) => isShared && field !== 'weightage' ? 'readonly' : '';
  const g = goal || { thrustArea: thrustAreas[0], title:'', description:'', uomType:'numeric_min', target:'', targetDate:'', weightage:10 };

  const body = `
    <div class="form-group">
      <label>Thrust Area</label>
      <select id="g-thrust" ${readonly('thrust')}>
        ${thrustAreas.map(a=>`<option value="${a}" ${g.thrustArea===a?'selected':''}>${a}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Goal Title <span style="color:var(--danger)">*</span></label>
      <input id="g-title" type="text" value="${g.title}" placeholder="e.g. Achieve Annual Sales Target" ${readonly('title')} />
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="g-desc" ${readonly('desc')}>${g.description}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Unit of Measurement <span style="color:var(--danger)">*</span></label>
        <select id="g-uom" ${readonly('uom')} onchange="toggleTargetField()">
          <option value="numeric_min" ${g.uomType==='numeric_min'?'selected':''}>Numeric — Higher is Better</option>
          <option value="numeric_max" ${g.uomType==='numeric_max'?'selected':''}>Numeric — Lower is Better</option>
          <option value="pct_min" ${g.uomType==='pct_min'?'selected':''}>% — Higher is Better</option>
          <option value="pct_max" ${g.uomType==='pct_max'?'selected':''}>% — Lower is Better</option>
          <option value="timeline" ${g.uomType==='timeline'?'selected':''}>Timeline (Date-based)</option>
          <option value="zero" ${g.uomType==='zero'?'selected':''}>Zero-based (0 = Success)</option>
        </select>
      </div>
      <div class="form-group" id="target-field">
        <label>Target</label>
        <input id="g-target" type="number" value="${g.target}" placeholder="Enter target value" ${readonly('target')} />
      </div>
      <div class="form-group" id="target-date-field" style="display:none">
        <label>Deadline Date</label>
        <input id="g-targetdate" type="date" value="${g.targetDate||''}" ${readonly('target')} />
      </div>
    </div>
    <div class="form-group">
      <label>Weightage (%) <span style="color:var(--danger)">*</span></label>
      <input id="g-weight" type="number" min="10" max="100" value="${g.weightage}" placeholder="Minimum 10%" oninput="updateWeightagePreview('${sheetId}','${isEdit?goal.id:''}')" />
      <div style="margin-top:6px;display:flex;align-items:center;gap:10px">
        <div class="form-hint" style="flex:1">Min 10% per goal · All goals must total 100%</div>
        <div id="weight-preview" style="font-size:13px;font-weight:600"></div>
      </div>
    </div>
    <div id="goal-modal-err" class="form-error" style="display:none"></div>
  `;

  openModal(isEdit ? 'Edit Goal' : 'Add New Goal', body, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveGoalFromModal('${isEdit?goal.id:''}','${sheetId}','${empId}',${isEdit})">
        ${isEdit ? 'Save Changes' : 'Add Goal'}
    </button>
  `);

  toggleTargetField();
  // Show initial weightage preview
  setTimeout(()=>updateWeightagePreview(sheetId, isEdit?goal.id:''),50);
};

window.updateWeightagePreview = function(sheetId, excludeId) {
  const weightEl = document.getElementById('g-weight');
  const previewEl = document.getElementById('weight-preview');
  if (!weightEl || !previewEl) return;
  const newW = parseInt(weightEl.value)||0;
  const others = DB.getGoalsBySheet(sheetId).filter(g=>g.id!==excludeId);
  const othersTotal = others.reduce((s,g)=>s+g.weightage,0);
  const newTotal = othersTotal + newW;
  const remaining = 100 - othersTotal;
  const color = newTotal===100?'var(--success)':newTotal>100?'var(--danger)':'var(--warning)';
  previewEl.innerHTML = `<span style="color:${color}">Total: ${newTotal}%</span> <span style="color:var(--text-3)">(${remaining} remaining)</span>`;
};

window.toggleTargetField = function() {
  const uom = document.getElementById('g-uom')?.value;
  const tfd  = document.getElementById('target-field');
  const tdfd = document.getElementById('target-date-field');
  if (!tfd || !tdfd) return;
  if (uom === 'timeline') { tfd.style.display='none'; tdfd.style.display='block'; }
  else if (uom === 'zero') { tfd.style.display='none'; tdfd.style.display='none'; }
  else { tfd.style.display='block'; tdfd.style.display='none'; }
};

window.saveGoalFromModal = function(goalId, sheetId, empId, isEdit) {
  const errEl = document.getElementById('goal-modal-err');
  const title  = document.getElementById('g-title').value.trim();
  const thrust = document.getElementById('g-thrust').value;
  const uom    = document.getElementById('g-uom').value;
  const target = document.getElementById('g-target')?.value?.trim()||'';
  const tDate  = document.getElementById('g-targetdate')?.value||'';
  const desc   = document.getElementById('g-desc').value.trim();
  const weight = parseInt(document.getElementById('g-weight').value)||0;

  if (!title) { errEl.textContent='Goal title is required.'; errEl.style.display='block'; return; }
  if (weight < 10) { errEl.textContent='Minimum weightage is 10%.'; errEl.style.display='block'; return; }
  if (uom !== 'timeline' && uom !== 'zero' && !target) { errEl.textContent='Target value is required.'; errEl.style.display='block'; return; }
  if (uom === 'timeline' && !tDate) { errEl.textContent='Deadline date is required for Timeline goals.'; errEl.style.display='block'; return; }

  const sheet = DB.getSheetById(sheetId);
  const existing = DB.getGoalsBySheet(sheetId);
  const others   = isEdit ? existing.filter(g=>g.id!==goalId) : existing;
  const newTotal = others.reduce((s,g)=>s+g.weightage,0) + weight;
  if (newTotal > 100) { errEl.textContent=`Total weightage would be ${newTotal}%. Cannot exceed 100%.`; errEl.style.display='block'; return; }
  if (!isEdit && existing.length >= 8) { errEl.textContent='Maximum 8 goals per employee.'; errEl.style.display='block'; return; }

  const now = new Date().toISOString();
  const goalObj = {
    id: isEdit ? goalId : DB.id('g'),
    sheetId, employeeId: empId,
    thrustArea: thrust, title, description: desc,
    uomType: uom, target, targetDate: tDate, weightage: weight,
    isLocked: false, isShared: false, sharedFromId: null,
    createdAt: isEdit ? (DB.getGoalById(goalId)?.createdAt||now) : now,
    updatedAt: now,
  };
  DB.saveGoal(goalObj);

  if (sheet.status === 'returned') { sheet.status = 'draft'; DB.saveSheet(sheet); }

  closeModal();
  showToast(isEdit ? 'Goal updated.' : 'Goal added.', 'success');
  renderGoalSheet(Auth.getUser());
};

function deleteGoalConfirm(goal) {
  openModal('Delete Goal', `<p>Are you sure you want to delete <strong>${goal.title}</strong>?</p>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" onclick="confirmDeleteGoal('${goal.id}')">Delete</button>`);
}
window.confirmDeleteGoal = function(id) {
  DB.deleteGoal(id);
  closeModal();
  showToast('Goal deleted.', 'success');
  renderGoalSheet(Auth.getUser());
};

function submitSheet(sheet, goals) {
  const totalW = goals.reduce((s,g)=>s+g.weightage,0);
  if (totalW !== 100) { showToast('Total weightage must equal 100% before submitting.','error'); return; }
  if (goals.length === 0) { showToast('Add at least one goal.','error'); return; }
  sheet.status = 'submitted';
  sheet.submittedAt = new Date().toISOString();
  DB.saveSheet(sheet);
  showToast('Goal sheet submitted for manager approval!', 'success');
  renderGoalSheet(Auth.getUser());
}

// ── Check-in ────────────────────────────────────────────────────────
route('/employee/checkin', () => {
  const user = Auth.require(['employee']); if (!user) return;
  setTitle('Quarterly Check-in');
  renderCheckIn(user);
});

function renderCheckIn(user) {
  const cycle  = DB.getCycleByYear(2026);
  const phase  = getActivePhase(cycle);
  const sheet  = DB.getSheetByEmployee(user.id, 2026);
  const goals  = sheet ? DB.getGoalsBySheet(sheet.id).filter(g=>g.isLocked) : [];

  const quarters = ['Q1','Q2','Q3','Q4'];
  const activeQ = phase && ['q1','q2','q3','q4'].includes(phase.key) ? phase.key.toUpperCase() : null;

  if (sheet?.status !== 'approved') {
    setContent(`<div class="alert alert-warning">Your goal sheet must be approved before you can file check-ins.</div>`);
    return;
  }

  setContent(`
    <div class="page-header"><div><h2>Quarterly Check-in</h2><p>Log your actual achievement against planned targets</p></div></div>
    ${activeQ ? `<div class="alert alert-info">📅 <strong>${activeQ} Check-in</strong> window is currently active.</div>` : `<div class="alert alert-warning">No check-in window is currently active.</div>`}
    <div class="tabs" id="ci-tabs">
      ${quarters.map(q=>`<div class="tab ${q===activeQ?'active':''}" onclick="switchCiTab('${q}')">${q}</div>`).join('')}
    </div>
    <div id="ci-content">${renderCiTab(goals, activeQ||'Q1', user)}</div>
  `);
}

window.switchCiTab = function(q) {
  document.querySelectorAll('#ci-tabs .tab').forEach(t=>t.classList.toggle('active',t.textContent===q));
  const sheet  = DB.getSheetByEmployee(Auth.getUser().id, 2026);
  const goals  = sheet ? DB.getGoalsBySheet(sheet.id).filter(g=>g.isLocked) : [];
  document.getElementById('ci-content').innerHTML = renderCiTab(goals, q, Auth.getUser());
};

function renderCiTab(goals, quarter, user) {
  const cycle = DB.getCycleByYear(2026);
  const phase = getActivePhase(cycle);
  const qKey  = quarter.toLowerCase();
  const isActive = phase?.key === qKey;

  if (goals.length === 0) return `<div class="empty-state"><div class="empty-icon">📋</div><p>No approved goals found.</p></div>`;

  return `<div class="card"><div class="card-body">
    <form id="ci-form-${quarter}">
    ${goals.map(g => {
      const ci = DB.getCheckIn(g.id, quarter) || {};
      const score = computeScore(g,ci);
      const uomSuffix = {pct_min:'%',pct_max:'%'}[g.uomType]||'';
      const targetDisplay = g.uomType==='timeline'?formatDate(g.targetDate):(g.target||'—')+uomSuffix;
      return `<div class="goal-item mb-3">
        <div class="goal-item-header"><div class="goal-item-info">
          <div class="goal-item-title">${g.title}</div>
          <div class="goal-item-meta">${g.thrustArea} · Target: ${targetDisplay} · Weight: ${g.weightage}%</div>
        </div>
        ${score !== null ? `<span class="score-chip ${score>=80?'chip-green':score>=50?'chip-amber':'chip-red'}">${score}%</span>` : ''}
        </div>
        <div class="goal-item-body">
          <div class="form-row">
            ${g.uomType==='timeline' ? `
              <div class="form-group"><label>Completion Date</label>
                <input type="date" id="ci-actual-${g.id}" value="${ci.completionDate||''}" ${!isActive?'readonly':''} />
              </div>` : g.uomType==='zero' ? `
              <div class="form-group"><label>Actual (0 = Success)</label>
                <input type="number" id="ci-actual-${g.id}" value="${ci.actual??''}" placeholder="Enter incident count" ${!isActive?'readonly':''} />
              </div>` : `
              <div class="form-group"><label>Actual Achievement ${uomSuffix}</label>
                <input type="number" id="ci-actual-${g.id}" value="${ci.actual??''}" placeholder="Enter actual value" ${!isActive?'readonly':''} />
              </div>`}
            <div class="form-group"><label>Status</label>
              <select id="ci-status-${g.id}" ${!isActive?'disabled':''}>
                <option value="not_started" ${ci.status==='not_started'?'selected':''}>Not Started</option>
                <option value="on_track" ${ci.status==='on_track'?'selected':''}>On Track</option>
                <option value="completed" ${ci.status==='completed'?'selected':''}>Completed</option>
              </select>
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}
    ${isActive ? `<div style="text-align:right"><button type="button" class="btn btn-primary" onclick="saveCiForm('${quarter}')">Save Check-in</button></div>` : ''}
    </form>
  </div></div>`;
}

window.saveCiForm = function(quarter) {
  const user  = Auth.getUser();
  const sheet = DB.getSheetByEmployee(user.id, 2026);
  const goals = DB.getGoalsBySheet(sheet.id).filter(g=>g.isLocked);
  const now   = new Date().toISOString();

  goals.forEach(g => {
    const actualEl = document.getElementById(`ci-actual-${g.id}`);
    const statusEl = document.getElementById(`ci-status-${g.id}`);
    if (!actualEl) return;
    const actual = actualEl.value;
    const status = statusEl?.value || 'not_started';
    const existing = DB.getCheckIn(g.id, quarter);
    const ci = existing || { id: DB.id('ci'), goalId: g.id, employeeId: user.id, quarter, managerComment:'', submittedAt: now };

    if (g.uomType === 'timeline') { ci.completionDate = actual; ci.actual = null; }
    else { ci.actual = actual !== '' ? parseFloat(actual) : null; ci.completionDate = null; }
    ci.status = status;
    ci.updatedAt = now;
    ci.computedScore = computeScore(g, ci);
    DB.saveCheckIn(ci);

    // ── Sync shared goal achievement to linked goals ──────────────
    const linked = DB.getSharedLinked(g.id);
    linked.forEach(lg => {
      const lci = DB.getCheckIn(lg.id, quarter) || { id: DB.id('ci'), goalId: lg.id, employeeId: lg.employeeId, quarter, managerComment:'', submittedAt: now };
      if (g.uomType === 'timeline') { lci.completionDate = actual; lci.actual = null; }
      else { lci.actual = ci.actual; lci.completionDate = null; }
      lci.status = status; lci.updatedAt = now;
      lci.computedScore = computeScore(lg, lci);
      DB.saveCheckIn(lci);
    });
  });

  showToast(`${quarter} check-in saved successfully!`, 'success');
  renderCheckIn(user);
};
