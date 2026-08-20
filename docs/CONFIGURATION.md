# AMT e-Meterai — Configuration & Environment Switching Guide

One place to understand every knob: what it does, where it lives, how to flip it.

---

## 1. The Big Picture

```
.env  ──►  docker-compose.yml  ──►  container env vars  ──►  .NET configuration
(server)      (${VAR:-default})        (Section__Key)          (AddEnvironmentVariables)
```

- **App secrets/values NEVER live in `appsettings.json` for prod** — they come from `/opt/amtemeterai/.env` on the server.
- Changing any value = **edit `.env` → `docker compose up -d api`**. No image rebuild. ~10 seconds.
- `appsettings.json` in the image = last-resort defaults only.

---

## 2. Dev ⇄ Production Toggle (the one you asked for)

### `EMAIL_STAGING_MODE` — email routing

| Mode | Value | Behaviour |
|---|---|---|
| **Development/Staging** | `true` *(default)* | ALL delivery-confirmation + PIN emails go to `EMAIL_STAGING_TO` / `EMAIL_STAGING_PIN_TO` (you), never to real customers |
| **Production** | `false` | Confirmation → real **salesperson email** (from delivery record); PIN → real **customer email** |

```bash
# on server (192.168.0.191), /opt/amtemeterai
nano .env                  # set EMAIL_STAGING_MODE=false
docker compose up -d api   # applies, no rebuild
```

**Safety**: default is `true`. Code-level default (`EmailRoutingOptions.EnableStagingMode = true`) also guards against a missing config — email can never silently leak to customers by accident.

### `CUSTOMER_SOURCE` — SAP real vs dummy

| Value | Behaviour |
|---|---|
| `Erp` | Real SAP/ERP integration (`ErpCustomerSource`, hits `SAP_BASE_URL`) |
| `Dummy` | Seeded test data, no SAP calls |

### Related SAP / Peruri endpoint switching

```env
SAP_BASE_URL=http://10.2.38.138:8000      # dev SAP; change for prod SAP
SAP_CLIENT=250
SAP_USERNAME=OPEXCG01
SAP_PASSWORD=********
PERURI_BACKEND_STG=https://backendservicestg.e-meterai.co.id   # Peruri staging
PERURI_STAMP_V2_STG=https://stampv2stg.e-meterai.co.id
PERURI_USER=opex_emet@yopmail.com
PERURI_PASSWORD=********
```

> Peruri currently only has **staging** base URLs wired (`BackendStg`/`Stampv2Stg`). When Peruri issues production endpoints, add `Peruri__Backend` keys + `.env` vars — code change needed (options class has only `Stg` fields).

### Geolocation email — `GOOGLE_MAPS_API_KEY`

Reverse-geocoding (GPS → `Province`/`CityRegency`/`District`) on receiver confirmation. Uses one billable Google API call per confirmation with GPS. **The key currently in git is a truncated placeholder (`AIzaSy...5pmI`) — prod geocoding silently fails.** Set a real key in `.env`.

---

## 3. Go-Live Checklist

Run through in order, on the server:

1. **Email mode** — `.env`: `EMAIL_STAGING_MODE=false` → `docker compose up -d api`. Verify: trigger a test delivery confirmation, confirm it hits the salesperson inbox.
2. **Admin password** — change seeded `admin@amtemeterai.com` / `Admin@123` immediately.
3. **Secrets rotation** — `JWT_SECRET` (256-bit random), `DB_PASSWORD`, `SMTP_PASSWORD`, `SAP_PASSWORD`, `MINIO_ROOT_PASSWORD`. Generate: `openssl rand -base64 48`.
4. **Google Maps key** — real key with billing + HTTP-referrer/api restrictions.
5. **CORS** — `CORS_ORIGINS=http://your-prod-domain` (comma-separated). Same-origin via nginx means this mostly matters if frontend served elsewhere.
6. **SAP endpoint** — confirm `SAP_BASE_URL` points at the production SAP instance, and that this host can reach it.
7. **Backups** — Postgres data volume + MinIO documents volume. Not yet automated — schedule before go-live (see §5).
8. **Test accounts** — remove/disable seeded test users (`warehouse@`, `sales@`, `finance@`, `syarif@` — keep only real staff).
9. **Peruri saldo** — top up production meterai quota; dashboard reads it live.
10. **Swap `.enva` → `.env`** if the customer-provisioned env file exists for this deployment.

---

## 3b. Quick Verification Snippets

```bash
cd /opt/amtemeterai

# Which mode is the API actually running in?
docker exec amtemeterai-api env | grep EmailRouting

# Read effective config the app sees (per-key):
docker exec amtemeterai-api sh -c 'env | grep SapOptions'

# Full endpoint smoke test:
TOKEN=$(curl -s -X POST http://localhost/api/account/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@amtemeterai.com","password":"<current>"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s http://localhost/api/dashboard/stats -H "Authorization: Bearer $TOKEN" | head -c 400
```

---

## 4. Full `.env` Variable Reference

| Variable | Default (if unset) | Purpose |
|---|---|---|
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_PORT` | — | Postgres connection |
| `JWT_SECRET` / `JWT_ISSUER` / `JWT_AUDIENCE` | — | Auth token signing |
| `PUBLIC_BASE_URL` / `API_BASE_URL` | — | URLs used in emails/QR |
| `CUSTOMER_SOURCE` | `Erp` | `Erp` = real SAP, `Dummy` = test data |
| **`EMAIL_STAGING_MODE`** | **`true`** | Email routing toggle |
| `EMAIL_STAGING_TO` / `EMAIL_STAGING_CC` / `EMAIL_STAGING_PIN_TO` | arga@opexcg.com | Staging recipients (you) |
| `SAP_BASE_URL` / `SAP_CLIENT` / `SAP_USERNAME` / `SAP_PASSWORD` | dev SAP values | ERP endpoint + creds |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_ENABLE_SSL` / `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_SENDER_EMAIL` / `SMTP_SENDER_NAME` | mail.amt.co.id / 587 | Outbound email |
| `GOOGLE_MAPS_API_KEY` | — | Reverse geocoding |
| `PERURI_BACKEND_STG` / `PERURI_STAMP_V2_STG` / `PERURI_USER` / `PERURI_PASSWORD` | Peruri staging | e-Meterai stamping |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | — | Object storage |
| `CORS_ORIGINS` | localhost | Allowed browser origins |
| `VITE_APP_ENV_TAG` | — | Frontend label |

---

## 5. Known Gaps (do before or shortly after go-live)

- **Backups not automated** — no cron for `pg_dump` or MinIO mirror. Data-loss risk if the host dies.
- **Secrets in git history** — `appsettings.json` historically committed with real SMTP/SAP/Minio/Peruri passwords. They must be rotated at go-live (checklist §3.3); consider a repo scrub later if the repo ever goes shared.
- **Peruri prod endpoints** — options class only has `Stg` fields.
- **No HTTPS on `PUBLIC_BASE_URL`** — receiver links/QR use plain HTTP; needs a certificate + domain before customer-facing use.
- **Admin password** — seeded default still active.

---

*Last updated: 2026-08-20 — wiring shipped with compose env passthroughs + `EmailRouting` toggle.*
