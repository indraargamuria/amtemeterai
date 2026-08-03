# AmtemeterAI Docker Configuration Documentation

## Overview

The Docker setup consists of a unified stack orchestrated using Docker Compose with version 3.9. The configuration includes a reverse proxy, React frontend, ASP.NET Core API, PostgreSQL database, MinIO object storage, and Peruri e-Meterai signing adapter. This setup enables containerized development and production deployment with persistent data storage and container-to-container networking.

---

## Files

| File | Location | Purpose |
|------|----------|---------|
| `docker-compose.yml` | Project root | Orchestrates all services |
| `nginx.conf` | Project root | Reverse proxy configuration |
| `Dockerfile` | `backend/amtemeterai.Api/` | Builds the API container image |
| `Dockerfile` | `frontend/` | Builds the Frontend container image |
| `.env` | Project root | Environment variables for Docker Compose |

---

## Docker Compose (`docker-compose.yml`)

### Services Overview

| Service | Container Name | Image | Internal Ports | External Ports | Purpose |
|---------|---------------|-------|---------------|---------------|---------|
| reverse-proxy | amtemeterai-reverse-proxy | nginx:alpine | 80 | 80 | Nginx reverse proxy |
| frontend | amtemeterai-frontend | amtemeterai-frontend:v5 | 5173 | - | React UI application |
| api | amtemeterai-api | amtemeterai-api:v5 | 8080 | - | ASP.NET Core Web API |
| postgres | amtemeterai-postgres | postgres:16 | 5432 | ${DB_PORT}:5432 | PostgreSQL database |
| minio | amtemeterai-minio | minio/minio:RELEASE.2024-02-17T01-15-57Z | 9000, 9001 | 9000:9000, 9001:9001 | Object storage |
| createbuckets | amtemeterai-minio-init | minio/mc:latest | - | - | MinIO initialization |
| signadapter | signadapter | registry.perurica.co.id/e-meterai/signadapter:2.0 | 7777 | 9999:7777 | Peruri e-Meterai signing |

---

### Service Details

#### 1. Reverse Proxy (Nginx)

```yaml
reverse-proxy:
  image: nginx:alpine
  container_name: amtemeterai-reverse-proxy
  restart: always
  ports:
    - "80:80"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf:ro
  depends_on:
    - frontend
    - api
```

**Configuration:**
| Setting | Value | Description |
|---------|-------|-------------|
| Image | `nginx:alpine` | Lightweight Nginx Alpine image |
| Container Name | `amtemeterai-reverse-proxy` | Identifies the container |
| Restart Policy | `always` | Auto-restart on failure |
| Port Mapping | `80:80` | HTTP access to application |
| Volume | `./nginx.conf:/etc/nginx/nginx.conf:ro` | Nginx configuration (read-only) |
| Dependencies | `frontend`, `api` | Waits for these services |

---

#### 2. Frontend Service

```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    args:
      - VITE_APP_TITLE=${VITE_APP_TITLE}
  image: amtemeterai-frontend:v5
  container_name: amtemeterai-frontend
  restart: always
```

**Configuration:**
| Setting | Value | Description |
|---------|-------|-------------|
| Build Context | `./frontend` | Path to Dockerfile |
| Image | `amtemeterai-frontend:v5` | Built image tag |
| Container Name | `amtemeterai-frontend` | Identifies the container |
| Restart Policy | `always` | Auto-restart on failure |
| Build Args | `VITE_APP_TITLE` | Pass app title from .env |

---

#### 3. API Service

```yaml
api:
  build:
    context: ./backend/amtemeterai.Api
    dockerfile: Dockerfile
  image: amtemeterai-api:v5
  container_name: amtemeterai-api
  restart: always
  environment:
    ASPNETCORE_ENVIRONMENT: Production
    ConnectionStrings__DefaultConnection: Host=postgres;Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD}
    Jwt__Key: ${JWT_SECRET}
    Jwt__Issuer: ${JWT_ISSUER}
    Jwt__Audience: ${JWT_AUDIENCE}
    App__PublicBaseUrl: ${PUBLIC_BASE_URL}
    App__ApiBaseUrl: ${API_BASE_URL}
    Peruri__KeyStamp: http://signadapter:7777
    Peruri__SharedFolder: /app/sharefolder
    App__MinioEndpoint: minio:9000
    AWS__ServiceURL: minio:9000
    Minio__Endpoint: minio:9000
  volumes:
    - stamping-share:/app/sharefolder
  depends_on:
    - postgres
```

**Configuration:**
| Setting | Value | Description |
|---------|-------|-------------|
| Build Context | `./backend/amtemeterai.Api` | Path to Dockerfile |
| Image | `amtemeterai-api:v5` | Built image tag |
| Container Name | `amtemeterai-api` | Identifies the container |
| Restart Policy | `always` | Auto-restart on failure |
| Volume Mount | `stamping-share:/app/sharefolder` | Shared volume for Peruri stamping |
| Dependencies | `postgres` | Waits for DB to start |

**Environment Variables:**
| Variable | Value | Description |
|----------|-------|-------------|
| `ASPNETCORE_ENVIRONMENT` | `Production` | ASP.NET Core environment |
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string | Database configuration |
| `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience` | JWT configuration | Authentication tokens |
| `App__PublicBaseUrl`, `App__ApiBaseUrl` | Base URLs | API endpoints |
| `Peruri__KeyStamp` | `http://signadapter:7777` | Peruri signing adapter endpoint |
| `Peruri__SharedFolder` | `/app/sharefolder` | Peruri shared volume mount path |
| `App__MinioEndpoint` | `minio:9000` | MinIO internal endpoint |
| `AWS__ServiceURL` | `minio:9000` | S3-compatible service URL |
| `Minio__Endpoint` | `minio:9000` | MinIO endpoint (fallback) |

---

#### 4. PostgreSQL Database

```yaml
postgres:
  image: postgres:16
  container_name: amtemeterai-postgres
  restart: always
  environment:
    POSTGRES_USER: ${DB_USER}
    POSTGRES_PASSWORD: ${DB_PASSWORD}
    POSTGRES_DB: ${DB_NAME}
  ports:
    - "${DB_PORT}:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

**Configuration:**
| Setting | Value | Description |
|---------|-------|-------------|
| Image | `postgres:16` | PostgreSQL 16 image |
| Container Name | `amtemeterai-postgres` | Identifies the container |
| Restart Policy | `always` | Auto-restart on failure |
| Port Mapping | `${DB_PORT}:5432` | Configurable host port → Container port 5432 |
| Volume | `postgres_data:/var/lib/postgresql/data` | Persistent data storage |

**Environment Variables (from .env):**
| Variable | Example Value | Description |
|----------|---------------|-------------|
| `DB_USER` | `postgres` | Database username |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_NAME` | `opexdb` | Database name |
| `DB_PORT` | `5432` | Host port mapping |

---

#### 5. MinIO Object Storage

```yaml
minio:
  image: minio/minio:RELEASE.2024-02-17T01-15-57Z
  container_name: amtemeterai-minio
  ports:
    - "9000:9000"
    - "9001:9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadminpassword}
  volumes:
    - minio_data:/data
  command: server /data --console-address ":9001"
```

**Configuration:**
| Setting | Value | Description |
|---------|-------|-------------|
| Image | `minio/minio:RELEASE.2024-02-17T01-15-57Z` | MinIO release version |
| Container Name | `amtemeterai-minio` | Identifies the container |
| Restart Policy | `always` | Auto-restart on failure |
| Port Mapping | `9000:9000` (API), `9001:9001` (Console) | API and Web Console |
| Volume | `minio_data:/data` | Persistent data storage |
| Command | `server /data --console-address ":9001"` | Start MinIO with console |

**Environment Variables:**
| Variable | Default Value | Description |
|----------|---------------|-------------|
| `MINIO_ROOT_USER` | `minioadmin` | Root user (from .env) |
| `MINIO_ROOT_PASSWORD` | `minioadminpassword` | Root password (from .env) |

---

#### 6. MinIO Bucket Initialization

```yaml
createbuckets:
  image: minio/mc:latest
  container_name: amtemeterai-minio-init
  depends_on:
    - minio
  entrypoint: >
    /bin/sh -c "
    until (/usr/bin/mc alias set myminio http://minio:9000 amtemeterai amtemeteraipassword); do echo 'Waiting for MinIO...'; sleep 1; done;
    /usr/bin/mc mb --ignore-existing myminio/amtemeterai-documents;
    /usr/bin/mc policy set download myminio/amtemeterai-documents;
    exit 0;
    "
```

**Configuration:**
| Setting | Value | Description |
|---------|-------|-------------|
| Image | `minio/mc:latest` | MinIO Client (mc) |
| Container Name | `amtemeterai-minio-init` | Identifies the container |
| Dependencies | `minio` | Waits for MinIO to start |
| Entry Point | Shell script to create buckets | Creates `amtemeterai-documents` bucket |

---

#### 7. Peruri Signing Adapter

```yaml
signadapter:
  image: registry.perurica.co.id/e-meterai/signadapter:2.0
  container_name: signadapter
  restart: always
  ports:
    - "9999:7777"
  environment:
    ENV: STAGING
    TZ: Asia/Jakarta
  volumes:
    - ./logs:/app/logs
    - stamping-share:/app/sharefolder
```

**Configuration:**
| Setting | Value | Description |
|---------|-------|-------------|
| Image | `registry.perurica.co.id/e-meterai/signadapter:2.0` | Peruri signing adapter |
| Container Name | `signadapter` | Identifies the container (used for DNS) |
| Restart Policy | `always` | Auto-restart on failure |
| Port Mapping | `9999:7777` | External debug access |
| Volume Mounts | `./logs:/app/logs`, `stamping-share:/app/sharefolder` | Logs and shared volume |

**Environment Variables:**
| Variable | Value | Description |
|----------|-------|-------------|
| `ENV` | `STAGING` | Peruri environment |
| `TZ` | `Asia/Jakarta` | Timezone setting |

---

### Named Volumes

```yaml
volumes:
  postgres_data:
  minio_data:
  stamping-share:
```

| Volume | Purpose | Mount Points |
|--------|---------|-------------|
| `postgres_data` | PostgreSQL data persistence | `postgres:/var/lib/postgresql/data` |
| `minio_data` | MinIO object storage persistence | `minio:/data` |
| `stamping-share` | PDF exchange for e-Meterai stamping | `api:/app/sharefolder`, `signadapter:/app/sharefolder` |

---

## Network Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Docker Network (amtemeterai_default)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐         ┌──────────────────┐                         │
│  │  reverse-proxy   │◄────────│   Host Machine   │◄────────[Port 80]     │
│  │   (nginx:alpine) │         └────────┬─────────┘                         │
│  │  Port: 80        │                 │                                    │
│  └────────┬─────────┘                 │                                    │
│           │                          │                                    │
│           ├──────────────────────────┼────────────────────┐                │
│           │                          │                 │                │
│           ▼                          ▼                 │                │
│  ┌──────────────────┐         ┌──────────────────┐   │                │
│  │   frontend       │         │      api         │   │                │
│  │  (React v5)      │◄────────│ (ASP.NET Core)   │   │                │
│  │  Port: 5173      │         │   Port: 8080      │   │                │
│  └──────────────────┘         └────────┬─────────┘   │                │
│                                        │             │                │
│           ┌────────────────────────────┼─────────────┴────┐           │
│           │                            │                  │           │
│           ▼                            ▼                  ▼           │
│  ┌─────────────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │    postgres     │    │    minio     │    │  signadapter │           │
│  │   (postgres:16) │    │  (minio mc)   │    │  (Peruri 2.0) │           │
│  │   Port: 5432     │    │ Ports: 9000   │    │   Port: 7777   │           │
│  │                 │    │       9001   │    │               │           │
│  └─────────────────┘    └──────────────┘    └──────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Internal DNS Resolution:**
- All containers communicate using container names as hostnames
- API → `postgres:5432`, `minio:9000`, `signadapter:7777`
- Frontend → `api:8080`
- Reverse proxy → `frontend`, `api`

**Named Volume File Exchange:**
- `stamping-share` mounted at `/app/sharefolder` in both `api` and `signadapter`
- API writes unsigned PDFs to `/app/sharefolder/UNSIGNED/`
- Signadapter reads and writes signed PDFs to `/app/sharefolder/SIGNED/`
- Both containers have read/write access with chmod 777 permissions

---

## Accessing Services

### From Host Machine

| Service | URL | Credentials |
|---------|-----|-------------|
| Web Application | `http://localhost` (via reverse proxy) | - |
| Swagger UI | `http://localhost/api/swagger` | - |
| MinIO Console | `http://localhost:9001` | From .env: MINIO_ROOT_USER, MINIO_ROOT_PASSWORD |
| PostgreSQL | `localhost:${DB_PORT}` | From .env: DB_USER, DB_PASSWORD, DB_NAME |
| Signadapter (debug) | `http://localhost:9999` | - |

### From Within Docker Network

| Service | Internal URL | Purpose |
|---------|--------------|---------|
| API | `http://api:8080` | Frontend → API |
| PostgreSQL | `postgres:5432` | API → Database |
| MinIO | `minio:9000` | API → Object Storage |
| Signadapter | `http://signadapter:7777` | API → Peruri Stamping |

---

## Usage

### Start All Services

```bash
# Start in detached mode
docker compose up -d

# Start with rebuild
docker compose up -d --build

# View logs
docker compose logs -f
```

### Stop All Services

```bash
# Stop containers (preserves volumes)
docker compose down

# Stop and remove volumes (WARNING: deletes data)
docker compose down -v
```

### Service Status

```bash
# List all running containers
docker compose ps

# Check service health
docker compose top
```

### Restart Specific Service

```bash
docker compose restart api
docker compose restart signadapter
```

### Rebuild Service

```bash
# Force rebuild and recreate
docker compose up -d --build api
```

---

## Environment Variables (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| **Database** |||
| `DB_USER` | PostgreSQL username | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `DB_NAME` | Database name | `opexdb` |
| `DB_PORT` | Host port for PostgreSQL | `5432` |
| **JWT** |||
| `JWT_SECRET` | JWT signing key | `<your-secret-key>` |
| `JWT_ISSUER` | JWT issuer | `amtemeterai-api` |
| `JWT_AUDIENCE` | JWT audience | `amtemeterai-web` |
| **Application** |||
| `PUBLIC_BASE_URL` | Public base URL | `http://localhost` |
| `API_BASE_URL` | API base URL | `http://localhost/api` |
| **MinIO** |||
| `MINIO_ROOT_USER` | MinIO root user | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | MinIO root password | `minioadminpassword` |
| **Frontend** |||
| `VITE_APP_TITLE` | Application title | `AmtemeterAI` |

---

## Data Persistence

### Persistent Volumes

| Volume | Location | Purpose |
|--------|----------|---------|
| `postgres_data` | `/var/lib/postgresql/data` | PostgreSQL database files |
| `minio_data` | `/data` | MinIO object storage |
| `stamping-share` | `/app/sharefolder` (containers) | PDF exchange for e-Meterai stamping |

### Backup Volumes

```bash
# Backup all volumes
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data
docker run --rm -v minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio_backup.tar.gz /data
```

### Restore Volumes

```bash
# Restore PostgreSQL
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_backup.tar.gz

# Restore MinIO
docker run --rm -v minio_data:/data -v $(pwd):/backup alpine tar xzf /backup/minio_backup.tar.gz
```

---

## Build Process

### API Dockerfile (Multi-Stage Build)

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore amtemeterai.Api.csproj
RUN dotnet publish amtemeterai.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet","amtemeterai.Api.dll"]
```

### Frontend Dockerfile

```dockerfile
# Build stage (if using multi-stage)
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
RUN npm add -g http-server
COPY --from=builder /app/dist /app
EXPOSE 5173
CMD ["http-server", "-p", "5173", "dist"]
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs <service-name>

# Check container status
docker compose ps

# Restart service
docker compose restart <service-name>
```

### Permission Issues with Shared Volume

If the signadapter container cannot read/write files in the shared volume:
1. Check that the API applies chmod 777 to shared directories
2. Verify both containers use the same volume mount point (`/app/sharefolder`)
3. Check logs: `docker compose logs api` and `docker compose logs signadapter`

### MinIO Connection Issues

```bash
# Check MinIO is accessible
docker exec -it amtemeterai-minio mc alias set myminio http://localhost:9000 <access-key> <secret-key>

# List buckets
docker exec -it amtemeterai-minio mc ls myminio
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
docker exec -it amtemeterai-postgres psql -U postgres -d opexdb

# Check database exists
docker exec -it amtemeterai-postgres psql -U postgres -l
```

---

## Security Notes

⚠️ **Production Deployment Considerations:**

1. **Change Default Credentials** - Update all default passwords in `.env` file
2. **Use Docker Secrets** - For sensitive data in swarm mode
3. **Restrict Port Mappings** - Only expose necessary ports
4. **Enable SSL/TLS** - Use HTTPS for reverse proxy
5. **Network Isolation** - Use custom networks for service isolation
6. **Volume Encryption** - Consider encrypting volumes at rest

---

## Dependencies

| Component | Version | Purpose |
|-----------|---------|---------|
| Docker | - | Containerization |
| Docker Compose | 3.9 | Orchestration |
| PostgreSQL | 16 | Database |
| Nginx | alpine | Reverse proxy |
| MinIO | RELEASE.2024-02-17T01-15-57Z | Object storage |
| .NET | 8.0 | API framework |
| Node.js | 20 | Frontend build |
| Peruri Signadapter | 2.0 | e-Meterai stamping |
