# CirrhoCare AI - Frontend Application

> **CirrhoCare AI React + TypeScript SPA**  
> *Smarter Liver Health. Better Patient Care.*

This directory contains the single-page application (SPA) frontend for **CirrhoCare AI**, an enterprise-grade healthcare SaaS platform designed for early liver cirrhosis risk prediction, longitudinal biomarker tracking, clinical workflow management, role-based patient care, and AI-assisted triage.

---

## 1. Technologies & Architecture

The frontend is built with modern web technologies focused on high performance, strict type safety, responsive design, and healthcare-grade data presentation:

- **React 19 (`react`, `react-dom` v19.2.8):** Component-driven UI with functional components and modern hooks.
- **TypeScript (~6.0):** Strict compile-time type checking with definitions for clinical models, API responses, and user state.
- **Vite (v8.3):** Blazing-fast build tool with instantaneous Hot Module Replacement (HMR) in development and Rollup-based production bundling.
- **Tailwind CSS (v3.4):** Utility-first styling configured with CirrhoCare AI's custom healthcare design tokens.
- **React Router (v7.18):** Client-side routing with authentication wrappers and role-based route guards (`Admin`, `Hepatologist`, `Lab Technician`, `Patient`).
- **Recharts (v3.10):** Interactive, accessible charts for cirrhosis risk probability curves, biomarker progression timelines, and patient demographics.
- **Lucide React (v1.58):** Accessible icon library for clinical tools, navigation items, and status indicators.
- **Oxlint (v1.81):** High-speed JavaScript and TypeScript linter.
- **Playwright (v1.64):** End-to-end browser testing suite across desktop and mobile viewports.

---

## 2. Directory Structure

```text
frontend/
├── e2e/                        # Playwright End-to-End test suites (20 tests)
│   ├── admin-dashboard.spec.ts # Admin metrics, users, and audit log tests
│   ├── auth-and-roles.spec.ts  # Login, logout, role redirects, and quick login tests
│   ├── clinical-workflows.spec.ts # Patient creation, prediction, and prescription flows
│   ├── clinical-workspaces.spec.ts# Doctor and lab tech workspace flows
│   └── patient-portal.spec.ts  # Patient self-service, records, and appointments
│
├── public/                     # Static assets (favicons, public images)
│
├── src/
│   ├── app/                    # Application foundation and routing
│   │   ├── AppRoutes.tsx       # Route declarations and role-based guards
│   │   ├── AuthContext.tsx     # Authentication state, login, and logout handlers
│   │   └── ToastContext.tsx    # Global notification toast provider
│   │
│   ├── components/             # Reusable UI component system
│   │   ├── common/             # Button, Badge, Card, KpiCard, DataTable, Spinner, Modal
│   │   ├── navigation/         # Sidebar, TopNavbar, Breadcrumbs
│   │   └── charts/             # RiskDistributionChart, BiomarkerTrendChart
│   │
│   ├── layouts/                # Dashboard layout templates
│   │   └── DashboardLayout.tsx # Collapsible sidebar, navigation bar, and main container
│   │
│   ├── pages/                  # Route views
│   │   ├── AdminDashboardPage.tsx # System administration, user management, audit logs
│   │   ├── AILiverMonitoringDashboardPage.tsx # Advanced AI Liver Health Monitoring Dashboard
│   │   ├── AIPredictionReviewPage.tsx # Model predictions and triage scoring
│   │   ├── AppointmentsPage.tsx# Clinical appointment scheduling and status updates
│   │   ├── AuditLogsPage.tsx   # HIPAA-compliant audit event logs and search
│   │   ├── HepatologistDashboard.tsx # Doctor clinical workspace and triage queue
│   │   ├── LabTechDashboard.tsx# Laboratory test queue and biomarker entry
│   │   ├── LoginPage.tsx       # Authentication form with quick-login role shortcuts
│   │   ├── NotFoundPage.tsx    # 404 handler with return navigation
│   │   ├── PatientDetailsPage.tsx # Longitudinal history, AI predictions, and reports
│   │   ├── PatientPortalPage.tsx # Patient self-service portal
│   │   ├── PatientsPage.tsx    # Patient roster, filtering, and registration
│   │   ├── PrescriptionsPage.tsx # Clinical medication orders and fulfillment
│   │   ├── ProfilePage.tsx     # User profile and account preferences
│   │   └── ReportsPage.tsx     # Clinical PDF reports, analytics, and uploads
│   │
│   ├── services/
│   │   └── api.ts              # Centralized API client with credentials & error handling
│   │
│   ├── styles/                 # Global styles and Tailwind directives
│   │   └── index.css
│   │
│   └── types/                  # TypeScript interfaces and entity models
│       └── index.ts            # User, Patient, Prediction, Report, Appointment, etc.
│
├── index.html                  # HTML5 entrypoint with root mounting element
├── package.json                # Dependencies, scripts, and build configuration
├── playwright.config.ts        # Playwright E2E configuration and isolated server hook
├── tailwind.config.js          # Healthcare palette tokens and responsive breakpoints
├── tsconfig.app.json           # Application TypeScript configuration
└── vite.config.ts              # Vite plugins, path aliases, and /api proxy configuration
```

---

## 3. Installation & Getting Started

### Prerequisites
- **Node.js:** 18.0.0 or higher
- **npm:** 9.0.0 or higher
- **Python Flask Backend:** Running at `http://127.0.0.1:5000` (for full API and authentication functionality)

### Installation
From the `frontend/` directory:
```bash
npm install
```

### Running the Development Server
```bash
npm run dev
```
The Vite development server will start at **`http://127.0.0.1:5173`**.

---

## 4. Development & Build Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite local development server on port `5173` with Hot Module Replacement (HMR). |
| `npx tsc -p tsconfig.app.json --noEmit` | Executes strict TypeScript type-checking without generating output files. |
| `npm run build` | Compiles TypeScript and builds the production bundle into `frontend/dist/`. Uses `tsc -p tsconfig.app.json && vite build`. |
| `npm run lint` | Runs the Oxlint linter to detect code quality issues. |
| `npm run preview` | Locally previews the compiled production build in `frontend/dist/`. |
| `npm run test:e2e` | Runs all 20 Playwright end-to-end tests against an isolated backend test server on port `5055`. |

> [!NOTE]
> **Windows PowerShell Build Execution:**  
> The build script executes `tsc -p tsconfig.app.json && vite build`. In default Windows PowerShell 5.1 environments where `npm config get script-shell` is configured to `powershell.exe`, PowerShell may reject `&&` as an invalid statement separator. If this occurs, run the build using `cmd.exe`:
> ```bash
> npm --script-shell=cmd.exe run build
> ```

---

## 5. Backend Connection & API Integration

### Development Proxy (`vite.config.ts`)
During local development, the frontend runs on port `5173`, while the Flask backend runs on port `5000`. To prevent Cross-Origin Resource Sharing (CORS) complications and ensure seamless cookie handling, Vite is configured with a reverse proxy:

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      '/reports': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

All requests initiated by the frontend to `/api/*` and `/reports/*` are transparently forwarded to `http://127.0.0.1:5000`.

### Unified Production Deployment
In production, the frontend is compiled into static assets:
```bash
npm run build
```
The compiled output in `frontend/dist/` is served directly by the unified Python WSGI server (`Waitress`), with Flask handling static file requests and all `/api/*` endpoints under a single origin.

### Session Cookies & Authentication (`src/services/api.ts`)
All API requests use the centralized `ApiClient` class in `src/services/api.ts`. The client automatically sets:
```typescript
const config: RequestInit = {
  ...options,
  headers,
  credentials: 'include', // Ensures Flask-Login session cookies are sent with requests
};
```
When running locally over HTTP, the backend `.env` should have `SESSION_COOKIE_SECURE=false` so the browser persists session cookies across requests. In production over HTTPS, set `SESSION_COOKIE_SECURE=true`.

---

## 6. End-to-End Testing (Playwright)

The frontend includes 20 verified end-to-end browser tests in `frontend/e2e/`:

1. `auth-and-roles.spec.ts` - Login workflows, credentials validation, role-based redirects, and quick-login helpers.
2. `admin-dashboard.spec.ts` - Admin metrics, user management, and audit log inspection.
3. `clinical-workflows.spec.ts` - Patient registration, biomarker input, cirrhosis risk prediction, and prescription issuance.
4. `clinical-workspaces.spec.ts` - Doctor and lab technician clinical queues and triage workflows.
5. `patient-portal.spec.ts` - Patient self-service, longitudinal lab reports, and appointment views.

### Running E2E Tests
1. **Prerequisite:** Ensure the production bundle is compiled:
   ```bash
   npm run build
   ```
2. **Execute Playwright:**
   ```bash
   npm run test:e2e
   ```
Playwright automatically spins up the isolated test server (`tests/run_e2e_server.py`) on port `5055` using a temporary SQLite database, runs the tests in headless Chromium, and cleans up all temporary databases upon exit. Active databases (`instance/cirrhosis.db`) are never touched.
