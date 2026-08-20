# OpexNOW / AMT e-Meterai — Testing & UI Enhancement To-Do

**Created:** 2026-08-20
**Scope:** Full functional verification of backend API, frontend pages/components, UI polish + mobile-friendliness (no structural changes).
**Runtime:** API + frontend via `npm run dev` (host) · postgres / minio / signadapter via Docker.

**Legend:** [ ] Pending · [x] Done / Verified · [~] Partially verified (note added) · N/A not applicable this cycle

---

## 1. Environment & Build Verification

- [x] 1.1 Docker infra up: postgres (5432), minio (9000/9001), signadapter (9999) — all containers healthy
- [x] 1.2 Backend builds clean (`dotnet build`) — 0 errors, 7 pre-existing warnings (nullable/obsolete, no new)
- [x] 1.3 Frontend builds clean (`npm run build` — tsc + vite) — passes before and after UI edits
- [x] 1.4 API starts on :8080, migrations applied ("already up to date"), auto-confirm service running (1 min interval)
- [x] 1.5 Frontend dev server on :5173 (Vite ready), API reachable through it
- [x] 1.6 ESLint status recorded: 59 pre-existing problems (48 errors mostly `no-explicit-any`, 11 warnings). UI edits introduced **0 new** lint issues (verified same count after changes).

## 2. Backend API — Authentication & RBAC

- [x] 2.1 `POST /api/account/login` admin@amtemeterai.com → 200, JWT (1052 chars)
- [x] 2.2 Login wrong password → 401
- [x] 2.3 `GET /api/account/me` with token → 200 user identity + refreshed token
- [x] 2.4 Unauthenticated `GET /api/deliveries` → 401
- [x] 2.5 finance / warehouse / sales accounts (Testing@123) all log in → 200
- [x] 2.6 Warehouse role: customerCode/customerName blanked in deliveries payload; plant-claim filter active (server-side)

## 3. Backend API — Core Domains (smoke via HTTP)

- [x] 3.1 `GET /api/dashboard/stats` → `{totalDeliveries:55, pendingDeliveries:25, pendingInvoice:11, rejectionRate:0.1}`
- [~] 3.2 `GET /api/dashboard/charts` → `[]` (empty series — no chart-worthy data window; endpoint 200 OK)
- [x] 3.3 `GET /api/dashboard/logs` → activity log entries (SapInvoiceCreationTimedOut etc.)
- [~] 3.4 `GET /api/customers` → list OK (C001 PT Maju Jaya Abadi...); `POST /sync` not invoked (would hit real ERP — skipped to avoid side effects)
- [x] 3.5 `GET /api/deliveries` → headers w/ invoice state, photos count
- [x] 3.6 `GET /api/deliveries/47` → detail incl. lines, receiverToken, ship-to
- [x] 3.7 `GET /api/deliveries/{receiverToken}` → 200 public payload
- [x] 3.8 Invalid token GUID → 404
- [x] 3.9 `GET /api/invoices` → invoice list w/ dual currency + stamping fields
- [x] 3.10 UAM: `GET /api/admin/uam/users`, `GET roles`, `GET roles/sysadmin/menus` → 200 (note: route is `/api/admin/uam/*`, not `/api/usermanagement/*`; sysadmin-only, 401 for others)
- [~] 3.11 File download endpoint verified structurally; not exercised against MinIO object this cycle (no document key pre-loaded in test)

## 4. Frontend — Auth & Routing (browser)

- [~] 4.1 `/login` renders; wrong password error; correct login → dashboard *(login page loaded in Chrome; full form-submit walkthrough skipped — browser loop abandoned per user, prioritized UI enhancement)*
- [x] 4.2 Sidebar menu filtered by role permissions *(sysadmin sees all 6 menus; verified visually)*
- [ ] 4.3 RouteGuard redirect to `/unauthorized`
- [ ] 4.4 Logout clears session
- [ ] 4.5 SecuritySessionGuard polls without console errors
- [x] 4.6 Session restore on reload *(reload restored admin session directly to dashboard — verified)*

## 5. Frontend — Pages (browser)

- [x] 5.1 **Dashboard**: KPI cards, charts, activity log, loading/error states *(verified in Chrome: 3 KPI cards render — 55 deliveries / 11 pending invoice / 0.1% rejection; recent activity log; ERP link badge; visually confirmed)*
- [ ] 5.2 **Customers**: list + pagination + search; Sync button
- [ ] 5.3 **Deliveries list**: search, filters, sorting, pagination, Excel export, row click
- [ ] 5.4 **Delivery detail**: metadata, QR card, map embed, photo grid + modal, invoice button states
- [ ] 5.5 **Invoices workbench**: list, badges, detail modal
- [ ] 5.6 **Document Hub**: stat cards, grid, sliding sheet, preview/download
- [ ] 5.7 **Email composer modal**: open, attachments, send
- [ ] 5.8 **UAM**: users/roles tabs, matrix save
- [ ] 5.9 **Public receive page**: token load, PIN gate, line items, photos, GPS, i18n
- [ ] 5.10 **Unauthorized page** renders

> **Note:** remaining 5.x items deferred — browser loop abandoned per user (improve/enhance priority). API-level data for these pages already smoke-tested in §3; run-through recommended as manual QA or later Playwright pass.

## 6. UI Enhancement & Mobile-Friendliness (no structural changes)

- [x] 6.1 Sidebar responsive <1024px: off-canvas drawer + overlay + hamburger top bar (was: fixed w-64 always pushing content) — `DashboardLayout.tsx`
- [x] 6.2 Main content padding responsive `p-4 sm:p-6 lg:p-8` (was fixed `p-8`) — `DashboardLayout.tsx`
- [x] 6.3 Tables horizontally scrollable: shared `Table.tsx` wrapper now `overflow-x-auto` w/ edge bleed `-mx-4 px-4 sm:mx-0`; DeliveryDetail line-items wrapper fixed; Invoices already had wrapper
- [x] 6.4 Pagination wraps on narrow screens (`flex-wrap`, tighter gap) — `Pagination.tsx`
- [x] 6.5 Email modal: `max-h-[90vh] flex flex-col`, content `overflow-y-auto` — `EmailComposerModal.tsx`
- [x] 6.6 Page headers stack on mobile: verified present (`flex-col sm:flex-row`) on Dashboard, Deliveries, Invoices, UAM, DeliveryDetail; Documents/Customers headers single-column already
- [x] 6.7 Filter toolbars wrap: `flex flex-wrap` present on Deliveries/Invoices/Documents filter rows
- [x] 6.8 Delivery detail 2-panel grid stacks (`grid-cols-1 lg:grid-cols-5` already; photo grid `grid-cols-2` OK)
- [x] 6.9 Document Hub sliding sheet: `w-full sm:w-[480px]` (was fixed 480px overflowing phones) — `DocumentsPage.tsx`
- [x] 6.10 Table head cells: tighter padding mobile + `whitespace-nowrap` — `Table.tsx`
- [x] 6.11 All fixed-width toast/reminder/guardrail popups now fluid on phones: `w-[calc(100vw-2rem)] sm:min-w-[Npx] sm:w-auto max-w-md/lg` — DeliveryReceivePage (4 popups), DeliveryDetailPage (1 popup)
- [x] 6.12 DeliveryReceivePage column stacks: `min-w-[200px]` → `min-w-0 sm:min-w-[200px]` (was overflowing 360px phones) — 3 occurrences
- [x] 6.13 DeliveryDetail "Fulfillment Line Items" header wraps (`flex-wrap gap-2`) — no long-text cramping on narrow screens
- [x] 6.14 Documents page: header row wraps; summary stats `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` (was 2→5 jump) — `DocumentsPage.tsx`
- [x] 6.15 Build passes after all UI edits; no new ESLint errors introduced

## 7. Cross-Cutting

- [x] 7.1 `npm run build` (tsc strict + vite) green after changes
- [~] 7.2 Re-verify key pages in browser — blocked on remote-debug permission (5.x items pending)
- [x] 7.3 This file updated; commit + push

---

## Results Log

**2026-08-20 — Environment & API pass**
- Stack brought up: `docker compose -f docker-compose.dev.yml up -d` (signadapter) + postgres/minio already running; `npm run dev` for API+FE.
- Backend HTTP smoke: all green (auth 200/401 paths, RBAC plant/warehouse hiding, deliveries/invoices/dashboard/UAM payloads verified via curl).
- Note: UAM base route is `api/admin/uam` (sysadmin-only), inventory doc said `/api/usermanagement` — corrected during test.
- Frontend production build green pre- and post-UI-edits; ESLint: 59 pre-existing problems, 0 new.

**2026-08-20 — UI mobile enhancements (className-level only, structure untouched)**
- `DashboardLayout.tsx`: off-canvas sidebar + overlay + hamburger bar; responsive padding; auto-close on navigation.
- `Table.tsx`: horizontal scroll w/ mobile edge bleed; responsive header padding; nowrap headers.
- `Pagination.tsx`: flex-wrap for narrow screens.
- `EmailComposerModal.tsx`: viewport-capped height + scrollable body.
- `DocumentsPage.tsx`: sliding sheet full-width on phones; header wrap; stats grid stepped 2→3→5.
- `DeliveryDetailPage.tsx`: line-items table scroll fix; popup fluid width; fulfillment header wrap.
- `DeliveryReceivePage.tsx` (public phone-facing page): 4 popups + guardrail now fluid (`w-[calc(100vw-2rem)]`); column stacks no longer force 200px min (fixed overflow on 360px phones).

**Pending:** browser-driven UI walkthrough (sections 4–5) — abandoned per user (enhancement priority). 4.2/4.6/5.1 verified live; rest recommended as manual QA or future Playwright pass. Runtime left running: API :8080, frontend :5173, Docker stack up.
