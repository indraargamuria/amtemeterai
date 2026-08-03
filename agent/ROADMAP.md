# OpexNOW / e-meterai - Development Roadmap

## Overview

This roadmap tracks the development progress of the OpexNOW / e-meterai Integration Layer for ERP systems (Epicor/SAP). Items are organized by status: **To Do**, **In Progress**, and **Done**.

---

## Legend

| Status | Description |
|--------|-------------|
| 🔄 **To Do** | Planned but not started |
| 🔵 **In Progress** | Currently under development |
| ✅ **Done** | Completed and deployed |

---

## Core Platform Features

### Authentication & Authorization

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| JWT Bearer Authentication | ✅ Done | P0 | 7-day token expiry, security stamp |
| Dynamic RBAC System | ✅ Done | P0 | Runtime permission modification |
| Plant-Level Data Security | ✅ Done | P1 | Data filtering by plant assignment |
| Role-Based Menu Visibility | ✅ Done | P1 | UI adapts to user permissions |
| Session Monitoring | ✅ Done | P1 | 60-second polling /api/account/me |
| Password Policy | ✅ Done | P2 | Minimum 6 characters |
| Multi-Factor Authentication | 🔄 To Do | P2 | Future enhancement |

### Delivery Management

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Delivery Creation | ✅ Done | P0 | QR code + public link |
| Delivery Confirmation (Public) | ✅ Done | P0 | PIN verification |
| Photo Evidence Upload | ✅ Done | P0 | Up to 5 photos, 5MB each |
| GPS Location Tracking | ✅ Done | P1 | Reverse geocoding |
| Delivery Cancellation | ✅ Done | P1 | Reason tracking |
| Delivery Printout Upload | ✅ Done | P1 | PDF/image support |
| Line Item Variance Calculation | ✅ Done | P0 | Auto-calculated percentages |
| Batch Number Tracking | ✅ Done | P2 | Split batch support |
| Delivery Search & Filter | ✅ Done | P1 | Compliance type, status, discrepancy |
| SAP Invoice Generation (Idempotent) | ✅ Done | P0 | Re-sync support |

### Invoice Management

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Invoice Creation | ✅ Done | P0 | Manual + automatic (billing sync) |
| Invoice Printout Upload | ✅ Done | P0 | SAP-native (invoiceNumber) |
| Peruri e-Meterai Stamping (Cloud) | ✅ Done | P0 | PDS API integration |
| Peruri e-Meterai Stamping (On-Premise) | ✅ Done | P0 | Docker adapter + shared volume |
| Invoice Void/Cancellation | ✅ Done | P1 | Via SAP number |
| Stamped Document Download | ✅ Done | P0 | Direct download links |
| Invoice Search & Filter | ✅ Done | P1 | Status, stamping status |
| Transaction-Agnostic Document Hub | ✅ Done | P1 | Linked + standalone invoices |

### Customer Management

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Customer Directory | ✅ Done | P0 | List with search/sort |
| Customer Sync from ERP | ✅ Done | P0 | Dummy & ERP sources |
| Customer Upsert | ✅ Done | P1 | Create/update via API |
| Customer PIN Verification | ✅ Done | P1 | For public delivery access |
| Customer Email Dispatch | ✅ Done | P1 | PIN + confirmation emails |

### User Access Management (UAM)

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| User Listing | ✅ Done | P0 | All users with last login |
| User Plant Assignment | ✅ Done | P0 | Checkbox grid interface |
| User Role Assignment | ✅ Done | P0 | Multiple roles per user |
| Role Menu Matrix | ✅ Done | P0 | Permission configuration |
| Impact Indicators | ✅ Done | P1 | Shows affected users |
| Security Stamp Updates | ✅ Done | P0 | Invalidates existing tokens |

### Dashboard & Analytics

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| KPI Metric Cards | ✅ Done | P0 | Total, pending, rejection rate |
| Delivery Trends Chart | ✅ Done | P1 | 30-day visualization |
| Activity Feed | ✅ Done | P1 | Recent system events |
| ERP Connectivity Status | ✅ Done | P2 | Visual indicator |

---

## Integration Features

### SAP ERP Integration

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Delivery Confirmation Sync | ✅ Done | P0 | POST to SAP endpoint |
| SAP Invoice Generation | ✅ Done | P0 | Idempotent endpoint |
| SAP Invoice Re-sync | ✅ Done | P1 | Returns existing invoice |
| Named HttpClient ("SapClient") | ✅ Done | P0 | Pre-configured auth |
| Basic Authentication | ✅ Done | P0 | Auto-generated token |

### Peruri e-Meterai Integration

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| JWT Session Management | ✅ Done | P0 | Cached token with expiry buffer |
| Stamp v2 API Integration | ✅ Done | P0 | Serial number + QR code |
| On-Premise Docker Adapter | ✅ Done | P0 | Container-to-container |
| Shared Volume File Exchange | ✅ Done | P0 | /app/sharefolder |
| QR Code Upload to MinIO | ✅ Done | P1 | Reference storage |
| Dynamic Peruri Request Payload | ✅ Done | P1 | Safe fallbacks |
| Stamp Data Caching | ✅ Done | P2 | Reduce API calls |

### MinIO Storage Integration

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| S3-Compatible Upload | ✅ Done | P0 | AWSSDK.S3 client |
| Presigned URL Generation | ✅ Done | P1 | Time-limited access |
| File Download Endpoint | ✅ Done | P0 | Public access for photos |
| Bucket Initialization | ✅ Done | P0 | createbuckets service |
| Storage Key Patterns | ✅ Done | P1 | Descriptive prefixes |

### Google Maps Integration

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Reverse Geocoding | ✅ Done | P1 | Lat/lng to address |
| Province/City/District Extraction | ✅ Done | P1 | Administrative boundaries |
| Formatted Address Generation | ✅ Done | P1 | Full address string |

### Email Integration

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| SMTP Email Service | ✅ Done | P0 | MailKit integration |
| PIN Dispatch Email | ✅ Done | P1 | 6-digit PIN |
| Delivery Confirmation Email | ✅ Done | P1 | Discrepancy summary |
| Staging Mode Override | ✅ Done | P2 | Hardcoded recipient |

---

## Background Services

### Billing Sync Service

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Background Invoice Creation | ✅ Done | P0 | Automatic after delay |
| Configurable Delay Period | ✅ Done | P1 | DelayMinutes setting |
| Periodic Checking | ✅ Done | P1 | CheckIntervalMinutes |
| Eligible Delivery Detection | ✅ Done | P0 | Received + not invoiced |
| Activity Logging | ✅ Done | P1 | Success/failure tracking |
| Error Handling | ✅ Done | P2 | Continues on failure |

---

## UI/UX Features

### Frontend Design System

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Premium Industrial Utility Theme | ✅ Done | P0 | Brand-blue primary |
| Responsive Layout | ✅ Done | P0 | Mobile-first |
| Dashboard Sidebar | ✅ Done | P0 | Permission-filtered |
| Toast Notifications | ✅ Done | P1 | Success/error/info |
| Modal Dialogs | ✅ Done | P1 | Confirmation prompts |
| Loading States | ✅ Done | P1 | Spinners, skeletons |
| Error Boundaries | 🔄 To Do | P2 | Graceful error handling |

### Performance Optimizations

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| React.memo (LineItemRow) | ✅ Done | P1 | Prevent re-renders |
| useCallback Hooks | ✅ Done | P1 | Stable references |
| useMemo Hooks | ✅ Done | P1 | Expensive calculations |
| Search Debouncing | ✅ Done | P1 | 200ms delay |
| Lazy Modal Rendering | ✅ Done | P1 | Render when visible |
| Map-based State Management | ✅ Done | P1 | O(1) lookups (5000+ items) |
| useDeferredValue API | ✅ Done | P2 | Search input priority |
| useTransition API | ✅ Done | P2 | Non-critical UI updates |
| Code Splitting | 🔄 To Do | P2 | Route-based lazy loading |

---

## DevOps & Deployment

### Docker Containerization

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Backend Docker Image | ✅ Done | P0 | ASP.NET Core 8.0 |
| Frontend Docker Image | ✅ Done | P0 | React 19 + Nginx |
| PostgreSQL Container | ✅ Done | P0 | Official postgres:16 |
| MinIO Container | ✅ Done | P0 | S3-compatible storage |
| SignAdapter Container | ✅ Done | P0 | Peruri e-Meterai signing |
| Nginx Reverse Proxy | ✅ Done | P0 | Unified routing |
| Named Volume Management | ✅ Done | P1 | Shared folders |
| Internal DNS Resolution | ✅ Done | P1 | Container-to-container |

### Configuration Management

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| appsettings.json | ✅ Done | P0 | Base configuration |
| Environment Variables | ✅ Done | P0 | Production overrides |
| Double-Underscore Notation | ✅ Done | P1 | Section__Key mapping |
| Secret Rotation Support | ✅ Done | P2 | Environment-based |
| Docker Compose Configuration | ✅ Done | P0 | Unified stack |

### Database Management

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| EF Core Migrations | ✅ Done | P0 | Automatic on startup |
| RBAC Seeding | ✅ Done | P0 | DbInitializer |
| Plant Master Data Seeding | ✅ Done | P1 | 32 plant codes |
| Default Admin Account | ✅ Done | P0 | admin@amtemeterai.com |
| Test Role Accounts | ✅ Done | P1 | finance, warehouse, sales |

---

## Testing & Quality Assurance

### Unit Testing

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Backend Unit Tests | 🔄 To Do | P1 | xUnit/NUnit |
| Frontend Unit Tests | 🔄 To Do | P1 | Vitest/Jest |
| Service Layer Tests | 🔄 To Do | P1 | Business logic |
| Controller Tests | 🔄 To Do | P2 | API endpoints |
| Component Tests | 🔄 To Do | P2 | React components |

### Integration Testing

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| API Integration Tests | 🔄 To Do | P1 | Postman/Newman |
| Database Integration Tests | 🔄 To Do | P1 | Testcontainers |
| External Service Mocks | 🔄 To Do | P2 | SAP, Peruri |
| End-to-End Tests | 🔄 To Do | P2 | Playwright/Cypress |

### Performance Testing

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Load Testing | 🔄 To Do | P2 | K6/Locust |
| Stress Testing | 🔄 To Do | P3 | High concurrency |
| Database Query Optimization | 🔄 To Do | P2 | Index analysis |

---

## Documentation

### Technical Documentation

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Backend API Documentation | ✅ Done | P0 | Swagger/OpenAPI |
| Frontend Component Documentation | 🔄 To Do | P2 | Storybook |
| Architecture Documentation | ✅ Done | P1 | ARCHITECTURE.md |
| Deployment Guides | 🔄 To Do | P2 | README updates |
| Database Schema Documentation | ✅ Done | P1 | Entity descriptions |

### User Documentation

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Admin User Guide | 🔄 To Do | P2 | UAM instructions |
| End User Guide | 🔄 To Do | P3 | Delivery confirmation |
| Developer Onboarding | 🔄 To Do | P2 | Setup instructions |

---

## Future Enhancements

### Potential Features (Backlog)

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Real-time Notifications (WebSocket) | 🔄 To Do | P2 | Live updates |
| Advanced Filtering & Sorting | 🔄 To Do | P2 | Multi-column sort |
| Export Functionality | 🔄 To Do | P2 | Excel/PDF export |
| Mobile App (React Native) | 🔄 To Do | P3 | Native mobile |
| Offline Support (PWA) | 🔄 To Do | P3 | Service workers |
| Advanced Analytics Dashboard | 🔄 To Do | P2 | Custom reports |
| Multi-Language Support | 🔄 To Do | P3 | i18n |
| Dark Mode | 🔄 To Do | P3 | Theme toggle |
| Audit Log Export | 🔄 To Do | P2 | CSV/JSON export |
| Scheduled Reports | 🔄 To Do | P2 | Email automation |
| Custom Workflow Builder | 🔄 To Do | P3 | Low-code workflows |
| API Rate Limiting | 🔄 To Do | P2 | Throttling |
| Caching Layer (Redis) | 🔄 To Do | P2 | Performance |
| Message Queue (RabbitMQ) | 🔄 To Do | P3 | Async processing |

---

## Technical Debt

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| Consolidate Duplicate Code | 🔄 To Do | P2 | Delivery/Invoice DTOs |
| Improve Error Handling | 🔄 To Do | P1 | Global exception handler |
| Add Comprehensive Logging | 🔄 To Do | P1 | Structured logging |
| Refactor Large Components | 🔄 To Do | P2 | DeliveryReceivePage |
| Optimize Database Queries | 🔄 To Do | P2 | N+1 query prevention |
| Implement Caching Strategy | 🔄 To Do | P2 | Reduce API calls |
| Add API Versioning | 🔄 To Do | P3 | Versioned endpoints |
| Standardize Response Format | 🔄 To Do | P1 | Consistent DTOs |

---

## Milestones

### Milestone 1: Core Platform ✅ (Completed)
- [x] JWT Authentication & RBAC
- [x] Delivery Management
- [x] Invoice Management
- [x] Customer Management
- [x] Dashboard

### Milestone 2: Integration Layer ✅ (Completed)
- [x] SAP ERP Integration
- [x] Peruri e-Meterai Integration
- [x] MinIO Storage
- [x] Email Service
- [x] Google Maps Geocoding

### Milestone 3: Production Deployment ✅ (Completed)
- [x] Docker Containerization
- [x] Nginx Reverse Proxy
- [x] Background Billing Service
- [x] Configuration Management
- [x] Database Migrations

### Milestone 4: Quality & Performance 🔵 (In Progress)
- [ ] Unit Testing
- [ ] Integration Testing
- [ ] Performance Optimization
- [ ] Error Boundaries
- [ ] Documentation Completion

### Milestone 5: Advanced Features 🔄 (To Do)
- [ ] Real-time Notifications
- [ ] Advanced Analytics
- [ ] Export Functionality
- [ ] Mobile Support
- [ ] Multi-language

---

*This roadmap is maintained as part of the OpexNOW / e-meterai project documentation and updated regularly.*
