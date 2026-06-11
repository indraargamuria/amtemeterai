You are an expert Enterprise .NET Web API engineer specializing in Entity Framework Core, PostgreSQL (Npgsql), and clean architecture.

### Context
We have refactored our database schema to migrate tracking identifiers from the master header down to granular line-item records to support a high-density nested batch framework.
1. The columns `BuyerPONumber` and `OrderNumber` have been removed from the `DeliveryHeaders` table.
2. The columns `BuyerPONumber`, `OrderNumber`, and `ParentLineNumber` have been added to the `DeliveryLines` table.

### Objective
Refactor `DeliveriesController.cs` and all corresponding Data Transfer Objects (DTOs) to fully support, store, and expose these three attributes at the line-item level.

### Refactoring Specifications

1. **DTO Schema Expansion:**
   * Locate the relevant target line DTO classes (such as `DeliveryLineResponseDto`, `DeliveryLineUpsertDto`, or equivalents).
   * Ensure `BuyerPONumber` (string?), `OrderNumber` (string?), and `ParentLineNumber` (string, defaulting to `"0"`) are declared as properties.

2. **GET `api/deliveries/{deliveryId:int}` (GetDeliveryById):**
   * Review the existing projection loop where `lines` are mapped to `DeliveryLineResponseDto`.
   * Ensure `l.ParentLineNumber` is explicitly retrieved and mapped from the database entity to the response object alongside `OrderNumber` and `BuyerPONumber`.
   * Keep the data visibility rule intact: clear or nullify `OrderNumber` and `BuyerPONumber` if the user is in the `warehouse` role (`isWarehouseRole ? null : l.OrderNumber`). Do not change this role-based guard rule.

3. **POST `api/deliveries` (Create Method):**
   * Locate the transformation block where the incoming `dto.Lines` collection is mapped into new `DeliveryLine` entity instances.
   * Explicitly map the properties from the DTO lines to the backend entry entity records:
     * `OrderNumber = l.OrderNumber`
     * `BuyerPONumber = l.BuyerPONumber`
     * `ParentLineNumber = l.ParentLineNumber`

4. **PATCH `api/deliveries` (Upsert Method):**
   * Locate the structural block where existing line items are dropped using `_db.DeliveryLines.RemoveRange(existing.Lines)` and re-populated.
   * Ensure the `.Select(l => new DeliveryLine { ... })` projection copies `OrderNumber`, `BuyerPONumber`, and `ParentLineNumber` from the incoming request items payload array cleanly before performing the save sequence.

### Code Constraints
* Maintain strict technical safety typing; use null-coalescing fallbacks where appropriate (e.g., `l.ParentLineNumber ?? "0"`).
* Skip modifications on endpoints that are already correct, but make sure mapping properties match our exact schema keys across GET, POST, and PATCH flows.
* Do not alter any other metadata tracking operations, database save contexts, or logging steps (`LogActivity`).