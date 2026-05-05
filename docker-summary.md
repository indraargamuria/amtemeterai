x# AmtemeterAI Docker Configuration Documentation

## Overview

The Docker setup consists of a PostgreSQL database and an ASP.NET Core API, orchestrated using Docker Compose. The configuration enables containerized development and production deployment with persistent data storage.

---

## Files

| File | Location | Purpose |
|------|----------|---------|
| `docker-compose.yml` | Project root | Orchestrates all services |
| `package.json` | Project root | Concurrent development scripts |
| `Dockerfile` | `backend/amtemeterai.Api/` | Builds the API container image |
| `Dockerfile` | `frontend/` | Builds the Frontend container image |
| `appsettings.json` | `backend/amtemeterai.Api/` | Application configuration |
| `appsettings.Development.json` | `backend/amtemeterai.Api/` | Development overrides |

---

## Docker Compose (`docker-compose.yml`)

### Services

#### 1. PostgreSQL Database

```yaml
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
```

**Configuration:**
| Setting | Value | Description |
|---------|-------|-------------|
| Image | `postgres:16` | PostgreSQL 16 image |
| Container Name | `amtemeterai_db` | Identifies the container |
| Restart Policy | `always` | Auto-restart on failure |
| Port Mapping | `5500:5432` | Host port 5500 → Container port 5432 |
| Database Name | `opexdb` | Default database |
| User | `postgres` | Database user |
| Password | `postgres` | Database password |

**Volume:**
- `pgdata`: Persists PostgreSQL data across container restarts

---

#### 2. API Service

```yaml
api:
  build: backend\amtemeterai.Api
  container_name: amtemeterai_api
  restart: always
  depends_on:
    - postgres
  ports:
    - "8080:8080"
  environment:
    ConnectionStrings__DefaultConnection: Host=postgres;Port=5432;Database=opexdb;Username=postgres;Password=postgres
```

**Configuration:**
| Setting | Value | Description |
|---------|-------|-------------|
| Build Context | `backend\amtemeterai.Api` | Path to Dockerfile |
| Container Name | `amtemeterai_api` | Identifies the container |
| Restart Policy | `always` | Auto-restart on failure |
| Port Mapping | `8080:8080` | Host port 8080 → Container port 8080 |
| Dependency | `postgres` | Waits for DB to start |

**Environment Variables:**
- `ConnectionStrings__DefaultConnection`: Database connection string pointing to the PostgreSQL container

---

#### 3. Frontend Service

```yaml
frontend:
  build: ./frontend
  container_name: amtemeterai_frontend
  restart: always
  depends_on:
    - api
  ports:
    - "3000:5173"
  profiles: ["full"]
```

**Configuration:**
| Setting | Value | Description |
|---------|-------|-------------|
| Build Context | `./frontend` | Path to Dockerfile |
| Container Name | `amtemeterai_frontend` | Identifies the container |
| Restart Policy | `always` | Auto-restart on failure |
| Port Mapping | `3000:5173` | Host port 3000 → Container port 5173 |
| Dependency | `api` | Waits for API to start |
| Profile | `full` | Optional profile for frontend |

**Environment Configuration:**
- Uses `.env.docker` for `VITE_API_URL=http://api:8080`
- API URL uses internal Docker network hostname `api`

---

### Volumes

```yaml
volumes:
  pgdata:
```

**Volume:**
- `pgdata`: Named volume for PostgreSQL data persistence

---

## Dockerfile (`backend/amtemeterai.Api/Dockerfile`)

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

### Build Stages

#### Stage 1: Build
| Instruction | Purpose |
|-------------|---------|
| `FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build` | Use .NET SDK 8.0 image |
| `WORKDIR /src` | Set working directory |
| `COPY . .` | Copy all source files |
| `dotnet restore` | Restore NuGet packages |
| `dotnet publish -c Release -o /app/publish` | Build and publish release output |

#### Stage 2: Runtime
| Instruction | Purpose |
|-------------|---------|
| `FROM mcr.microsoft.com/dotnet/aspnet:8.0` | Use .NET ASP.NET Runtime 8.0 image |
| `WORKDIR /app` | Set working directory |
| `COPY --from=build /app/publish .` | Copy published files |
| `EXPOSE 8080` | Expose port 8080 |
| `ENTRYPOINT ["dotnet","amtemeterai.Api.dll"]` | Set application entry point |

---

## Dockerfile (`frontend/Dockerfile`)

```dockerfile
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
```

### Build Instructions

| Instruction | Purpose |
|-------------|---------|
| `FROM node:20` | Use Node.js 20 image |
| `WORKDIR /app` | Set working directory |
| `COPY package*.json ./` | Copy package files |
| `RUN npm install` | Install dependencies |
| `COPY . .` | Copy all source files |
| `EXPOSE 5173` | Expose port 5173 (Vite dev server) |
| `CMD ["npm", "run", "dev", "--", "--host"]` | Start dev server with host flag for Docker |

---

## Application Configuration

### appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "DefaultConnection":
      "Host=localhost;Port=5500;Database=opexdb;Username=postgres;Password=postgres"
  }
}
```

**Settings:**
| Section | Key | Value | Description |
|---------|-----|-------|-------------|
| Logging | Default | Information | Default log level |
| Logging | Microsoft.AspNetCore | Warning | ASP.NET Core log level |
| AllowedHosts | - | * | Allow all hosts |
| ConnectionStrings | DefaultConnection | Host=localhost;Port=5500;Database=opexdb;Username=postgres;Password=postgres | Local development connection string |

---

### appsettings.Development.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}
```

**Note:** Development environment uses connection string from `appsettings.json` for local development.

---

## Network Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Host Machine                               │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Port 5500   │  │  Port 8080   │  │  Port 3000   │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                 │                        │
│  ┌──────▼────────┐  ┌──────▼────────┐  ┌───▼────────────┐          │
│  │ amtemeterai_db │  │ amtemeterai_api │  │ amtemeterai_   │          │
│  │   PostgreSQL   │◄─│ ASP.NET Core   │◄─│   frontend     │          │
│  │   Port 5432    │  │   Port 8080    │  │   Port 5173    │          │
│  └───────────────┘  └─────────────────┘  └────────────────┘          │
│         │                                  │                         │
│         └──────────────────────────────────┘                         │
│              Docker Network (bridge)                                 │
└──────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
          ┌───────────────┐
          │  pgdata Volume│
          │  (Persistent)  │
          └───────────────┘
```

**Data Flow:**
- Frontend (`localhost:3000`) → API (`api:8080`) → Database (`postgres:5432`)
- Frontend uses `VITE_API_URL=http://api:8080` for internal Docker network communication

---

## Usage

### Start All Services

```bash
# Start database and API only
docker-compose up

# Start all services including frontend
docker-compose --profile full up
```

### Start in Detached Mode

```bash
docker-compose up -d
```

### Stop All Services

```bash
docker-compose down
```

### Stop and Remove Volumes

```bash
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs postgres
docker-compose logs api
```

### Rebuild API Service

```bash
docker-compose up --build api
```

### Execute Commands in Container

```bash
# PostgreSQL
docker exec -it amtemeterai_db psql -U postgres -d opexdb

# API
docker exec -it amtemeterai_api sh
```

---

## Accessing Services

### PostgreSQL Database
- **Host:** `localhost`
- **Port:** `5500`
- **Database:** `opexdb`
- **Username:** `postgres`
- **Password:** `postgres`

### API
- **Base URL:** `http://localhost:8080`
- **Swagger UI:** `http://localhost:8080/swagger`

### Frontend
- **URL:** `http://localhost:3000`
- **Environment:** Uses `.env.docker` with `VITE_API_URL=http://api:8080`

---

## Environment Variables

### PostgreSQL
| Variable | Value | Description |
|----------|-------|-------------|
| `POSTGRES_USER` | `postgres` | Database username |
| `POSTGRES_PASSWORD` | `postgres` | Database password |
| `POSTGRES_DB` | `opexdb` | Default database name |

### API
| Variable | Value | Description |
|----------|-------|-------------|
| `ConnectionStrings__DefaultConnection` | `Host=postgres;Port=5432;Database=opexdb;Username=postgres;Password=postgres` | Internal container connection string |

---

## Startup Order

1. **PostgreSQL** starts first
2. **API** waits for PostgreSQL to be ready (`depends_on: postgres`)
3. **API** applies database migrations on startup (`db.Database.Migrate()`)
4. **Frontend** waits for API to be ready (`depends_on: api`)
5. Services become available:
   - API at `http://localhost:8080`
   - Frontend at `http://localhost:3000` (with `--profile full`)

---

## Data Persistence

The PostgreSQL data is persisted using a Docker named volume:
- **Volume Name:** `pgdata`
- **Mount Point:** `/var/lib/postgresql/data` (inside container)
- **Benefit:** Data survives container restarts and recreation

---

## Port Mappings

| Service | Host Port | Container Port | Purpose |
|---------|-----------|----------------|---------|
| PostgreSQL | 5500 | 5432 | Database access |
| API | 8080 | 8080 | API endpoint access |
| Frontend | 3000 | 5173 | Frontend web interface |

---

## Build Process

### Multi-Stage Build
1. **Build Stage:** Uses .NET SDK to restore packages and publish the application
2. **Runtime Stage:** Uses lightweight ASP.NET runtime image with only published files

**Benefits:**
- Smaller final image size
- No SDK in production image
- Faster deployment

---

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL container is running: `docker ps`
- Check PostgreSQL logs: `docker-compose logs postgres`
- Verify port 5500 is not in use by another application

### API Cannot Connect to Database
- Verify both containers are on the same Docker network
- Check that the connection string uses `postgres` as hostname (not `localhost`)
- Ensure PostgreSQL container is fully started before API attempts connection

### View Container Status
```bash
docker-compose ps
```

### Restart a Specific Service
```bash
docker-compose restart api
docker-compose restart postgres
```

### Reset Database (Delete All Data)
```bash
docker-compose down -v
docker-compose up
```

---

## Security Notes

⚠️ **Current Configuration Uses Default Credentials**

For production deployment:
- Change default PostgreSQL username and password
- Use Docker secrets or environment variable files for sensitive data
- Restrict port mappings if not exposing externally
- Enable SSL for database connections
- Configure proper firewall rules

---

## Development vs Production

### Development
- Connection string uses `localhost:5500` in `appsettings.json`
- Detailed logging enabled
- Swagger UI available

### Production (Docker Compose)
- Connection string uses internal container hostname `postgres`
- Consider reducing log verbosity
- May want to disable Swagger in production

---

## Dependencies

| Component | Version |
|-----------|---------|
| Docker | - |
| Docker Compose | - |
| PostgreSQL Image | 16 |
| Node.js Image | 20 |
| .NET SDK Image | 8.0 |
| .NET Runtime Image | 8.0 |
| ASP.NET Core | 8.0 |
| Entity Framework Core | 8.0.0 |
| Npgsql (PostgreSQL Provider) | 8.0.0 |
| React | 19.2.5 |
| Vite | 8.0.10 |

---

## Concurrent Development Scripts

The root `package.json` provides scripts for running both backend and frontend concurrently during development:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "dotnet run --project backend/amtemeterai.Api",
    "dev:frontend": "npm run dev --prefix frontend"
  }
}
```

**Usage:**
```bash
# From project root - runs both backend and frontend
npm run dev

# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

---

## Project Context

This Docker configuration supports the AmtemeterAI e-Meterai delivery management system, providing:
- Persistent PostgreSQL database for customer and delivery data
- RESTful API with Swagger documentation
- React frontend with modern UI
- Automatic database migrations on startup
- Easy local development (with concurrent scripts) and production deployment
- Environment-based API URL configuration for seamless dev/Docker switching
