# 🎯 GoalTrack — Enterprise Goal Management Portal

<div align="center">

![GoalTrack Banner](https://img.shields.io/badge/GoalTrack-Enterprise%20Portal-4F46E5?style=for-the-badge&logo=target&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth-FF6F00?style=for-the-badge&logo=firebase&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-Analytics-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)

**A production-grade, role-based goal setting and performance tracking portal built for modern organisations.**

[Live Demo](#-running-locally) · [Features](#-features) · [Login Credentials](#-demo-login-credentials) · [Tech Stack](#-tech-stack)

</div>

---

## ✨ Features

### 👤 Role-Based Access Control
| Role | Capabilities |
|------|-------------|
| **Admin / HR** | User management, cycle configuration, analytics dashboard, audit trail, completion reports |
| **Manager** | Team goal review & approval, inline goal editing, shared KPI push, quarterly check-in review |
| **Employee** | Goal sheet creation, quarterly check-ins, progress tracking |

### 📋 Goal Management
- Create up to **8 goals** per employee with weightage (must total 100%)
- **6 UoM types**: Numeric (Higher/Lower is Better), Percentage, Timeline, Zero-based
- Goal sheet **approval workflow**: Draft → Submitted → Approved / Returned
- Admin **Goal Lock / Unlock** override with full audit logging

### 📅 Quarterly Check-ins
- Employees log actual achievement per quarter (Q1–Q4)
- Manager adds structured feedback comments per employee
- Auto-computed **performance scores** based on UoM logic
- Score chips: 🟢 ≥80% · 🟡 ≥50% · 🔴 <50%

### 📊 Analytics & Reports
- Interactive **Chart.js** charts: doughnut, bar, horizontal bar
- Achievement report with **CSV export** and **print/PDF**
- Completion dashboard with escalation alerts
- Full **Audit Trail** for all goal changes

### 🔐 Authentication
- Email/Password login via **Firebase Auth**
- Google Sign-In (popup + redirect fallback)
- **Secret access codes** required for Admin and Manager roles
- Forgot password via Firebase email reset

---

## 🔑 Demo Login Credentials

> These are the pre-seeded demo accounts. Use them to explore all features instantly.

### 🛡️ Admin Account
| Field | Value |
|-------|-------|
| **Email** | `admin@acme.com` |
| **Password** | `admin123` |
| **Access Code** | `ADMIN@TRACK26` |

### 👔 Manager Account
| Field | Value |
|-------|-------|
| **Email** | `manager@acme.com` |
| **Password** | `manager123` |
| **Access Code** | `MGR@TRACK26` |

### 👩 Employee Accounts
| Name | Email | Password |
|------|-------|----------|
| Alice Johnson | `alice@acme.com` | `emp123` |
| Bob Smith | `bob@acme.com` | `emp123` |
| Carol Davis | `carol@acme.com` | `emp123` |

> **Note:** Employees do **not** need an access code. Only Admin and Manager roles require one.

---

## 🔐 Login Page — Access Code System

The login page uses a **3-step role-aware authentication flow**:

```
Step 1 → Select Role  (Admin / Manager / Employee)
Step 2 → Sign In Form (role-specific fields appear)
Step 3 → Register     (optional, for new accounts)
```

### How Access Codes Work

```javascript
// js/auth.js
const ACCESS_CODES = {
  admin:   'ADMIN@TRACK26',   // Required for Admin login & registration
  manager: 'MGR@TRACK26',     // Required for Manager login & registration
};
```

- **Employees** — Sign in freely with email/password or Google. No code needed.
- **Managers** — Must enter the Manager access code (`MGR@TRACK26`) along with credentials.
- **Admins** — Must enter the Admin access code (`ADMIN@TRACK26`) along with credentials.

The access code is validated **before** any Firebase call is made — wrong code = immediate rejection without hitting the server.

> ⚠️ **Change these codes before deploying to production!**

---

## 🗂️ Project Structure

```
goal_tracker/
├── index.html              # Single-page application shell
├── css/
│   └── styles.css          # Full design system (variables, components, animations)
└── js/
    ├── firebase-config.js  # Firebase project config + Auth/Google provider init
    ├── data.js             # LocalStorage DB layer, seed data, utility functions
    ├── auth.js             # Authentication module (login, register, Google, logout)
    ├── app.js              # Router, sidebar, toast, modal, app bootstrap
    ├── employee.js         # Employee pages (dashboard, goal sheet, check-in)
    ├── manager.js          # Manager pages (team, review, check-in review, shared goal)
    └── admin.js            # Admin pages (dashboard, users, cycles, reports, analytics, audit)
```

---

## 🚀 Running Locally

> **Important:** Firebase Auth does **not** work on `file://` URLs. Always use a local HTTP server.

### Option 1 — Python (no install needed)
```bash
cd goal_tracker
python -m http.server 8080
```
Open → **http://127.0.0.1:8080**

### Option 2 — VS Code Live Server
Install the **Live Server** extension → right-click `index.html` → **Open with Live Server**

### Option 3 — Node.js `http-server`
```bash
npx http-server . -p 8080
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| **Fonts** | Google Fonts — Outfit (headings) + Inter (body) |
| **Auth** | Firebase Auth v12 (compat mode) — email/password + Google OAuth |
| **Charts** | Chart.js v4.4 — doughnut, bar, horizontal bar |
| **Storage** | Browser `localStorage` (no backend required) |
| **Hosting** | GitHub Pages compatible (static files only) |

---

## 🎨 Design Highlights

- **Split-screen login** — branded left panel + glassmorphism form card
- **Role card picker** — animated card grid with hover lift effect
- **Dark sidebar** — gradient background, active glow, phase badge
- **Micro-animations** — spring easing on buttons, stat card hover lift, toast slide-in
- **Score chips** — green/amber/red badges computed from UoM achievement
- **Responsive tables** — horizontal scroll on mobile with sticky headers

---

## 📦 Deployment (GitHub Pages)

```bash
# 1. Push your code to GitHub
git add -A
git commit -m "your message"
git push

# 2. In your GitHub repo → Settings → Pages
#    Source: Deploy from branch → main → / (root)
#    Click Save

# 3. Your site will be live at:
#    https://Abhishekkp-12345.github.io/goal-tracker/
```

> **Firebase note:** Add `https://Abhishekkp-12345.github.io` to your Firebase project's **Authorized Domains** (Console → Authentication → Settings → Authorized Domains).

---

## 🔧 Firebase Configuration

The project uses the `goaltrack-portal` Firebase project. To use your own Firebase project:

1. Go to [Firebase Console](https://console.firebase.google.com/) → Create project
2. Enable **Authentication** → Email/Password + Google
3. Replace the config in `js/firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
```

---

## 📄 License

MIT — free to use, modify, and distribute.

---

<div align="center">

Built with ❤️ by **Abhishekkp-12345**

⭐ Star this repo if you found it useful!

</div>
