# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Tripio is a homestay booking system (graduation thesis project): an ASP.NET Core 9 Web API (`backend/`, project `HomestayAuth.Api`), a React 19 + Vite SPA (`frontend/`, also packaged for Android/iOS with Capacitor), and PostgreSQL hosted on Neon. Docs, UI text and error messages are in Vietnamese; keep new user-facing strings in Vietnamese. Roles: `Customer`, `Host`, `Admin`, `Support` (Admin/Support are never self-registered).

## Commands

Setup: copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`. Backend requires `JWT_SECRET` and `DATABASE_URL` (a `postgres://` Neon URI is accepted and converted) or it throws at startup. Optional: Supabase storage, Google/Facebook OAuth, VNPay, SMTP vars.

```powershell
npm run install:all          # dotnet restore backend + npm install frontend
npm run dev                  # backend (:5000) and frontend (:5173) concurrently
dotnet run --project backend # backend only; health: GET /api/health, /api/health/database
npm run dev --prefix frontend
npm run build --prefix frontend
npm run verify               # scripts/verify.ps1: builds both, then smoke-tests a RUNNING backend (health, catalog, quote)
```

Building the backend while it is running: `bin/` is locked, so build to a throwaway output dir (the repo convention, all gitignored): `dotnet build backend/HomestayAuth.Api.csproj -p:UseAppHost=false -o .build-<name>`.

Tests (no xUnit/NUnit — each test project is a console app that exits non-zero on failure):

```powershell
dotnet run --project tests/BookingRules.Checks          # booking rule / pricing checks (references backend)
dotnet run --project tests/DemandForecast.Checks        # compiles DemandForecastModel.cs only
dotnet run --project tests/BookingConcurrency.Integration  # needs TEST_DATABASE_URL pointing at a DISPOSABLE Postgres DB
npm test --prefix frontend                              # node --test src/**/*.test.js
node --test frontend/src/features/homestays/pages/bookingGuestValidation.test.js  # single frontend test file
node --test ai/topk/model.test.mjs                      # offline Top-K recommender tests
```

There is no linter configured.

## Architecture

### Backend (modular monolith)
- `Features/<Module>/` holds controllers, services and DTOs per business area (Auth, Homestays, Bookings, Admin, Analytics, DemandForecasting, Recommendations, Reviews). Several empty modules (`Rooms`, `Payments`, `Administration`) are placeholders — room, payment and VNPay logic actually live in `Features/Bookings/`.
- Rules from `docs/architecture.md`: controllers only handle HTTP and call services; business rules live in services; return DTOs, never entities; `Infrastructure` holds data access only; modules don't call each other's controllers.
- `Domain/Entities/` + `Infrastructure/Persistence/AppDbContext.cs` (EF Core, Npgsql, snake_case column mapping in the DbContext).
- **Schema management**: there are no EF migrations. `Program.cs` runs a large idempotent raw-SQL block at startup (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). When adding an entity/column, update the entity, `AppDbContext`, **and** that startup SQL; `database/*.sql` and `database/migrations/` are reference/seed scripts for Neon (`init.sql`, `current-schema.sql`, demo seeds).
- All services are registered manually in `Program.cs`. Background workers: `ExpiredBookingWorker` (releases expired payment holds), `OutboxWorker` (processes `OutboxMessages`, e.g. `refund.requested`), `RecommendationEventRetentionService`.
- Auth: JWT carried as an HttpOnly `token` cookie **or** an `Authorization: Bearer` header (for Safari/iOS cross-site). `OnTokenValidated` re-checks the user is `Active` and that the `auth_version` claim matches `User.AuthVersion` — bumping `AuthVersion` invalidates sessions. Admin endpoints use policies `AdminPolicies.Access` (Admin+Support) / `AdminPolicies.FullAccess` (Admin). Rate-limit policies (`auth-login`, `auth-register`, `auth-otp`, `recommendation-events`) are defined in `Program.cs`.
- Env loading: `Utilities/EnvLoader.cs` reads `.env` from the cwd or `backend/.env`; config comes from environment variables, not `appsettings.json`.

### Booking flow (see `docs/booking-flow.md`, `docs/compensation-workflow.md`)
- `POST /api/bookings/quote` is the authoritative price; the client never computes the charged amount (`BookingPricingService`, `BookingRules`).
- All advisory locks go through `Features/Bookings/AdvisoryLocks.cs` (two-key form, one namespace per entity); never call `pg_advisory_xact_lock` directly. Lock order: booking → room type → voucher. Room-level flows lock the room's *room type* (`RoomInventoryService.LockRoom`) so they serialize with online booking. Concurrency correctness is covered by `tests/BookingConcurrency.Integration`.
- Creating a booking re-checks availability (`BookingAvailability`) under that lock and creates a `Hold` booking for `HoldMinutes` (default 15). A `BookingRoomStay` only blocks a room while its booking is reserved or an unexpired hold (`BookingAvailability.BlockingStays`). Unpaid holds end as `Expired` (retryable), never `Cancelled`.
- Quote and real booking share `ComputeTotals` in `BookingsController`; change pricing there only.
- VNPay return URL and IPN share the same idempotent handler; late/duplicate payments create a `Pending` refund rather than reclaiming the room. Refunds are not sent to VNPay automatically.
- Statuses `Confirmed`, `CheckedIn`, `CancellationRequested` keep holding inventory. Physical rooms go `Cleaning` after checkout and must be set back to `Available`. Time is resolved per homestay time zone via `IHomestayClock` (default `Asia/Ho_Chi_Minh`).

### Frontend
- No router library: `src/app/App.jsx` holds view state (`view`, selected homestay, user) and switches pages manually, reading `window.location` for special paths (payment return, error codes).
- `src/features/<feature>/{api,components,pages,styles}`; code moves to `src/shared/` only when used by 2+ features. Host-side screens live under `features/homestays/pages/Host*`, admin under `features/admin/`.
- All HTTP goes through `shared/api/apiClient.js` (`VITE_API_URL`, `credentials: 'include'`, Bearer token from session/localStorage key `tripio-access-token`, 20s timeout). Each feature's `api/*.js` wraps it. It also sends `X-Requested-With`, which the backend CSRF guard in `Program.cs` requires for cookie-authenticated non-GET requests — a raw `fetch` write without it gets 403.
- Uploaded images must be validated with `Features/Homestays/Services/ImageUpload.cs` (magic bytes) and stored image URLs checked with `ImageUpload.IsAllowedUrl`; never store base64 data URLs (`image_url` is `VARCHAR(500)`).
- Styling is plain CSS files per page/feature plus `shared/styles/`; there is no CSS framework.
- Mobile: `npm run build:mobile` uses `.env.mobile`; `mobile:sync*` / `mobile:run` drive Capacitor (see `MOBILE_SETUP.md`, `frontend/MOBILE.md`, `frontend/PWA.md`).

### AI modules
- `ai/topk/` — offline Node scripts for the Top-K recommender baseline (demo data only, never written to Neon); the live version is `Features/Recommendations` (`GET /api/recommendations`, events in `recommendation_events`, weights from `RecommendationWeightsProvider`).
- `ai/demand/README.md` documents the demand forecast (`seasonal-trend-v2` vs baselines with walk-forward backtest) implemented in `Features/DemandForecasting`; returns `insufficient_data` instead of fabricating forecasts.

## Deployment
Backend: Docker (`backend/Dockerfile`) on Render, env vars set in the Render dashboard; uploaded images must go to Supabase Storage (Render disk is ephemeral). Frontend: Vercel (`vercel.json`) or Netlify (`netlify.toml`) with SPA fallback. CORS origins come from `CLIENT_URL` / comma-separated `CLIENT_URLS`.
