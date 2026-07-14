# OpexNOW Production Deployment Checklist

## 🔐 Pre-Deployment Security Checklist

### Default Accounts - MUST CHANGE IMMEDIATELY

| Account | Email | Default Password | Role | Action Required |
|---------|-------|------------------|------|-----------------|
| System Admin | `admin@amtemeterai.com` | `Admin@123` | sysadmin | **CHANGE PASSWORD** or disable immediately |
| Finance User | `finance@amtemeterai.com` | `Testing@123` | finance | **DISABLE** in production |
| Warehouse User | `warehouse@amtemeterai.com` | `Testing@123` | warehouse | **DISABLE** in production |
| Sales User | `sales@amtemeterai.com` | `Testing@123` | sales | **DISABLE** in production |

**Post-Migration Actions:**
- [ ] Change default admin password
- [ ] Disable all test accounts
- [ ] Create production admin accounts with secure passwords
- [ ] Enable multi-factor authentication (if implemented)
- [ ] Review and update plant assignments for production users

---

## 🌐 External Network Connectivity Requirements

### Firewall Rules - Outbound HTTPS/HTTP Access

| External Service | Protocol | Port | URL/IP | Purpose |
|------------------|----------|------|--------|---------|
| **Peruri Backend Staging** | HTTPS | 443 | `backendservicestg.e-meterai.co.id` | JWT authentication |
| **Peruri Stamp v2 Staging** | HTTPS | 443 | `stampv2stg.e-meterai.co.id` | e-Meterai allotment |
| **Peruri Inventory Staging** | HTTPS | 443 | `inventory.peruri.co.id` | Inventory management |
| **Peruri Cloud API (Legacy)** | HTTPS | 443 | `api.peruri.go.id` | Cloud stamping fallback |
| **SAP ERP Server** | HTTP | 8000 | `10.2.38.138:8000` | Delivery confirmation & billing |
| **Google Maps API** | HTTPS | 443 | `maps.googleapis.com` | Reverse geocoding |
| **AMT Corporate Mail** | SMTP | 587 | `mail.amt.co.id` | Email notifications |

**Firewall Configuration:**
```bash
# Example firewall rules (Linux/iptables)
# Peruri Services
iptables -A OUTPUT -p tcp --dport 443 -d backendservicestg.e-meterai.co.id -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d stampv2stg.e-meterai.co.id -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d inventory.peruri.co.id -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d api.peruri.go.id -j ACCEPT

# SAP ERP
iptables -A OUTPUT -p tcp --dport 8000 -d 10.2.38.138 -j ACCEPT

# Google Maps
iptables -A OUTPUT -p tcp --dport 443 -d maps.googleapis.com -j ACCEPT

# SMTP (STARTTLS)
iptables -A OUTPUT -p tcp --dport 587 -d mail.amt.co.id -j ACCEPT
```

---

## 🐳 Internal Docker Container Networking

### Container Port Mapping & Dependencies

| Container Name | Internal Port | External Port | Purpose | Dependencies |
|----------------|---------------|---------------|---------|--------------|
| **opexnow-postgres** | 5432 | 5432 | PostgreSQL database | None |
| **opexnow-minio** | 9000, 9001 | 9000, 9001 | Object storage | None |
| **opexnow-signadapter** | 7777 | 7777 | Peruri signing adapter | None |
| **opexnow-api** | 8080 | - | ASP.NET Core backend | postgres, minio, signadapter |
| **opexnow-frontend** | 5173 | - | React frontend | api |
| **opexnow-nginx** | 80 | 80 | Reverse proxy | frontend, api |
| **opexnow-minio-init** | - | - | MinIO initialization | minio |

### Internal DNS Resolution (Container-to-Container)

| Source Container | Target DNS Name | Target Port | Purpose |
|-----------------|-----------------|-------------|---------|
| api | postgres | 5432 | Database connection |
| api | minio | 9000 | Object storage |
| api | signadapter | 7777 | e-Meterai signing |
| frontend | api | 8080 | API calls (via Nginx) |
| nginx | frontend | 5173 | Static file serving |
| nginx | api | 8080 | API proxy |

**Docker Network Configuration:**
```yaml
networks:
  default:
    name: opexnow_default
    driver: bridge
```

---

## 📁 Critical File Paths & Volume Allocations

### Named Volumes

| Volume Name | Mount Path (Container) | Purpose | Persistence |
|-------------|------------------------|---------|-------------|
| `postgres_data` | `/var/lib/postgresql/data` | PostgreSQL data files | **Persistent** |
| `minio_data` | `/data` | MinIO object storage | **Persistent** |
| `stamping-share` | `/app/sharefolder` (api & signadapter) | PDF exchange for e-Meterai | **Ephemeral** |

### Volume Details

**`stamping-share` (Critical for e-Meterai):**
```
Purpose: File exchange between API and KeyStamp adapter
Mount Points:
  - api container: /app/sharefolder
  - signadapter container: /app/sharefolder

Directory Structure:
  /app/sharefolder/
    ├── UNSIGNED/          # Unsigned PDFs placed here
    ├── STAMP/             # QR code images placed here
    └── SIGNED/            # Signed PDFs appear here

Permissions: chmod 777 (for container-to-container access)
Cleanup: Individual files deleted after stamping (directories retained)
```

### Log Paths

| Component | Log Path | Purpose | Rotation |
|-----------|----------|---------|-----------|
| API | `/app/logs` (container) | Application logs | Docker log driver |
| KeyStamp | `/app/logs` (host mount) | Signing adapter logs | Manual cleanup |

### Backup Requirements

**Persistent Volumes to Backup:**
- [ ] `postgres_data` - Daily full backup required
- [ ] `minio_data` - Daily incremental backup recommended

**Backup Script Location:**
```
/path/to/backups/
├── postgres/
│   └── daily_YYYYMMDD.sql.gz
└── minio/
    └── incremental_YYYYMMDD.tar.gz
```

---

## 🔌 Environment Configuration Verification

### Production Environment Variables Required

Before deployment, verify all placeholders are replaced:

```bash
# Critical Security Variables
JWT_SECRET=                    # ✅ Must be 256+ bit secure key
DB_PASSWORD=                   # ✅ Must be strong password
MINIO_SECRET_KEY=              # ✅ Must be strong password
SAP_PASSWORD=                  # ✅ Must be SAP production credentials
PERURI_PASSWORD=               # ✅ Must be Peruri production credentials
SMTP_PASSWORD=                 # ✅ Must be SMTP account password
GOOGLE_MAPS_API_KEY=          # ✅ Must be production API key

# Application Configuration
PUBLIC_BASE_URL=              # ✅ Must be production frontend URL
API_BASE_URL=                 # ✅ Must be production API URL
CORS_ORIGINS=                 # ✅ Must be production frontend domains
```

---

## 🚀 Deployment Sequence

### 1. Pre-Deployment
- [ ] Review and update all environment variables
- [ ] Verify firewall rules are in place
- [ ] Confirm external service availability (SAP, Peruri, SMTP)
- [ ] Prepare production SSL certificates (if using HTTPS)
- [ ] Verify DNS records for production domains

### 2. Container Deployment
- [ ] Pull latest Docker images
- [ ] Create Docker network if not exists
- [ ] Start PostgreSQL container
- [ ] Start MinIO container
- [ ] Run MinIO initialization (createbuckets)
- [ ] Start KeyStamp adapter container
- [ ] Start API container
- [ ] Start Frontend container
- [ ] Start Nginx reverse proxy
- [ ] Verify all containers are running

### 3. Post-Deployment Verification
- [ ] Test database connection
- [ ] Test MinIO connectivity
- [ ] Test Peruri authentication
- [ ] Test SAP connectivity
- [ ] Test SMTP email sending
- [ ] Test Google Maps geocoding
- [ ] Verify e-Meterai stamping workflow
- [ ] Test delivery confirmation flow
- [ ] Test invoice generation and stamping

### 4. User Access Setup
- [ ] Change default admin password
- [ ] Disable test accounts
- [ ] Create production user accounts
- [ ] Assign plant permissions
- [ ] Configure role-based access control

---

## 🧪 Post-Deployment Testing Checklist

### Functional Testing

| Feature | Test Case | Expected Result | Status |
|---------|-----------|-----------------|--------|
| Authentication | Login with admin account | Successful JWT auth | [ ] |
| Dashboard | Load dashboard stats | Display KPIs | [ ] |
| Customers | Sync customers from ERP | Successful sync | [ ] |
| Deliveries | Create delivery via API | Delivery created | [ ] |
| Deliveries | Confirm delivery with photos | Delivery confirmed, SAP synced | [ ] |
| Invoices | Generate SAP invoice | Invoice created in SAP | [ ] |
| e-Meterai | Stamp invoice | Document stamped with serial | [ ] |
| Storage | Upload/download documents | MinIO operations successful | [ ] |
| Email | Send PIN email | Email received | [ ] |
| Geocoding | Reverse geocode GPS lat/lng | Address returned | [ ] |

### Integration Testing

| Integration | Endpoint | Test Method | Status |
|-------------|----------|-------------|--------|
| SAP ERP | `POST /sap/bc/zrest_doconfirm` | Test delivery confirmation | [ ] |
| SAP ERP | `POST /sap/bc/zr_createinv` | Test invoice creation | [ ] |
| Peruri | `POST /api/users/login` | Test JWT authentication | [ ] |
| Peruri | `POST /chanel/stampv2` | Test stamp allotment | [ ] |
| KeyStamp | `POST /adapter/pdfsigning/rest/docSigningZ` | Test PDF signing | [ ] |
| MinIO | `PUT/GET /objects` | Test storage operations | [ ] |
| SMTP | `SEND email` | Test email delivery | [ ] |
| Google Maps | `Geocoding API` | Test reverse geocoding | [ ] |

---

## 📊 Monitoring & Health Checks

### Health Check Endpoints

| Service | Health Check URL | Expected Response |
|---------|------------------|-------------------|
| API | `GET /api/health` (if implemented) | 200 OK |
| API Swagger | `GET /api/swagger` | 200 OK |
| Frontend | `GET /` | 200 OK |
| MinIO | `GET /minio/health/live` | 200 OK |
| PostgreSQL | `pg_isready` | Connection accepted |

### Critical Metrics to Monitor

- [ ] Container resource usage (CPU, Memory, Disk)
- [ ] Database connection pool utilization
- [ ] API response times
- [ ] Failed login attempts
- [ ] e-Meterai stamping failures
- [ ] SAP sync failures
- [ ] Email delivery failures
- [ ] MinIO storage capacity

---

## 🔄 Rollback Procedures

### Rollback Triggers
- Critical service failures
- Database migration errors
- External integration failures
- Security incidents

### Rollback Steps
1. Stop all containers: `docker-compose down`
2. Restore previous database backup
3. Restore previous MinIO data (if needed)
4. Revert to previous Docker images
5. Restart containers: `docker-compose up -d`
6. Verify system functionality

---

## 📞 Emergency Contacts

| Role | Contact | Responsibility |
|------|---------|----------------|
| **System Administrator** | [Phone/Email] | Container infrastructure, networking |
| **Database Administrator** | [Phone/Email] | PostgreSQL maintenance, backups |
| **SAP Integration Team** | [Phone/Email] | SAP connectivity, credentials |
| **Peruri Support** | [Phone/Email] | e-Meterai service issues |
| **Network Administrator** | [Phone/Email] | Firewall, DNS, SSL certificates |

---

## ✅ Final Go-Live Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Solution Architect** | | | |
| **DevOps Engineer** | | | |
| **Database Administrator** | | | |
| **Security Officer** | | | |
| **Product Owner** | | | |

---

**Document Version:** 1.0
**Last Updated:** 2025-07-14
**Next Review:** Post-go-live (7 days)
