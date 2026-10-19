# OAS Bay — Records Management System

Web system for records management at **Oyera Auto Service Bay Ltd (OAS Bay)** — a service bay where heavy, small and commercial cars come in for engine oil and filters, gearbox oil and filters, brake fluids, brake pad changes, greasing, wheel alignment, wheel balancing and other minor repairs.

Built as a full-stack project (Node.js/Express + React + MongoDB) with **login and roles**, **printable receipts** and **monthly reports**.

---

## Features

| Area | What the system does |
|---|---|
| **Login & roles** | JWT login with three roles — **Administrator** (everything + user accounts), **Senior technician** (records + catalogue editing), **Receptionist** (create job cards, customers, mark paid). Enforced on the API *and* reflected in the UI |
| **Dashboard** | Cars in the bay, jobs today, collections today/month (UGX), revenue chart (7 days), low-stock alerts, recent job cards, jobs by status |
| **Job Cards** | Core record: customer, vehicle, date, services, parts & oils used, technicians, senior-technician assessment, labour charge, live totals, status workflow (`Received → In service → Completed → Released`), payment status |
| **Receipts** | One-click printable receipt (`RC-xxxx`, issued automatically the first time a job is marked paid) — clean layout for printing or *Save as PDF* from the browser, with signature lines |
| **Monthly reports** | Month picker → collected vs previous month (±%), billed, unpaid balance, per-day collections chart, services sold, parts & oils sold, technician activity |
| **Stock control** | Parts leave the shop stock when a job card is saved, are adjusted when it is edited, and returned to stock when it is deleted. Overselling is blocked with a clear error |
| **Customers / Vehicles** | Full CRUD; a vehicle's owner is validated against the selected customer; records referenced by job cards are protected from deletion |
| **Parts & Stock** | Filters, engine & gearbox oil, brake fluids, pads, etc. — price, stock on hand, unit, reorder level with dashboard alerts |
| **Service Catalogue** | Wheel alignment (30,000), wheel balancing (20,000) as fixed charges; labour-based services (`Parts + labour`); editable catalogue |
| **Technicians** | Senior technicians (who assess the parts and oils needed) and technicians; many technicians can handle one service |
| **User accounts** | Admin-only screen to create, re-role, deactivate and delete accounts |

All money is in **Ugandan shillings (UGX)**.

---

## Demo logins

| Email | Password | Role |
|---|---|---|
| `admin@oasbay.ug` | `admin123` | Administrator |
| `senior@oasbay.ug` | `senior123` | Senior technician |
| `reception@oasbay.ug` | `reception123` | Receptionist |

(The login screen lists these — click one to fill the form. Change them before any real deployment.)

### What each role can do

| Action | Admin | Senior | Reception |
|---|:--:|:--:|:--:|
| View all records, reports, print receipts | ✅ | ✅ | ✅ |
| Create / edit job cards, mark paid, manage customers & vehicles | ✅ | ✅ | ✅ |
| Add / edit parts, services, technicians | ✅ | ✅ | ❌ |
| Delete job cards, customers, vehicles | ✅ | ✅ | ❌ |
| Delete parts / services / technicians, manage user accounts | ✅ | ❌ | ❌ |

---

## Tech stack

- **Backend:** Node.js, Express 4, Mongoose 8 (ES modules), JWT (`jsonwebtoken`) + `bcryptjs` password hashing
- **Frontend:** React 18, React Router 6, Vite 6 (plain CSS, no UI framework)
- **Database:** MongoDB — *no system install required*: the API boots an embedded MongoDB (`mongodb-memory-server`) with data stored in `server/.data/db` so records persist across restarts. Point `MONGODB_URI` at a real MongoDB to use one instead.

---

## Getting started

```bash
npm install      # installs server + client workspaces
npm run dev      # starts API on :5000 and the app on :5173
```

Open **http://localhost:5173** — sign in with a demo account above. Demo records are seeded automatically on first run (4 customers, 5 vehicles, 11 parts, 8 services, 4 job cards, 3 user accounts).

### Other scripts

| Command | Effect |
|---|---|
| `npm run build` | Production build of the React app (outputs `client/dist`) |
| `npm start` | Run the API only (production style, no watcher) — also serves the built app from `client/dist` when it exists, so the whole system runs on one URL |
| `npm run seed` | Force re-seed the demo data |
| `npm run test:e2e` | Browser end-to-end test (dev servers must be running; uses system Chrome) |

### Production build

```bash
npm run build   # builds the React app into client/dist
npm start       # API + built app on http://localhost:5000
```

The API serves `client/dist` (with an SPA fallback for client-side routes) when the folder exists, so a production deploy is a single Node process. Set `PORT`, `MONGODB_URI` and a real `JWT_SECRET` via `.env` for a live deployment.

---

## Project structure

```
├── server/
│   ├── src/
│   │   ├── index.js            # Express app, auth gate, routes, error handling
│   │   ├── db.js               # embedded MongoDB (or MONGODB_URI)
│   │   ├── seed.js             # demo data + demo user accounts
│   │   ├── middleware/auth.js  # requireAuth (JWT) + requireRole
│   │   ├── models/             # User, Customer, Vehicle, Service, Part, Technician, JobCard, Counter
│   │   └── routes/             # auth, users, customers, vehicles, services,
│   │                           # parts, technicians, jobcards, stats, reports
│   └── .env.example
├── client/
│   └── src/
│       ├── App.jsx             # login gate, layout + routes
│       ├── auth.jsx            # AuthContext (login/logout/roles)
│       ├── api.js              # fetch wrapper with Bearer token
│       ├── components/         # Modal, CrudManager (generic records UI)
│       └── pages/              # Login, Dashboard, JobCards, JobCardForm, JobCardDetail,
│                               # Receipt, Reports, Users, Customers, Vehicles,
│                               # Parts, Services, Technicians
├── tests/
│   └── e2e.mjs                 # browser end-to-end test (puppeteer-core + system Chrome)
└── README.md
```

---

## API overview

Base URL: `http://localhost:5000/api`

**Authentication:** every endpoint except `GET /health` and `POST /auth/login` requires
`Authorization: Bearer <token>` (log in via `POST /auth/login`).

| Resource | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` |
| Users (admin) | `GET/POST /users`, `GET /users/meta/roles`, `PUT/DELETE /users/:id` |
| Customers | `GET/POST /customers`, `GET/PUT/DELETE /customers/:id` |
| Vehicles | `GET/POST /vehicles`, `GET/PUT/DELETE /vehicles/:id`, `GET /vehicles/meta/types` |
| Services | `GET/POST /services`, `PUT/DELETE /services/:id` |
| Parts | `GET/POST /parts`, `GET/PUT/DELETE /parts/:id`, `PATCH /parts/:id/stock {delta}`, `GET /parts/meta/categories` |
| Technicians | `GET/POST /technicians`, `PUT/DELETE /technicians/:id`, `GET /technicians/meta/roles` |
| Job cards | `GET/POST /jobcards`, `GET/PUT/DELETE /jobcards/:id`, `PATCH /jobcards/:id` (status/payment → assigns receipt number) |
| Stats / reports | `GET /stats` (dashboard), `GET /reports?month=YYYY-MM` (monthly report) |
| Health | `GET /health` |

Job card totals are always **services + parts + labour** and are recomputed server-side; service/part names and prices are snapshotted onto the job card so historical invoices never change.

---

## Business rules taken from the brief

- Labour in the service bay: **UGX 20,000** (default per job card, editable — e.g. set to 0 for alignment-only jobs).
- Wheel alignment: **UGX 30,000** · Wheel balancing: **UGX 20,000** (fixed services).
- Engine oils: **79,000 – 200,000** · Brake fluids: **13,000 – 20,000** · Oil filters: **15,000 – 20,000**.
- A car can come in for one or more services a day; one or more technicians can handle a service.
- A senior technician determines the parts and oils needed for the car (recorded as *Assessed by* on the job card).

### Assumptions (things the brief left open)

1. "Brake fluids range between 13000-2000" was read as **13,000 – 20,000**.
2. Prices for items the brief did not price (gearbox oil 95,000, brake pads 65,000/75,000, air filter 25,000) are sensible defaults — all editable in the Parts screen.
3. Services with a catalogue price of **0** mean *"parts + labour"* (labour shown separately on the invoice).
4. Revenue figures on the dashboard and reports count **paid** job cards, recognised on the job's date in.
5. Receipt numbers (`RC-xxxx`) are issued the first time a job card is marked paid and are kept if it is later un-paid.
6. Demo passwords are plain defaults for coursework — set a real `JWT_SECRET` and change passwords before deploying.

### Possible next steps

- E-mail/SMS receipts to car owners when a job is released
- Excel/CSV export of the monthly report
- Stock purchase/supplier records (beyond quantity on hand)
- Pagination for very large job lists
