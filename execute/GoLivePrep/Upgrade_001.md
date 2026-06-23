# Target Specification: Production Go-Live Readiness Upgrades

This document outlines four separate, isolated development steps required to adapt AmtemeterAI for a secure, resilient live production server deployment. Implement each step sequentially, leveraging the existing identity models, configuration interfaces, and background patterns.

---

## Task 1: Admin-Only User Registration Panel ✅ COMPLETED

### Context
The application uses ASP.NET Core Identity with permission-based dynamic RBAC. We need a secure user registration flow restricted exclusively to system administrators.

### Backend Changes (`amtemeterai.Api`)
1. Create a registration endpoint `POST /api/admin/users/register` inside a new or existing administrative controller.
2. Secure the endpoint using explicit attribute restrictions: `[Authorize(Roles = "sysadmin")]` or using your permission model `[HasPermission(Permissions.UserCreate)]`.
3. The request payload must accept Username, Email, Password, and a Target Role string.
4. Implement validation: verify the role exists in the identity database before assigning it. Use `UserManager<ApplicationUser>` and `RoleManager<IdentityRole>` to process creation and role mapping securely.

### Frontend Changes
1. Create a user registration view component featuring inputs for username, email, password, and a dropdown selector mapping available roles.
2. Integrate this view into the management or settings navigation shell.
3. Wrap the sidebar link and route configuration using the existing authorization context checker so that the view panel is completely hidden and inaccessible to non-admin accounts.

---

## Task 2: Environment Variable Configuration Provider Mapping ✅ COMPLETED

### Context
In production, configurations must be driven dynamically by system environment variables injected via Docker rather than hardcoded configuration fallbacks.

### Backend Changes (`amtemeterai.Api`)
1. Ensure `Program.cs` calls `builder.Configuration.AddEnvironmentVariables()` to load runtime overrides.
2. Review configuration bindings for `SapOptions` and your SMTP mailing setup. 
3. Standardize configuration structures so they successfully map the double-underscore notation used by modern container environments. For example, ensure your service classes bind seamlessly when values are injected through these explicit paths:
   - `SapOptions__BaseUrl`
   - `SapOptions__Username`
   - `SapOptions__Password`
   - `Smtp__Host`
   - `Smtp__Port`
   - `Smtp__Username`
   - `Smtp__Password`

---

## Task 3: Resilient Fallback for Missing Google Maps API Key

### Context
When drivers submit drop-off confirmations via public token links, the system records GPS location coordinates and performs reverse geocoding. The application must remain fully functional if a customer chooses not to supply an external Google Maps API key.

### Backend Changes (`amtemeterai.Api`)
1. Locate the location capture logic inside the delivery confirmation handler (e.g., within `DeliveriesController.UpdateByToken`).
2. Wrap the external Google Geocoding API HttpClient network request in a robust `try-catch` block.
3. If the `_googleApiKey` field is null, empty, or returns a 403 Forbidden status, catch the error gracefully instead of letting the transaction fail.
4. Fall back by saving the raw latitude and longitude floats to the database, while setting the human-readable text string fields (`CityRegency`, `District`, `Province`) to a placeholder like `"Coordinates Logged (Address Offline)"`.

### Frontend Changes
1. Open the delivery detail view layout where location routing data is processed.
2. Add a conditional check evaluating the presence of geocoding values or active maps keys.
3. If the interactive map cannot render or coordinates stand alone, gracefully hide the broken map canvas wrapper.
4. Render a clean fallback hyperlink text element or badge pointing out to an open-source external mapping directory using the raw coordinates: `https://www.openstreetmap.org/?mlat={lat}&mlon={lng}`.

---

## Task 4: Daily Midnight Customer Sync Background Job

### Context
The application uses an `ICustomerSource` infrastructure mapping interface to manage customer data synchronization with SAP. This background sync must be scheduled as an automated off-peak daily job running at midnight.

### Backend Changes (`amtemeterai.Api`)
1. Create an enterprise-grade worker class named `SapCustomerSyncWorker` inheriting directly from Microsoft's native `BackgroundService` class.
2. Implement a loop that computes the time span difference remaining until the next upcoming midnight deployment execution timestamp, executing a non-blocking delay via `Task.Delay(timeUntilMidnight, stoppingToken)`.
3. **Critical Scoped Context Boundary Rule:** Because `BackgroundService` is instantiated as a singleton infrastructure thread, it cannot inject scoped database objects directly. Implement a structured service scope factory within the execution loop to process data safely:
   ```csharp
   using (var scope = _serviceProvider.CreateScope())
   {
       var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
       var sapSource = scope.ServiceProvider.GetRequiredService<ICustomerSource>();
       
       // Invoke sync methods and commit changes to database tracking entities safely here
   }