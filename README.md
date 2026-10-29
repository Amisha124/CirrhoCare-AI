# CirrhoCare AI - Liver Health SaaS & AI Diagnostic Platform

> **Product Name:** CirrhoCare AI  
> **Tagline:** *Smarter Liver Health. Better Patient Care.*

CirrhoCare AI is a full-stack, enterprise-grade healthcare SaaS platform designed for early liver cirrhosis risk prediction, longitudinal biomarker tracking, clinical workflow management, role-based patient care, and AI-assisted triage.

---

## 1. Architecture Overview

CirrhoCare AI operates as a unified modern healthcare application combining a hardened Python Flask API backend and a high-performance React + TypeScript SPA frontend:

- **Frontend (`/frontend`):**
  - **Framework:** React 19 + TypeScript + Vite
  - **Styling:** Tailwind CSS with custom healthcare palette
  - **Routing:** React Router v7 with role-based route guards
  - **Visualizations:** Recharts for risk distributions, biomarker trends, and demographics
  - **Icons:** Lucide React
  - **Design System:** Dark navy collapsible sidebar (`#0B132B`, `#0F172A`), white card surfaces, soft slate canvas (`#F8FAFC`), and bright metric accents (blue, purple, teal, pink, orange, green).
  - **Proxy:** Vite development proxy forwarding `/api/*` and `/reports/*` to Flask at `http://127.0.0.1:5000` with credential support.

- **Backend (`/app`):**
  - **Framework:** Python Flask with Blueprint architecture
  - **Database:** SQLite (`instance/cirrhosis.db`) via SQLAlchemy ORM
  - **Authentication:** Flask-Login session cookies with role authorization
  - **Security:** Token-based password resets, protected medical document storage (`instance/uploads`), CSRF protection for HTML forms, and CORS/credentials for REST API.
  - **Machine Learning:** Scikit-learn Random Forest model (`liver_rf_model.pkl`) evaluating 17 clinical biomarkers for cirrhosis probability and risk tiering (Low, Medium, High).

---

## 2. Default Ports & URLs

| Service | Address | Description |
| :--- | :--- | :--- |
| **CirrhoCare AI Frontend** | `http://127.0.0.1:5173` | Modern React + Vite SPA Dashboard |
| **Flask API & Admin Server** | `http://127.0.0.1:5000` | REST API endpoints & legacy Flask entrypoint |
| **Flask User Server (Legacy)**| `http://127.0.0.1:3000` | Alternative Flask entrypoint |

---

## 3. Installation & Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### Backend Setup

```bash
# 1. Activate Python virtual environment (if not already active)
venv\Scripts\activate   # Windows
# source venv/bin/activate # macOS/Linux

# 2. Install backend dependencies
pip install -r requirements.txt

# 3. Initialize database and demo credentials
python seed.py

# 4. Start the Flask backend server (port 5000)
python run_admin.py
```

### Frontend Setup

Open a second terminal window:

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install frontend dependencies
npm install

# 3. Start the Vite development server (port 5173)
npm run dev
```

Visit **`http://127.0.0.1:5173`** in your browser to access the CirrhoCare AI application.

To build the production bundle for the frontend:
```bash
cd frontend
npm run build
```

---

## 4. Demo Accounts & Credentials

Created by `python seed.py`:

| Role | Email / Identifier | Password | Default Redirect |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@careai.com` | `Admin@123` | `/admin` |
| **Hepatologist (Doctor)** | `doctor@careai.com` | `Doctor@123` | `/hepatologist` |
| **Lab Technician** | `lab@careai.com` | `Lab@123` | `/labtech` |
| **Patient Portal** | `patient@careai.com` *(or `PAT-1001`)* | `Patient@123` | `/patient` |

*(Tip: On the React Login Page, click any of the "Quick Login" badges under the form to prefill credentials instantly).*

---

## 5. Frontend Design System & Palette

CirrhoCare AI uses a tailored healthcare SaaS color palette:

- **Deep Navy:** `#0B132B` (Sidebar background)
- **Slate Navy:** `#0F172A` (Sidebar active states & header accents)
- **Canvas Background:** `#F8FAFC` (Soft light grey canvas)
- **White Surfaces:** `#FFFFFF` (Card panels with subtle borders and shadows)
- **Blue (Primary):** `#3B82F6` (Action buttons, brand accents, primary KPIs)
- **Purple:** `#8B5CF6` (AI prediction metrics, secondary highlights)
- **Teal:** `#14B8A6` (Lab orders, biological indicators)
- **Pink:** `#EC4899` (High risk indicators, urgent alerts)
- **Orange:** `#F59E0B` (Medium risk indicators, pending appointments)
- **Green:** `#22C55E` (Low risk indicators, active status, system health)

---

## 6. Project Structure

```text
├── app/                        # Flask Backend Application
│   ├── api/                    # REST API routes and serializers
│   │   ├── routes.py           # /api/auth, /api/dashboard, /api/patients, etc.
│   │   └── helpers.py          # Serializers and biomarker risk evaluators
│   ├── auth/                   # Flask authentication routes & forms
│   ├── admin/                  # Admin blueprints and templates
│   ├── hepatologist/           # Hepatologist clinical blueprints
│   ├── labtech/                # Lab technician workflow blueprints
│   ├── patient/                # Patient portal blueprints
│   ├── ml_model/               # Random Forest model & training scripts
│   ├── models/                 # SQLAlchemy models (User, Patient, Prediction, etc.)
│   └── utils/                  # Security tokens, logging, file uploads
│
├── frontend/                   # React + TypeScript SPA
│   ├── src/
│   │   ├── app/                # AuthContext, ToastContext, AppRoutes
│   │   ├── components/         # Reusable design system
│   │   │   └── common/         # Button, Badge, Card, KpiCard, DataTable, Spinner
│   │   ├── layouts/            # DashboardLayout, Sidebar, TopNavbar
│   │   ├── pages/              # AdminDashboard, Patients, Appointments, Reports, etc.
│   │   ├── services/           # Centralized API client (api.ts) with fetch & credentials
│   │   ├── types/              # TypeScript definitions for entities and API payloads
│   │   └── styles/             # Global CSS and Tailwind directives
│   ├── vite.config.ts          # Vite configuration with /api proxy to Flask:5000
│   └── tailwind.config.js      # CirrhoCare AI design token configurations
│
├── instance/                   # SQLite database and secure file uploads
│   ├── cirrhosis.db            # Active SQLite database
│   └── uploads/                # Protected medical reports directory
│
├── run_admin.py                # Admin backend entrypoint (port 5000)
├── run_user.py                 # Legacy user backend entrypoint (port 3000)
├── seed.py                     # Database initialization and demo users
└── requirements.txt            # Python dependencies
```

---

## 7. Production Deployment (Unified Flask + React SPA)

CirrhoCare AI uses a unified deployment model where a production WSGI server (Waitress) serves both the compiled React SPA static bundle from `frontend/dist` and the secure REST API at `/api`.

### 1. Build the Frontend Production Bundle
```bash
cd frontend
npm install
npm run build
cd ..
```
*Compiles TypeScript and bundles React into optimized static assets in `frontend/dist`.*

### 2. Configure Environment Variables
Create or update your production `.env` file (or set environment variables in your cloud hosting provider):
```ini
# Security & Secret Key (Required in production)
SECRET_KEY=generate-a-strong-random-32-byte-secret-key-here

# Database Connection (Default: SQLite persistent file)
DATABASE_URL=sqlite:///instance/cirrhosis.db

# Storage Directories
UPLOAD_FOLDER=instance/uploads
MAX_CONTENT_LENGTH=8388608

# Security & Cookie Policies (Set True when serving over HTTPS)
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=Lax
EXPOSE_DEV_RESET_URL=false

# WSGI Server Configuration
HOST=127.0.0.1
PORT=5000
WAITRESS_THREADS=4
```

### 3. Persistent Storage Requirements
> [!IMPORTANT]
> When deploying in containerized or PaaS environments (e.g. Docker, Render, Railway, AWS ECS), the `instance/` directory **MUST be mounted to a persistent volume**.
> If deployed on ephemeral filesystems, redeployments or container restarts will erase SQLite database records and uploaded clinical files.
> For multi-instance scaling, point `DATABASE_URL` to a managed PostgreSQL instance and store uploads on S3/cloud storage.

### 4. Start Production Server with Waitress
```bash
# Using the wsgi.py entrypoint
python wsgi.py

# Or directly using the Waitress runner
python -m waitress --host=127.0.0.1 --port=5000 wsgi:app
```

### 5. Health Check & Monitoring
Load balancers, container probes, and uptime monitors can query:
```http
GET /api/health
```
Returns HTTP `200 OK` with JSON status payload:
```json
{
  "service": "CirrhoCare AI",
  "status": "healthy",
  "success": true,
  "timestamp": "2026-10-16T17:54:51.081386+00:00",
  "version": "1.0.0"
}
```

---

## 8. Database Integrity & Backup Procedures

### Active Database Path
`instance/cirrhosis.db` (SQLite 3 with foreign key enforcement).

### Running Database Integrity Checks
```bash
python -c "
import sqlite3
conn = sqlite3.connect('instance/cirrhosis.db')
cur = conn.cursor()
cur.execute('PRAGMA integrity_check;')
print('Integrity:', cur.fetchall())
cur.execute('PRAGMA foreign_key_check;')
print('Foreign Key Violations:', cur.fetchall())
conn.close()
"
```

### Creating Database Backups
```bash
# SQLite online safe backup
sqlite3 instance/cirrhosis.db ".backup 'instance/cirrhosis_backup_$(date +%Y%m%d_%H%M%S).db'"
```

### Restoring from Backup
```bash
cp instance/cirrhosis_backup_YYYYMMDD_HHMMSS.db instance/cirrhosis.db
```

---

## 9. Testing & Verification

All automated tests strictly execute against isolated temporary SQLite databases (in-memory `:memory:` or temporary files) and **never mutate active or demo databases** (`instance/cirrhosis.db` and `instance/demo_cirrhosis.db`).

### Verified Test Summary

| Test Suite | Total Tests | Status | Scope & Coverage |
| :--- | :--- | :--- | :--- |
| **Backend Unit & Integration Suite** | **166 tests** across 21 test files | **Verified (166/166 Passed)** | Flask REST APIs, authentication, role authorization, ML model risk scoring, biomarker logic, notifications, appointments, audit logging, security remediation, file validation, and report exports. |
| **Playwright E2E Test Suite** | **20 tests** across 5 spec files | **Verified (20/20 Passed)** | End-to-end browser journeys covering authentication, role-based dashboards, clinical workspaces, triage workflows, patient portal, and UI responsiveness. |
| **Frontend TypeScript Check** | Static type compilation | **Verified (0 Errors)** | Strict TypeScript compilation (`tsconfig.app.json`) covering all frontend components, routes, types, and API services. |
| **Frontend Production Build** | Production bundle | **Verified (Built Successfully)** | `tsc -p tsconfig.app.json && vite build` producing optimized static assets in `frontend/dist/`. |

---

### Prerequisites for Running Tests

Before running tests or builds, ensure the necessary prerequisites are installed and activated:

1. **Backend Tests:**
   - Python 3.10+
   - Active virtual environment (`venv\Scripts\activate` on Windows or `source venv/bin/activate` on macOS/Linux)
   - Installed dependencies: `pip install -r requirements.txt`

2. **Frontend Tests & Build:**
   - Node.js 18+ and npm
   - Installed frontend dependencies: `cd frontend && npm install`
   - Playwright Chromium browser binaries: `npx playwright install chromium`
   - **For Playwright E2E tests:** The production frontend bundle must be built first (`cd frontend && npm run build`), because the isolated test server (`tests/run_e2e_server.py`) serves the static SPA from `frontend/dist` on port `5055`.

---

### Backend Test Commands

#### Run Complete Backend Test Suite (166 Tests)
```bash
# From project root with Python virtual environment activated:
python -m unittest discover tests
```

#### Run Specific Backend Test Suites
```bash
# 1. Unified Deployment & SPA Routing Regression (12 tests)
python -m unittest tests/test_unified_deployment.py

# 2. Security Remediation & File Validation (8 tests)
python -m unittest tests/test_security_remediation.py

# 3. Phase 1 Security & Authorization Baseline (11 tests)
python -m unittest tests/test_phase1.py

# 4. Final Functional Verification (15 tests)
python -m unittest tests/test_final_functional_verification.py

# 5. Biomarker Missing vs. Zero Handling (7 tests)
python -m unittest tests/test_biomarker_missing_vs_zero.py

# 6. Appointment Management (14 tests)
python -m unittest tests/test_appointment_management.py

# 7. Audit Log Viewer (13 tests)
python -m unittest tests/test_audit_log_viewer.py

# 8. Notification Center (14 tests)
python -m unittest tests/test_notification_center.py

# 9. Clinical Workspaces & Registration (11 tests)
python -m unittest tests/test_clinical_workspaces_and_registration.py

# 10. Patient Portal Enhancement (13 tests)
python -m unittest tests/test_patient_portal_enhancement.py

# 11. Secure Data & PDF Exports (11 tests)
python -m unittest tests/test_secure_exports.py

# 12. Search, Filters & Pagination (14 tests)
python -m unittest tests/test_search_filters_pagination.py

# 13. Clinical Report Analytics (12 tests)
python -m unittest tests/test_clinical_report_analytics.py

# 14. Live Prescription Flow (9 tests)
python -m unittest tests/test_live_prescription_flow.py

# 15. Admin Dashboard Transformed (7 tests)
python -m unittest tests/test_admin_dashboard_transformed.py

# 16. Demo DB Behavior & Isolation (4 tests)
python -m unittest tests/test_demo_db_behavior.py

# 17. Demo Reports Download (4 tests)
python -m unittest tests/test_demo_reports_download.py
```

---

### Frontend Verification Commands

All frontend verification commands are executed from the `frontend/` directory:

```bash
cd frontend
```

#### 1. TypeScript Static Type Check
Verifies strict TypeScript compliance across all components and services without producing build artifacts:
```bash
npx tsc -p tsconfig.app.json --noEmit
```

#### 2. Production Frontend Build
Executes TypeScript compilation followed by Vite production bundling:
```bash
npm run build
```
*(Executes `"tsc -p tsconfig.app.json && vite build"`, outputting compiled assets to `frontend/dist/`).*

> [!NOTE]
> On Windows PowerShell 5.1, if `npm config get script-shell` is configured to `powershell.exe`, PowerShell may fail on the `&&` operator. Run the build with `cmd.exe` if needed:
> ```bash
> npm --script-shell=cmd.exe run build
> ```

#### 3. Frontend Linter Check
Runs Oxlint across frontend source files:
```bash
npm run lint
```

#### 4. Playwright End-to-End (E2E) Test Suite (20 Tests)
Executes all 20 end-to-end browser tests across the 5 test suites (`admin-dashboard.spec.ts`, `auth-and-roles.spec.ts`, `clinical-workflows.spec.ts`, `clinical-workspaces.spec.ts`, `patient-portal.spec.ts`):
```bash
# Ensure frontend build is present before running E2E tests:
npm run build

# Run Playwright tests
npm run test:e2e
```
*Playwright launches an isolated test server on port 5055 with an ephemeral temporary database, runs all 20 browser journeys in headless Chromium, and cleans up all temporary test artifacts upon exit.*

---

## 10. Troubleshooting & FAQ

- **SPA Page Refresh returns 404?** Ensure `frontend/dist` was built before starting Flask (`cd frontend && npm run build`).
- **Session lost immediately after login?** If running locally over HTTP, ensure `SESSION_COOKIE_SECURE=false` in `.env`. Set to `true` only when HTTPS is active.
- **Foreign Key constraint failures?** SQLAlchemy enforces SQLite foreign keys (`PRAGMA foreign_keys = ON;`). Ensure child records (reports, prescriptions, appointments) reference valid patient and user IDs.
- **Executable file upload rejected?** The upload handler inspects binary header bytes (`MZ`, `ELF`, PHP scripts) and rejects executables even if disguised with `.pdf` or `.png` extensions.
