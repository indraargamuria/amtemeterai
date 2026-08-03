# OpexNOW / e-meterai - Architecture Decision Records (ADRs)

## Overview

This document tracks significant architectural decisions made during the development of the OpexNOW / e-meterai Integration Layer for ERP systems (Epicor/SAP). Each decision is recorded with context, rationale, and consequences.

---

## Decision Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| ADR-001 | ASP.NET Core 8.0 with React 19 Unified Stack | Accepted | 2025-01-15 |
| ADR-002 | PostgreSQL as Primary Database | Accepted | 2025-01-15 |
| ADR-003 | JWT Bearer Authentication with Dynamic RBAC | Accepted | 2025-01-15 |
| ADR-004 | MinIO S3-Compatible Object Storage | Accepted | 2025-01-16 |
| ADR-005 | Peruri e-Meterai On-Premise Docker Integration | Accepted | 2025-01-18 |
| ADR-006 | Docker Compose Unified Stack Deployment | Accepted | 2025-01-19 |
| ADR-007 | Idempotent SAP Invoice Generation Endpoint | Accepted | 2025-01-19 |
| ADR-008 | Transaction-Agnostic Invoice Model | Accepted | 2025-01-19 |
| ADR-009 | Plant-Level Data Security Architecture | Accepted | 2025-01-17 |
| ADR-010 | Background Billing Sync Service | Accepted | 2025-01-20 |
| ADR-011 | Premium Industrial Utility UI Design System | Accepted | 2025-01-16 |
| ADR-012 | Session Polling for Security Monitoring | Accepted | 2025-01-17 |

---

## ADR-001: ASP.NET Core 8.0 with React 19 Unified Stack

### Status: ✅ Accepted

### Context

The system required a modern web stack that could:
- Support complex ERP integrations
- Provide real-time updates
- Scale for enterprise use
- Support containerized deployment

### Decision

Chose **ASP.NET Core 8.0** for the backend API and **React 19** for the frontend SPA, unified under a single Docker Compose stack.

### Rationale

**Backend (ASP.NET Core 8.0):**
- Mature ecosystem with extensive ERP integration libraries
- Built-in dependency injection and middleware pipeline
- Strong typing with C# reduces runtime errors
- Excellent performance and async/await support
- Native Docker support and cross-platform compatibility

**Frontend (React 19):**
- Latest React features including improved concurrent rendering
- Large ecosystem and component libraries
- Strong TypeScript support
- Vite build tool for fast development and optimized production builds
- Easy integration with shadcn/ui component library

**Unified Stack:**
- Simplified deployment with single Docker Compose file
- Shared network and volume management
- Unified environment configuration
- Streamlined CI/CD pipeline

### Consequences

**Positive:**
- Fast development with hot module replacement
- Type safety across frontend and backend
- Single deployment artifact
- Easy local development setup

**Negative:**
- Larger learning curve for full-stack developers
- Tight coupling between frontend and backend versions
- More complex single repository structure

**Alternatives Considered:**
- Separate repositories for frontend/backend (rejected: overhead)
- Vue.js for frontend (rejected: less TypeScript support)
- .NET MVC for frontend (rejected: outdated pattern)

---

## ADR-002: PostgreSQL as Primary Database

### Status: ✅ Accepted

### Context

The system required a relational database that could:
- Handle complex relationships (deliveries, invoices, customers)
- Support ACID transactions for financial data
- Scale horizontally for growth
- Integrate with Entity Framework Core

### Decision

Chose **PostgreSQL 16** as the primary database, deployed as a Docker container with persistent volume.

### Rationale

**PostgreSQL Advantages:**
- Open source with strong community support
- Advanced features (JSON, arrays, full-text search)
- Excellent data integrity and ACID compliance
- Native EF Core provider (Npgsql)
- Strong performance for read-heavy workloads
- Easy containerization and backup/restore

**Container Deployment:**
- Consistent environment across dev/staging/prod
- Easy volume management for persistence
- Simple scaling with replicas

### Consequences

**Positive:**
- Reliable data persistence with ACID guarantees
- Easy migrations with EF Core
- Good performance for complex queries
- Simple backup/restore with pg_dump

**Negative:**
- Additional infrastructure component
- Requires volume management for persistence
- Connection pooling configuration needed

**Alternatives Considered:**
- SQL Server (rejected: licensing cost, vendor lock-in)
- MySQL (rejected: less advanced features)
- MongoDB (rejected: not relational, no ACID)

---

## ADR-003: JWT Bearer Authentication with Dynamic RBAC

### Status: ✅ Accepted

### Context

The system required:
- Secure authentication for external access
- Fine-grained authorization for different roles
- Runtime permission modification without code changes
- Plant-level data isolation

### Decision

Implemented **JWT Bearer Authentication** with a **dynamic, database-driven RBAC system** using ASP.NET Core Identity.

### Rationale

**JWT Advantages:**
- Stateless authentication (no server session storage)
- Easy integration with frontend (localStorage)
- Embed claims (roles, permissions, plants) in token
- Security stamp for session revocation

**Dynamic RBAC:**
- Runtime permission modification via database
- No code deployment required for permission changes
- Granular permission keys (e.g., `delivery:read`)
- Role-based menu visibility
- Plant-level data filtering

**Security Stamp:**
- Immediate session invalidation on permission changes
- Automatic token refresh via `/api/account/me` polling

### Consequences

**Positive:**
- Flexible permission system
- No server-side session storage
- Easy integration with external systems
- Plant-level data security

**Negative:**
- Larger token size (all claims embedded)
- Token expiry management required
- Security stamp updates invalidate all user sessions

**Alternatives Considered:**
- Session-based authentication (rejected: server storage overhead)
- OAuth2/OIDC (rejected: overkill for internal system)
- Hardcoded permissions (rejected: inflexible)

---

## ADR-004: MinIO S3-Compatible Object Storage

### Status: ✅ Accepted

### Context

The system required storage for:
- Delivery photos (up to 5 per delivery, 5MB each)
- Delivery printouts (PDF)
- Invoice printouts (PDF)
- Stamped invoices (PDF)
- e-Meterai QR codes (PNG)

### Decision

Chose **MinIO** as S3-compatible object storage, deployed as a Docker container with persistent volume.

### Rationale

**MinIO Advantages:**
- S3-compatible API (AWSSDK.S3 client)
- Self-hosted (no AWS dependency)
- High performance for large files
- Easy containerization
- Presigned URL support for time-limited access

**Storage Key Strategy:**
- Descriptive prefixes (e.g., `deliveries/{deliveryNumber}/printouts/DO_{deliveryNumber}_{guid}.pdf`)
- GUID-based uniqueness prevents collisions
- Easy to identify file type and ownership

### Consequences

**Positive:**
- No external cloud dependency
- Fast local access
- Easy backup/restore
- S3-compatible (portable)

**Negative:**
- Additional infrastructure component
- Requires volume management
- Manual bucket initialization

**Alternatives Considered:**
- AWS S3 (rejected: external dependency, cost)
- Azure Blob Storage (rejected: vendor lock-in)
- File system storage (rejected: no S3 API, scaling issues)
- Database blob storage (rejected: database bloat)

---

## ADR-005: Peruri e-Meterai On-Premise Docker Integration

### Status: ✅ Accepted

### Context

Indonesian tax regulations require e-Meterai digital stamps on invoices:
- Peruri provides cloud and on-premise options
- On-premise required for data sovereignty
- Docker adapter needed for PDF signing
- Shared volume for file exchange

### Decision

Implemented **on-premise Peruri Docker adapter** with:
- JWT session management (cached token)
- Stamp v2 API integration
- Docker named volume for file exchange (`/app/sharefolder`)
- Container-to-container communication (`http://signadapter:7777`)

### Rationale

**On-Premise Advantages:**
- Data sovereignty (stays in our infrastructure)
- No external API dependency for stamping
- Faster processing (local network)
- Cost control (no per-stamp fees)

**Docker Adapter:**
- Official Peruri Docker image (`registry.perurica.co.id/e-meterai/signadapter:2.0`)
- Shared volume for PDF exchange
- Environment-aware routing (Docker vs local)
- Platform-agnostic path handling

**Flow Architecture:**
1. Write unsigned PDF to `/app/sharefolder/UNSIGNED/`
2. Get serial number + QR from Peruri Stamp v2 API
3. Write QR code to `/app/sharefolder/STAMP/`
4. Call Docker adapter for signing
5. Read signed PDF from `/app/sharefolder/SIGNED/`

### Consequences

**Positive:**
- Full control over stamping process
- Fast local processing
- No external dependency after setup
- Compliant with data sovereignty

**Negative:**
- Complex setup (Docker volumes, permissions)
- Additional infrastructure component
- Manual Docker adapter updates
- Linux permission issues (chmod 777 required)

**Alternatives Considered:**
- Peruri Cloud API (rejected: external dependency, latency)
- Manual stamping (rejected: non-compliant)
- No stamping (rejected: illegal in Indonesia)

---

## ADR-006: Docker Compose Unified Stack Deployment

### Status: ✅ Accepted

### Context

The system required:
- Consistent deployment across environments
- Easy local development setup
- Simplified production deployment
- Container orchestration for multiple services

### Decision

Adopted **Docker Compose unified stack** with all services in a single `docker-compose.yml` file.

### Rationale

**Docker Compose Advantages:**
- Single command deployment (`docker-compose up -d`)
- Consistent environments (dev/staging/prod)
- Service dependencies management (`depends_on`)
- Shared networks and volumes
- Easy environment variable injection

**Unified Stack Services:**
- Frontend (React 19)
- Backend API (ASP.NET Core 8.0)
- PostgreSQL 16
- MinIO (S3 storage)
- SignAdapter (Peruri e-Meterai)
- Nginx (reverse proxy)
- createbuckets (MinIO initialization)

**Internal Networking:**
- Container-to-container communication via DNS
- Shared named volumes for file exchange
- Environment-aware configuration

### Consequences

**Positive:**
- One-command deployment
- Consistent across environments
- Easy to add/remove services
- Simplified debugging

**Negative:**
- Single point of failure (all containers in one stack)
- Resource contention on single host
- More complex docker-compose.yml file
- Harder to scale individual services

**Alternatives Considered:**
- Kubernetes (rejected: overkill for current scale)
- Separate deployments (rejected: complexity overhead)
- Manual deployment (rejected: inconsistent environments)

---

## ADR-007: Idempotent SAP Invoice Generation Endpoint

### Status: ✅ Accepted

### Context

The SAP invoice generation process needed:
- Reliability (no duplicate invoices)
- Re-sync capability (recover from failures)
- Idempotency (safe to call multiple times)
- Transaction integrity

### Decision

Implemented **idempotent SAP invoice generation** with local database check before SAP API call.

### Rationale

**Idempotency Pattern:**
1. Check local `Invoices` table for existing invoice by `DeliveryHeaderId`
2. If exists → Return existing invoice data (re-sync)
3. If not exists → Call SAP billing API → Create invoice record

**Benefits:**
- Safe to call multiple times (no duplicates)
- Re-sync support without SAP API call
- Transaction integrity (all-or-nothing)
- Graceful failure handling

**Implementation:**
```csharp
// Idempotency Check
var existingInvoice = await _context.Invoice
    .FirstOrDefaultAsync(i => i.DeliveryHeaderId == deliveryId);

if (existingInvoice != null)
{
    return existingInvoice; // Re-sync
}

// Proceed with SAP API call
```

### Consequences

**Positive:**
- No duplicate invoices
- Re-sync capability
- Safe for retries
- Better UX (can re-click button)

**Negative:**
- Additional database query
- Slightly slower response on re-sync
- Need to handle invoice edge cases

**Alternatives Considered:**
- Non-idempotent endpoint (rejected: duplicate risk)
- Client-side deduplication (rejected: unreliable)
- SAP-side deduplication (rejected: not available)

---

## ADR-008: Transaction-Agnostic Invoice Model

### Status: ✅ Accepted

### Context

The business required:
- Standalone invoices (without delivery reference)
- Delivery-linked invoices (traditional flow)
- Unified document management
- Flexibility for billing scenarios

### Decision

Implemented **transaction-agnostic invoice model** with optional `DeliveryHeaderId` foreign key.

### Rationale

**Flexible Invoice Model:**
- `DeliveryHeaderId` is nullable (optional link)
- Supports standalone invoices (direct billing)
- Supports linked invoices (delivery-based)
- Unified Document Hub view

**Business Benefits:**
- Direct invoice creation for misc. charges
- Credit notes and adjustments
- Inter-company billing
- Manual invoice creation

**Data Model:**
```csharp
public class Invoice
{
    public int InvoiceID { get; set; }
    public int? DeliveryHeaderId { get; set; }  // Nullable
    public DeliveryHeader Delivery { get; set; }  // Optional navigation
}
```

### Consequences

**Positive:**
- Business flexibility
- Unified document management
- Supports multiple billing scenarios
- Easy to model special cases

**Negative:**
- More complex queries (JOIN optional)
- Need to handle null cases
- Validation complexity (some invoices need delivery)

**Alternatives Considered:**
- Separate tables (rejected: data duplication)
- Required delivery link (rejected: inflexible)
- Document polymorphism (rejected: overcomplicated)

---

## ADR-009: Plant-Level Data Security Architecture

### Status: ✅ Accepted

### Context

The multi-plant organization required:
- Data isolation by plant/location
- Role-based visibility (warehouse vs finance)
- Sysadmin bypass (full access)
- Flexible user-plant assignments

### Decision

Implemented **plant-level data security** with:
- User-Plant many-to-many relationship
- Plant claims in JWT token
- Query filtering by assigned plants
- Sysadmin bypass logic

### Rationale

**Data Isolation Strategy:**
- Users assigned to specific plants via `UserPlant` table
- Plant codes embedded in JWT claims on login
- Non-sysadmin users see only assigned plant data
- Warehouse role: additional customer data hiding

**Implementation:**
```csharp
// Plant filtering in queries
if (!User.IsSysAdmin())
{
    var userPlants = User.GetPlantClaims();
    query = query.Where(d => userPlants.Contains(d.Plant));
}
```

**Warehouse Role Data Hiding:**
- `customerCode` and `customerName` returned as empty strings
- `orderNumber` and `buyerPONumber` hidden
- Prevents warehouse staff from accessing financial data

### Consequences

**Positive:**
- Strong data isolation
- Flexible plant assignments
- Role-based data visibility
- Sysadmin full access

**Negative:**
- Additional join/filter in queries
- JWT token size increase
- Need to handle null plant assignments
- Complex authorization logic

**Alternatives Considered:**
- Row-level security in database (rejected: database-specific)
- Separate databases per plant (rejected: management overhead)
- Application-level filtering only (accepted: implemented)

---

## ADR-010: Background Billing Sync Service

### Status: ✅ Accepted

### Context

The billing process required:
- Automatic invoice creation after delivery
- Configurable delay period
- Periodic processing
- Error recovery

### Decision

Implemented **background billing sync service** using `BackgroundService` with configurable delay and interval.

### Rationale

**Background Service Pattern:**
- Runs every `CheckIntervalMinutes` (default: 5)
- Creates invoices for deliveries older than `DelayMinutes` (default: 30)
- Transaction-based invoice creation
- Activity logging for success/failure

**Benefits:**
- Automatic processing (no manual intervention)
- Delay period allows corrections
- Periodic checks (eventual consistency)
- Graceful error handling

**Implementation:**
```csharp
public class BillingBackgroundService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await ProcessEligibleDeliveries();
            await Task.Delay(TimeSpan.FromMinutes(_options.CheckIntervalMinutes));
        }
    }
}
```

### Consequences

**Positive:**
- Automatic billing
- Configurable timing
- Error recovery
- Activity audit trail

**Negative:**
- Background processing complexity
- Need to monitor service health
- Delay between delivery and invoice
- Potential duplicate invoices if not idempotent

**Alternatives Considered:**
- Manual invoice creation (rejected: labor-intensive)
- Immediate invoice creation (rejected: no correction window)
- Message queue (rejected: overkill for current scale)
- Cron job (rejected: not cross-platform)

---

## ADR-011: Premium Industrial Utility UI Design System

### Status: ✅ Accepted

### Context

The application required:
- Professional, enterprise-grade appearance
- High information density
- Clear visual hierarchy
- Brand consistency

### Decision

Implemented **Premium Industrial Utility** design system with:
- Brand-blue (#1d2351) as primary color
- Accent red (#e61920) for highlights only
- Opacity-based soft color system (blue/5, blue/10, blue/20)
- Monospace typography for IDs and numbers
- Compact, high-density layouts

### Rationale

**Design Philosophy:**
- "Clean, Structured, Professional, Not Generic"
- Visual hierarchy through size, spacing, weight
- Calm but intentional color usage
- High information density (financial terminal style)

**Color Strategy:**
- Dominant brand-blue for primary actions
- Emerald for success states (Stamped, Approved)
- Amber for warning states (Pending)
- Slate for neutral states (Draft, Disabled)
- Rose for error states (Rejected, Failed)

**Typography Scale:**
- Page titles: 2xl, semibold, brand-blue
- Section headers: sm, uppercase, tracking-wider
- Body text: sm, brand-blue/60-70
- Monospace for invoice numbers, serial numbers, dates

### Consequences

**Positive:**
- Professional appearance
- Clear information hierarchy
- Brand consistency
- High data density
- Good readability

**Negative:**
- Learning curve for developers
- More custom CSS/Tailwind config
- Need for design system documentation
- Risk of inconsistency if not followed

**Alternatives Considered:**
- Default Bootstrap/Tailwind (rejected: generic appearance)
- Material Design (rejected: too playful)
- Ant Design (rejected: too opinionated)
- Custom CSS framework (rejected: maintenance overhead)

---

## ADR-012: Session Polling for Security Monitoring

### Status: ✅ Accepted

### Context

The system required:
- Session validation without WebSocket complexity
- Security stamp change detection
- Token refresh mechanism
- Automatic logout on session revocation

### Decision

Implemented **session polling** with 60-second interval to `/api/account/me` endpoint.

### Rationale

**Polling Strategy:**
- Frontend polls `/api/account/me` every 60 seconds
- Server validates JWT and returns new token with updated claims
- Security stamp changes invalidate existing tokens
- Automatic logout on 401 response

**Benefits:**
- Simple implementation (no WebSocket)
- Automatic session validation
- Security stamp detection
- Token refresh mechanism

**Implementation:**
```typescript
const POLLING_INTERVAL = 60000; // 60 seconds

useEffect(() => {
  const interval = setInterval(async () => {
    const response = await fetch('/api/account/me');
    if (response.status === 401) {
      logout();
    } else {
      const data = await response.json();
      localStorage.setItem('auth_token', data.token);
    }
  }, POLLING_INTERVAL);

  return () => clearInterval(interval);
}, []);
```

### Consequences

**Positive:**
- Simple implementation
- No WebSocket complexity
- Automatic session validation
- Token refresh built-in

**Negative:**
- 60-second delay for invalidation
- Additional API load
- Battery impact on mobile
- Network dependency

**Alternatives Considered:**
- WebSocket (rejected: overkill, complexity)
- Short-lived tokens (rejected: poor UX)
- No session validation (rejected: security risk)
- Server-Sent Events (rejected: one-way only)

---

## Future Decisions

### Pending Architecture Decisions

| ID | Title | Status | Priority |
|----|-------|--------|----------|
| ADR-013 | Caching Strategy (Redis vs In-Memory) | 🔄 To Decide | P2 |
| ADR-014 | Message Queue (RabbitMQ vs Azure Service Bus) | 🔄 To Decide | P3 |
| ADR-015 | Real-time Notifications (WebSocket vs SSE) | 🔄 To Decide | P2 |
| ADR-016 | Multi-tenancy Strategy | 🔄 To Decide | P3 |
| ADR-017 | API Versioning Approach | 🔄 To Decide | P2 |

---

## Decision Template

For future decisions, use this template:

```markdown
## ADR-XXX: [Decision Title]

### Status: 🔄 [Proposed | Accepted | Deprecated | Superseded]

### Context
[What is the issue that we're facing?]

### Decision
[What did we decide?]

### Rationale
[Why did we make this decision?]

### Consequences
[What are the results of this decision?]

**Positive:**
-

**Negative:**
-

**Alternatives Considered:**
- [Alternative 1] (rejected: [reason])
- [Alternative 2] (rejected: [reason])
- [Alternative 3] (accepted: implemented)
```

---

*This ADR document is maintained as part of the OpexNOW / e-meterai project documentation. All architectural decisions should be recorded here for future reference.*
