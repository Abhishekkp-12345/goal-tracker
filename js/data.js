'use strict';

const DB = {
  K: {
    USERS:'gt_users', SHEETS:'gt_sheets', GOALS:'gt_goals',
    CHECKINS:'gt_checkins', AUDIT:'gt_audit', CYCLES:'gt_cycles',
    SESSION:'gt_session', THRUST:'gt_thrust', INIT:'gt_init_v3'
  },
  _g(k){try{return JSON.parse(localStorage.getItem(k))||[];}catch{return[];}},
  _go(k){try{return JSON.parse(localStorage.getItem(k))||null;}catch{return null;}},
  _s(k,v){localStorage.setItem(k,JSON.stringify(v));},
  id(p){return`${p}_${Date.now()}_${Math.random().toString(36).substr(2,7)}`;},

  // Users
  getUsers(){return this._g(this.K.USERS);},
  getUserById(id){return this.getUsers().find(u=>u.id===id)||null;},
  getUserByEmail(e){return this.getUsers().find(u=>u.email.toLowerCase()===e.toLowerCase())||null;},
  getEmployeesByManager(mid){return this.getUsers().filter(u=>u.managerId===mid&&u.role==='employee');},
  getAllEmployees(){return this.getUsers().filter(u=>u.role==='employee');},
  getAllManagers(){return this.getUsers().filter(u=>u.role==='manager');},
  saveUser(u){const a=this.getUsers();const i=a.findIndex(x=>x.id===u.id);if(i>=0)a[i]=u;else a.push(u);this._s(this.K.USERS,a);return u;},
  deleteUser(id){this._s(this.K.USERS,this.getUsers().filter(u=>u.id!==id));},

  // Goal Sheets
  getSheets(){return this._g(this.K.SHEETS);},
  getSheetById(id){return this.getSheets().find(s=>s.id===id)||null;},
  getSheetByEmployee(eid,year){return this.getSheets().find(s=>s.employeeId===eid&&s.cycleYear===year)||null;},
  saveSheet(s){const a=this.getSheets();const i=a.findIndex(x=>x.id===s.id);if(i>=0)a[i]=s;else a.push(s);this._s(this.K.SHEETS,a);return s;},

  // Goals
  getGoals(){return this._g(this.K.GOALS);},
  getGoalById(id){return this.getGoals().find(g=>g.id===id)||null;},
  getGoalsBySheet(sid){return this.getGoals().filter(g=>g.sheetId===sid);},
  getGoalsByEmployee(eid){return this.getGoals().filter(g=>g.employeeId===eid);},
  getSharedLinked(srcId){return this.getGoals().filter(g=>g.sharedFromId===srcId);},
  saveGoal(g){const a=this.getGoals();const i=a.findIndex(x=>x.id===g.id);if(i>=0)a[i]=g;else a.push(g);this._s(this.K.GOALS,a);return g;},
  deleteGoal(id){this._s(this.K.GOALS,this.getGoals().filter(g=>g.id!==id));},

  // Check-ins
  getCheckIns(){return this._g(this.K.CHECKINS);},
  getCheckIn(goalId,quarter){return this.getCheckIns().find(c=>c.goalId===goalId&&c.quarter===quarter)||null;},
  getCheckInsByEmployee(eid){return this.getCheckIns().filter(c=>c.employeeId===eid);},
  getCheckInsByQuarter(q){return this.getCheckIns().filter(c=>c.quarter===q);},
  saveCheckIn(c){const a=this.getCheckIns();const i=a.findIndex(x=>x.id===c.id);if(i>=0)a[i]=c;else a.push(c);this._s(this.K.CHECKINS,a);return c;},

  // Audit Logs
  getAudit(){return this._g(this.K.AUDIT);},
  addAudit(log){const a=this.getAudit();a.unshift({...log,id:this.id('al'),ts:new Date().toISOString()});this._s(this.K.AUDIT,a);},

  // Cycles
  getCycles(){return this._g(this.K.CYCLES);},
  getCycleByYear(y){return this.getCycles().find(c=>c.year===y)||null;},
  saveCycle(c){const a=this.getCycles();const i=a.findIndex(x=>x.id===c.id);if(i>=0)a[i]=c;else a.push(c);this._s(this.K.CYCLES,a);return c;},

  // Thrust Areas
  getThrustAreas(){return this._g(this.K.THRUST);},
  saveThrustAreas(arr){this._s(this.K.THRUST,arr);},

  // Session
  getSession(){return this._go(this.K.SESSION);},
  setSession(u){this._s(this.K.SESSION,u);},
  clearSession(){localStorage.removeItem(this.K.SESSION);},

  isInit(){return localStorage.getItem(this.K.INIT)==='1';},
  setInit(){localStorage.setItem(this.K.INIT,'1');},
};

// Score computation
function computeScore(goal, checkIn) {
  if (!checkIn) return null;
  const { uomType, target, targetDate } = goal;
  const { actual, completionDate } = checkIn;
  if (actual === null || actual === undefined || actual === '') return null;
  const a = parseFloat(actual), t = parseFloat(target);
  switch (uomType) {
    case 'numeric_min': case 'pct_min':
      if (!t) return null;
      return Math.round(Math.min((a/t)*100, 150));
    case 'numeric_max': case 'pct_max':
      if (!a) return null;
      return Math.round(Math.min((t/a)*100, 150));
    case 'timeline':
      if (!targetDate || !completionDate) return null;
      return new Date(completionDate)<=new Date(targetDate)?100:0;
    case 'zero':
      return a===0?100:0;
    default: return null;
  }
}

function getUomLabel(uomType) {
  const map = {
    'numeric_min':'Numeric (Higher is Better)',
    'numeric_max':'Numeric (Lower is Better)',
    'pct_min':'% (Higher is Better)',
    'pct_max':'% (Lower is Better)',
    'timeline':'Timeline (Date-based)',
    'zero':'Zero-based (0 = Success)'
  };
  return map[uomType]||uomType;
}

function getActivePhase(cycle) {
  if (!cycle) return null;
  const today = new Date();
  const phases = [
    { name:'Phase 1 — Goal Setting', key:'phase1', open:cycle.phase1Open, close:cycle.phase1Close },
    { name:'Q1 Check-in', key:'q1', open:cycle.q1Open, close:cycle.q1Close },
    { name:'Q2 Check-in', key:'q2', open:cycle.q2Open, close:cycle.q2Close },
    { name:'Q3 Check-in', key:'q3', open:cycle.q3Open, close:cycle.q3Close },
    { name:'Q4 / Annual', key:'q4', open:cycle.q4Open, close:cycle.q4Close },
  ];
  return phases.find(p=>p.open&&p.close&&today>=new Date(p.open)&&today<=new Date(p.close))||null;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

// Seed
function seedData() {
  if (DB.isInit()) return;

  const THRUST_AREAS = [
    'Revenue & Sales','Operations & Efficiency','People & Culture',
    'Quality & Compliance','Safety & Environment',
    'Innovation & Technology','Customer Experience','Finance & Cost Control'
  ];
  DB.saveThrustAreas(THRUST_AREAS);

  const users = [
    { id:'u_admin', name:'Sarah Chen', email:'admin@acme.com', password:'admin123', role:'admin', department:'Human Resources', designation:'HR Manager', managerId:null },
    { id:'u_mgr', name:'Rajesh Kumar', email:'manager@acme.com', password:'manager123', role:'manager', department:'Operations', designation:'Senior Manager', managerId:null },
    { id:'u_emp1', name:'Alice Johnson', email:'alice@acme.com', password:'emp123', role:'employee', department:'Sales', designation:'Senior Executive', managerId:'u_mgr' },
    { id:'u_emp2', name:'Bob Smith', email:'bob@acme.com', password:'emp123', role:'employee', department:'Operations', designation:'Executive', managerId:'u_mgr' },
    { id:'u_emp3', name:'Carol Davis', email:'carol@acme.com', password:'emp123', role:'employee', department:'Quality', designation:'Quality Analyst', managerId:'u_mgr' },
  ];
  users.forEach(u => DB.saveUser(u));

  const cycle = {
    id:'cy_2026', year:2026,
    phase1Open:'2026-05-01', phase1Close:'2026-06-30',
    q1Open:'2026-07-01', q1Close:'2026-07-31',
    q2Open:'2026-10-01', q2Close:'2026-10-31',
    q3Open:'2027-01-01', q3Close:'2027-01-31',
    q4Open:'2027-03-01', q4Close:'2027-04-30',
  };
  DB.saveCycle(cycle);

  // Alice — approved sheet
  const aliceSheet = {id:'gs_alice', employeeId:'u_emp1', cycleYear:2026,
    status:'approved', submittedAt:'2026-05-10T09:00:00Z',
    approvedAt:'2026-05-12T11:00:00Z', approvedBy:'u_mgr', managerNote:''};
  DB.saveSheet(aliceSheet);

  const aliceGoals = [
    {id:'g_a1',sheetId:'gs_alice',employeeId:'u_emp1',thrustArea:'Revenue & Sales',
     title:'Achieve Annual Sales Target',description:'Close 120 enterprise accounts for FY 2026.',
     uomType:'numeric_min',target:'120',targetDate:'',weightage:30,
     isLocked:true,isShared:false,sharedFromId:null,createdAt:'2026-05-10T08:00:00Z'},
    {id:'g_a2',sheetId:'gs_alice',employeeId:'u_emp1',thrustArea:'Customer Experience',
     title:'Customer Satisfaction Score',description:'Maintain CSAT above 85% across all accounts.',
     uomType:'pct_min',target:'85',targetDate:'',weightage:25,
     isLocked:true,isShared:false,sharedFromId:null,createdAt:'2026-05-10T08:00:00Z'},
    {id:'g_a3',sheetId:'gs_alice',employeeId:'u_emp1',thrustArea:'Operations & Efficiency',
     title:'Reduce Sales Cycle TAT',description:'Reduce average deal closure time to 15 days.',
     uomType:'numeric_max',target:'15',targetDate:'',weightage:20,
     isLocked:true,isShared:false,sharedFromId:null,createdAt:'2026-05-10T08:00:00Z'},
    {id:'g_a4',sheetId:'gs_alice',employeeId:'u_emp1',thrustArea:'Finance & Cost Control',
     title:'CRM Rollout Completion',description:'Complete CRM migration for all clients by Q2.',
     uomType:'timeline',target:'',targetDate:'2026-09-30',weightage:25,
     isLocked:true,isShared:false,sharedFromId:null,createdAt:'2026-05-10T08:00:00Z'},
  ];
  aliceGoals.forEach(g => DB.saveGoal(g));

  // Bob — submitted (pending approval)
  const bobSheet = {id:'gs_bob', employeeId:'u_emp2', cycleYear:2026,
    status:'submitted', submittedAt:'2026-05-14T10:00:00Z',
    approvedAt:null, approvedBy:null, managerNote:''};
  DB.saveSheet(bobSheet);

  const bobGoals = [
    {id:'g_b1',sheetId:'gs_bob',employeeId:'u_emp2',thrustArea:'Operations & Efficiency',
     title:'Process Automation Coverage',description:'Automate 70% of repetitive ops processes.',
     uomType:'pct_min',target:'70',targetDate:'',weightage:35,
     isLocked:false,isShared:false,sharedFromId:null,createdAt:'2026-05-14T09:00:00Z'},
    {id:'g_b2',sheetId:'gs_bob',employeeId:'u_emp2',thrustArea:'Safety & Environment',
     title:'Zero Safety Incidents',description:'Maintain zero LTI incidents throughout the year.',
     uomType:'zero',target:'0',targetDate:'',weightage:25,
     isLocked:false,isShared:false,sharedFromId:null,createdAt:'2026-05-14T09:00:00Z'},
    {id:'g_b3',sheetId:'gs_bob',employeeId:'u_emp2',thrustArea:'Quality & Compliance',
     title:'SLA Compliance Rate',description:'Maintain SLA compliance above 95%.',
     uomType:'pct_min',target:'95',targetDate:'',weightage:40,
     isLocked:false,isShared:false,sharedFromId:null,createdAt:'2026-05-14T09:00:00Z'},
  ];
  bobGoals.forEach(g => DB.saveGoal(g));

  // Carol — draft
  const carolSheet = {id:'gs_carol', employeeId:'u_emp3', cycleYear:2026,
    status:'draft', submittedAt:null, approvedAt:null, approvedBy:null, managerNote:''};
  DB.saveSheet(carolSheet);

  DB.setInit();
}
