# Dashboard Enhancement & Activity Logging PRD

## 1. Overview
This document outlines the technical requirements for upgrading the AmtemeterAI Dashboard from dummy data to a live, data-driven interface. It introduces a new `ActivityLog` entity and provides the roadmap for Claude Code to implement changes across the .NET backend and React frontend.

## 2. Database Schema Modifications (Backend)

### 2.1 New Entity: `ActivityLog`
To support the "Logging" requirement, we will create a central table to track lifecycle events.

| Column | Type | Description |
| :--- | :--- | :--- |
| `LogID` | `int` (PK) | Primary Key |
| `Timestamp` | `DateTime` | When the event occurred |
| `EventType` | `string` | e.g., "DeliveryCreated", "DeliveryReceived", "CustomerSynced" |
| `ReferenceID` | `string` | The DeliveryNumber or CustomerCode involved |
| `Message` | `string` | Human-readable description |
| `Severity` | `string` | "Info", "Success", "Warning" (for rejections) |

### 2.2 Model Update: `DeliveryHeader`
No structural changes are strictly required, but we will ensure `Received` and `Invoiced` flags are utilized to drive dashboard metrics.

---

## 3. API Enhancements

### 3.1 New Endpoint: `GET /api/dashboard/stats`
Returns aggregated data for the KPI cards.
- **Total Deliveries**: Count of all headers.
- **Pending**: Count where `Received == false`.
- **Rejection Rate**: (Total Rejected / Total Delivered) from `DeliveryLines`.

### 3.2 New Endpoint: `GET /api/dashboard/charts`
Returns data grouped by date for the last 30 days.
- Format: `Array<{ date: string, count: number }>`

### 3.3 New Endpoint: `GET /api/dashboard/logs`
Returns the latest 10-20 entries from the `ActivityLog` table.

---

## 4. Frontend Enhancements (React)

### 4.1 Dashboard Layout
- **KPI Row**: Four cards using the existing `Card` component.
- **Main Section**: 
  - Left (2/3): **Delivery Trend** (Area Chart).
  - Right (1/3): **Status Distribution** (Donut Chart).
- **Bottom Section**: **Activity Feed** (List of logs with timestamp and status indicators).

### 4.2 Visual Identity
- **Primary Blue (#1d2351)**: Main chart lines, info logs.
- **Accent Red (#e61920)**: Rejection alerts, critical warnings.

---

## 5. Implementation Guide for Claude Code

### Step 1: Backend Models
Create `Models/ActivityLog.cs` and add `DbSet<ActivityLog>` to `AppDbContext.cs`.

### Step 2: Logging Interceptor
Modify `DeliveriesController.cs` to insert a log entry whenever:
- A delivery is created (`POST`).
- A delivery is received/confirmed via token (`PATCH`).

### Step 3: Dashboard Controller
Create `Controllers/DashboardController.cs` to handle the new aggregation logic.

### Step 4: Frontend Integration
1. Update `shared/utils/api.ts` if needed.
2. Create `pages/Dashboard/DashboardPage.tsx` logic to fetch from the new endpoints.
3. Install a chart library (e.g., `recharts`) if not already present.

---

## 6. Success Metrics
- Dashboard loads in < 500ms.
- Logging accurately reflects every user action in real-time.
- Visuals align with the OpexIO "Enterprise SaaS" aesthetic.