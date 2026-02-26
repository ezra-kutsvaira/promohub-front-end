# 🚀 PromoHub Front-End

> Verified promotions you can trust — discover deals, save favorites, and manage campaigns from one place.

## 📚 Table of Contents
- [✨ Overview](#-overview)
- [🧩 Core Features](#-core-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [⚡ Quick Start](#-quick-start)
- [🔐 Environment Variables](#-environment-variables)
- [📜 Available Scripts](#-available-scripts)
- [🧭 App Routes](#-app-routes)
- [🔌 Backend Integration Notes](#-backend-integration-notes)
- [🧪 Troubleshooting](#-troubleshooting)

---

## ✨ Overview
PromoHub is a React + TypeScript web app for browsing and managing verified promotions.

It supports:
- 👤 Consumers: browse and save promotions
- 🏢 Business owners: create and monitor campaigns
- 🛡️ Admins: moderate promotions and access operations tools

---

## 🧩 Core Features
- 🔎 Browse promotions with detail pages
- ❤️ Save promotions (role-based)
- 📊 Dashboard views for different user roles
- 🧾 Promotion creation for business owners
- 🛠️ Operations console for admin workflows
- 🔐 Auth-protected and role-guarded routes

---

## 🛠️ Tech Stack
- ⚛️ React 18
- 🟦 TypeScript
- ⚡ Vite
- 🎨 Tailwind CSS
- 🧱 shadcn/ui + Radix UI
- 🔄 TanStack Query
- 🧭 React Router

---

## ⚡ Quick Start

### 1) Clone and install
```bash
git clone <your-repo-url>
cd promohub-front-end
npm install
```

### 2) Configure environment
```bash
cp .env.example .env
```

### 3) Run locally
```bash
npm run dev
```

App default URL: `http://localhost:5173`

---

## 🔐 Environment Variables
Create a `.env` file in the project root.

```env
VITE_DEV_PORT=5173
VITE_API_BASE_URL=http://localhost:8080
VITE_API_PROXY_TARGET=http://localhost:8080
```

### How these work
- `VITE_DEV_PORT`: Local dev server port
- `VITE_API_BASE_URL`: Direct API base URL for requests
- `VITE_API_PROXY_TARGET`: Vite dev proxy target for `/api` calls (useful for avoiding CORS issues)

> In development, if `VITE_API_PROXY_TARGET` is set, `/api/...` calls are routed through Vite proxy.

---

## 📜 Available Scripts
- `npm run dev` → start development server
- `npm run build` → create production build
- `npm run build:dev` → create development-mode build
- `npm run preview` → preview production build locally
- `npm run lint` → run ESLint
- `npm run test` → run tests via Bun

---

## 🧭 App Routes

<details>
<summary><strong>Click to expand route map</strong> 👇</summary>

| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page |
| `/browse` | Public | Browse promotions |
| `/roadshows` | Public | Roadshows list |
| `/roadshows/:id` | Public | Roadshow details |
| `/promotion/:id` | Public | Promotion details |
| `/how-it-works` | Public | Product explainer |
| `/login` | Public | Login |
| `/register` | Public | Registration |
| `/dashboard` | Authenticated | User dashboard |
| `/saved-promotions` | Consumer/Admin | Saved promotions |
| `/account-settings` | Authenticated | Account settings |
| `/promotions/new` | Business Owner | Create promotion |
| `/operations-console` | Admin | Admin operations console |

</details>

---

## 🔌 Backend Integration Notes
- Ensure your backend API is running (commonly at `http://localhost:8080`).
- Front-end API requests use `/api/...` endpoints.
- If requests fail locally, confirm your `.env` values and restart the dev server.

---

## 🧪 Troubleshooting

<details>
<summary><strong>Common local setup issues</strong> 🧯</summary>

### Port already in use
- Change `VITE_DEV_PORT` in `.env` and restart.

### API not reachable
- Verify backend is running.
- Verify `VITE_API_BASE_URL` or `VITE_API_PROXY_TARGET` points to the correct host/port.

### CORS errors in browser
- Prefer `VITE_API_PROXY_TARGET` in local development.

</details>

---

## ✅ Contributor Quick Checklist
- [ ] Install dependencies
- [ ] Configure `.env`
- [ ] Run `npm run dev`
- [ ] Run `npm run lint`
- [ ] Open a PR with clear testing notes
