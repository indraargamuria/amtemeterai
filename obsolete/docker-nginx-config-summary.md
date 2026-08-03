# Docker & Nginx Configuration Summary

---

## Table of Contents
1. [Current Docker Compose](#current-docker-compose)
2. [Production Docker Compose](#production-docker-compose-copytoserver)
3. [Old Docker Compose](#old-docker-compose)
4. [Root Nginx Configuration](#root-nginx-configuration)
5. [Frontend Nginx Configuration](#frontend-nginx-configuration)
6. [Backend Dockerfile](#backend-dockerfile)
7. [Frontend Dockerfile](#frontend-dockerfile)
8. [Architecture Overview](#architecture-overview)
9. [Service Ports & Connections](#service-ports--connections)
10. [Environment Variables](#environment-variables)

---

## Current Docker Compose
**File:** `docker-compose.yml`

```yaml
version: "3.9"

services:

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

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    image: amtemeterai-frontend:v2
    container_name: amtemeterai-frontend
    restart: always

  api:
    build:
      context: ./backend/amtemeterai.Api
      dockerfile: Dockerfile
    image: amtemeterai-api:v2
    container_name: amtemeterai-api
    restart: always
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      # Injected from .env
      ConnectionStrings__DefaultConnection: Host=postgres;Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD}
      Jwt__Key: ${JWT_SECRET}
      Jwt__Issuer: ${JWT_ISSUER}
      Jwt__Audience: ${JWT_AUDIENCE}
      App__PublicBaseUrl: ${PUBLIC_BASE_URL}

    depends_on:
      - postgres

  postgres:
    image: postgres:16
    container_name: amtemeterai-postgres
    restart: always
    environment:
      # Injected from .env
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## Production Docker Compose (CopyToServer)
**File:** `docker-compose-CopyToServer.yml`

```yaml
version: "3.9"

services:
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

  frontend:
    # No 'build' section: Pulling pre-built black-box image
    image: indraargaaa/amtemeterai-frontend:v2
    container_name: amtemeterai-frontend
    restart: always

  api:
    # No 'build' section: Pulling pre-built black-box image
    image: indraargaaa/amtemeterai-api:v2
    container_name: amtemeterai-api
    restart: always
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      # Injected from .env
      ConnectionStrings__DefaultConnection: Host=postgres;Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD}
      Jwt__Key: ${JWT_SECRET}
      Jwt__Issuer: ${JWT_ISSUER}
      Jwt__Audience: ${JWT_AUDIENCE}
      App__PublicBaseUrl: ${PUBLIC_BASE_URL}
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    container_name: amtemeterai-postgres
    restart: always
    environment:
      # Injected from .env
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Key Differences from Current Config:**
- Uses pre-built Docker Hub images (`indraargaaa/amtemeterai-*:v2`)
- No `build` sections - images are pulled directly
- Intended for production deployment on target servers

---

## Old Docker Compose
**File:** `docker-compose-Old.yml`

```yaml
services:
  postgres:
    image: postgres:16
    container_name: amtemeterai_db
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: opexdb
    ports:
      - "5500:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build: ./backend/amtemeterai.Api
    container_name: amtemeterai_api
    restart: always
    depends_on:
      - postgres
    ports:
      - "8080:8080"
    environment:
      ConnectionStrings__DefaultConnection: Host=postgres;Port=5432;Database=opexdb;Username=postgres;Password=postgres

  frontend:
    build: ./frontend
    container_name: amtemeterai_frontend
    restart: always
    depends_on:
      - api
    ports:
      - "3000:5173"   # external 3000, internal 5173
    profiles: ["full"]

volumes:
  pgdata:
```

---

## Root Nginx Configuration
**File:** `nginx.conf`

```nginx
events {}

http {

    upstream frontend {
        server frontend:80;
    }

    upstream api {
        server api:8080;
    }

    server {

        listen 80;
        client_max_body_size 50M;

        location / {
            proxy_pass http://frontend;
            # Add these headers to ensure frontend receives correct info
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /api/ {
            proxy_pass http://api;
        }
    }
}
```

**Key Features:**
- **Reverse Proxy:** Routes traffic to appropriate services
- **Upstream Configuration:** Defines frontend and API servers
- **Proxy Headers:** Added for proper client information forwarding
- **Max Body Size:** Set to 50M for larger uploads
- **Routing Rules:**
  - `/` → Frontend (React SPA)
  - `/api/` → Backend API

---

## Frontend Nginx Configuration
**File:** `frontend/nginx.conf`

```nginx
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        # This line is the magic fix for SPA routing:
        try_files $uri $uri/ /index.html;
    }

    # Optional: Handle static assets cache
    location ~* \.(?:ico|css|js|gif|jpe?g|png)$ {
        root /usr/share/nginx/html;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

**Key Features:**
- **SPA Routing:** The `try_files` directive enables client-side routing
  - Falls back to `index.html` when requested file doesn't exist
  - Essential for React Router to work correctly
- **Static Assets Cache:** 30-day cache for images, CSS, JS files
- **Container Configuration:** Copied during Docker build to `/etc/nginx/conf.d/default.conf`

---

## Backend Dockerfile
**File:** `backend/amtemeterai.Api/Dockerfile`

```dockerfile
# =========================
# BUILD STAGE
# =========================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

COPY . .

RUN dotnet restore

RUN dotnet publish -c Release -o /app/publish

# =========================
# RUNTIME STAGE
# =========================
FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "amtemeterai.Api.dll"]
```

**Key Features:**
- **Multi-stage build:** Separates build and runtime images
- **SDK Image:** Uses .NET 8.0 SDK for building
- **Runtime Image:** Uses lightweight ASP.NET runtime
- **Optimized Size:** Only publishes application artifacts
- **Port 8080:** API listening port

---

## Frontend Dockerfile
**File:** `frontend/Dockerfile`

```dockerfile
# =========================
# BUILD STAGE
# =========================
FROM node:20 AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# =========================
# RUNTIME STAGE
# =========================
FROM nginx:alpine

# Copy build output
COPY --from=build /app/dist /usr/share/nginx/html

# COPY YOUR NEW NGINX CONFIG HERE:
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

**Key Features:**
- **Multi-stage build:** Node.js for build, Nginx Alpine for serving
- **Build Output:** Copy `/app/dist` to Nginx HTML directory
- **Custom Nginx Config:** Includes SPA routing configuration
- **Alpine Linux:** Minimal image size for production
- **Port 80:** Standard HTTP port

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Host (Port 80)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Nginx (Alpine)    │
              │  amtemeterai-       │
              │  reverse-proxy      │
              └─────────┬───────────┘
                        │
         ┌──────────────┴──────────────┐
         │                             │
         ▼                             ▼
┌─────────────────┐           ┌─────────────────┐
│   Frontend      │           │      API        │
│   (Nginx Alpine)│           │  (ASP.NET 8.0)  │
│   Port: 80      │           │   Port: 8080    │
│   Static files  │           │                 │
│   from /dist    │           │                 │
└─────────────────┘           └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │    PostgreSQL    │
                              │      16          │
                              │   Port: 5432     │
                              │   DB: opexdb     │
                              └─────────────────┘
```

---

## Service Ports & Connections

### External Access (Host → Container)

| Service        | Container Name           | External Port | Internal Port |
|----------------|--------------------------|---------------|---------------|
| Nginx          | amtemeterai-reverse-proxy| 80            | 80            |
| API (old)      | amtemeterai_api          | 8080          | 8080          |
| Frontend (old) | amtemeterai_frontend     | 3000          | 5173          |
| PostgreSQL (old)| amtemeterai_db          | 5500          | 5432          |

### Internal Docker Network (Container → Container)

| From Service | To Service | Protocol | Port |
|--------------|------------|----------|------|
| Nginx        | Frontend   | HTTP     | 80   |
| Nginx        | API        | HTTP     | 8080 |
| API          | PostgreSQL | TCP      | 5432 |

---

## Environment Variables

### API Service (`amtemeterai-api`)

| Variable                                    | Value                                      |
|---------------------------------------------|--------------------------------------------|
| `ASPNETCORE_ENVIRONMENT`                    | Production                                 |
| `ConnectionStrings__DefaultConnection`      | Host=postgres;Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD} |
| `Jwt__Key`                                  | ${JWT_SECRET}                               |
| `Jwt__Issuer`                               | ${JWT_ISSUER}                               |
| `Jwt__Audience`                             | ${JWT_AUDIENCE}                              |
| `App__PublicBaseUrl`                        | ${PUBLIC_BASE_URL}                            |

### PostgreSQL Service (`amtemeterai-postgres`)

| Variable          | Value     |
|-------------------|-----------|
| `POSTGRES_USER`   | ${DB_USER}|
| `POSTGRES_PASSWORD`| ${DB_PASSWORD}|
| `POSTGRES_DB`     | ${DB_NAME} |

### .env File Example

```env
# =========================================================
# OPEXIO CONFIGURATION
# =========================================================

# --- DATABASE CONFIGURATION ---
DB_NAME=opexdb
DB_USER=postgres
DB_PASSWORD=postgres
DB_PORT=5432

# --- BACKEND SECURITY ---
# Generate a unique, long random string for each customer
JWT_SECRET=af326aa84d2198e82c5a8dce01f26d96cb29539d3c92e8028f10b58aa3df7204
JWT_ISSUER=amtemeterai-api
JWT_AUDIENCE=amtemeterai-web

# --- NETWORK SETTINGS ---
# Set this to customer's actual domain or IP address
PUBLIC_BASE_URL=http://192.168.110.183
```

---

## Key Differences: Current vs Old Config

| Aspect                | Current (`docker-compose.yml`) | Old (`docker-compose-Old.yml`) |
|-----------------------|--------------------------------|--------------------------------|
| Reverse Proxy         | Yes (Nginx on port 80)         | No                             |
| Frontend Build        | Multi-stage (Node → Nginx)     | Single-stage (dev mode)       |
| Frontend Internal Port| 80 (Nginx serving static)      | 5173 (Vite dev server)        |
| Frontend External Port| None (only via reverse proxy)  | 3000                           |
| PostgreSQL External   | No (internal only)            | Yes (5500:5432)                |
| Frontend Profile      | None                           | Requires `--profile full`      |
| Environment Variables  | From `.env` file                | Hardcoded in compose file       |
| Image Version        | v2                             | No version tag                 |

---

## Key Differences: Current vs Production (CopyToServer)

| Aspect                | Current (`docker-compose.yml`) | Production (`docker-compose-CopyToServer.yml`) |
|-----------------------|--------------------------------|--------------------------------------------|
| Frontend Image       | Built locally from source        | Pulled from Docker Hub (`indraargaaa/amtemeterai-frontend:v2`) |
| API Image           | Built locally from source        | Pulled from Docker Hub (`indraargaaa/amtemeterai-api:v2`) |
| Build Sections       | Yes (includes `build` context) | No (pulling pre-built images)      |
| Use Case            | Local development and testing  | Production deployment on target server |
| Deployment Process   | Build + Run                   | Pull + Run                          |

---

## Routing Rules (Nginx)

| Request Path | Destination Service | Description |
|--------------|---------------------|-------------|
| `/`          | Frontend (port 80)  | React SPA application |
| `/api/*`     | API (port 8080)     | Backend API endpoints |
| `/api/swagger` | API (port 8080)     | Swagger documentation |

---

## Build Images

### Current Images (Built Locally)
- `amtemeterai-frontend:v2` - From `frontend/Dockerfile`
- `amtemeterai-api:v2` - From `backend/amtemeterai.Api/Dockerfile`

### Production Images (Docker Hub)
- `indraargaaa/amtemeterai-frontend:v2` - Pre-built frontend
- `indraargaaa/amtemeterai-api:v2` - Pre-built backend

### Base Images Used
- `nginx:alpine` - Reverse proxy & frontend runtime
- `mcr.microsoft.com/dotnet/sdk:8.0` - Backend build stage
- `mcr.microsoft.com/dotnet/aspnet:8.0` - Backend runtime
- `postgres:16` - Database
- `node:20` - Frontend build stage

---

## Docker Volumes

| Volume Name      | Usage                             |
|------------------|-----------------------------------|
| `postgres_data`  | PostgreSQL data persistence       |
| `pgdata` (old)   | Old PostgreSQL volume (deprecated) |

---

## Docker Commands Reference

### Build and Run (Current Config)
```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop services and remove volumes
docker-compose down -v
```

### Deploy to Server (Production)
```bash
# Copy files to server (including docker-compose-CopyToServer.yml and .env)
scp -r ./ user@192.168.110.183:/path/to/amtemeterai/

# On server: Rename and start
cd /path/to/amtemeterai
mv docker-compose-CopyToServer.yml docker-compose.yml
docker-compose pull
docker-compose up -d
```

### Access Individual Services
```bash
# View nginx logs
docker logs amtemeterai-reverse-proxy

# View api logs
docker logs amtemeterai-api

# View frontend logs
docker logs amtemeterai-frontend

# View postgres logs
docker logs amtemeterai-postgres

# Access container shell
docker exec -it amtemeterai-api sh
docker exec -it amtemeterai-reverse-proxy sh
```

---

## Common Debugging Commands

```bash
# Check all running containers
docker ps

# Check container networks
docker network inspect amtemeterai_default

# Test nginx configuration
docker exec amtemeterai-reverse-proxy nginx -t

# Test connectivity between containers
docker exec amtemeterai-api wget -O- http://postgres:5432
docker exec amtemeterai-reverse-proxy wget -O- http://frontend:80
docker exec amtemeterai-reverse-proxy wget -O- http://api:8080

# Check postgres connection
docker exec -it amtemeterai-postgres psql -U postgres -d opexdb
```

---

## Swagger Configuration

The API is configured to work behind Nginx reverse proxy:

- **Swagger JSON endpoint:** `/api/swagger/v1/swagger.json`
- **Swagger UI:** `/api/swagger`
- **Route template:** Configured to use `/api/swagger/{documentName}/swagger.json`

This configuration ensures proper routing through the reverse proxy.

---

## File Locations

| File                           | Path                                           |
|--------------------------------|------------------------------------------------|
| Current Docker Compose         | `./docker-compose.yml`                         |
| Production Docker Compose     | `./docker-compose-CopyToServer.yml`             |
| Old Docker Compose             | `./docker-compose-Old.yml`                     |
| Root Nginx Config           | `./nginx.conf`                                 |
| Frontend Nginx Config       | `./frontend/nginx.conf`                         |
| Backend Dockerfile            | `./backend/amtemeterai.Api/Dockerfile`        |
| Frontend Dockerfile           | `./frontend/Dockerfile`                        |
| Environment Variables          | `./.env`                                       |

---

## Deployment Workflow

### Local Development
1. Use `docker-compose.yml` (builds from source)
2. Configure `.env` with local settings
3. Run: `docker-compose up -d`

### Production Deployment
1. Build and push images to Docker Hub
2. Copy `docker-compose-CopyToServer.yml` to server
3. Configure `.env` with production values
4. Rename to `docker-compose.yml` on server
5. Run: `docker-compose pull && docker-compose up -d`

### Notes
- Production config uses pre-built images (no build time on server)
- Environment variables kept in `.env` file (not in git)
- Database data persisted in `postgres_data` volume
