implementation-plan.md
Overview
Add a PIN validation step to the public delivery confirmation page. Receivers must enter the correct PIN (defined in the Customer table) before they can view delivery details or submit the confirmation.

User Requirements
Validation: Receiver must input a correct PIN based on the customer.customerPin field.

Consistency: Maintain existing Tech Stack (.NET 8, React 19, Tailwind 4, shadcn-style components).

Security: The backend must verify the PIN associated with the delivery's customer.

Proposed Changes
1. Backend Changes (ASP.NET Core)
DTO Updates
Update DeliveryResponseDto: Ensure it does not return the PIN to the frontend initially.

Create DeliveryPinValidationDto:

C#
public class DeliveryPinValidationDto {
    public string Pin { get; set; }
}
Controller Updates (DeliveriesController.cs)
Modify GetDeliveryByToken: Wrap the existing logic to require a PIN or return a 401/403 if the PIN is missing/incorrect. Alternatively, create a secondary endpoint for validation.

Add Validation Endpoint:

POST /api/deliveries/{token}/verify-pin

Logic: Find DeliveryHeader by token -> Include Customer -> Compare CustomerPin with request body.

Service Logic
Ensure the DeliveryHeader query includes the Customer entity to access CustomerPin.

2. Frontend Changes (React)
State Management (DeliveryReceivePage.tsx)
Add isVerified boolean state (default: false).

Add pinInput string state.

Add verifying loading state.

UI Components
Create a PIN Entry Card:

Use existing Card, Input, and Button components.

Style: Centered on page, consistent with the Brand Blue/Red palette.

Logic: Show this card if !isVerified. Hide the delivery details and form until verified.

API Integration
Implement a handleVerifyPin function to call the new backend validation endpoint.

Store verification status in local state (or sessionStorage for persistence during the session).

Technical Tasks
[Backend]
[ ] Update DeliveriesController.cs to add VerifyPin(Guid token, [FromBody] PinDto dto).

[ ] Add logic to check delivery.Customer.CustomerPin == dto.Pin.

[ ] Ensure GetDeliveryByToken remains secure (e.g., only return sensitive line data after verification if required).

[Frontend]
[ ] Update DeliveryReceivePage.tsx to include a verification view.

[ ] Implement PIN input field using the Input component with type="password".

[ ] Connect the "Verify" button to the backend API.

[ ] Show an error message using the brand-red accent if the PIN is incorrect.

Code Snippets (Reference)
Frontend: PIN Verification Card
TypeScript
if (!isVerified) {
  return (
    <div className="min-h-screen bg-brand-blue/2 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Delivery Verification</CardTitle>
          <CardDescription>Please enter the security PIN provided by the sender.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">Security PIN</Label>
            <Input id="pin" type="password" value="{pinInput}" onChange="{(e)"> setPinInput(e.target.value)}
              placeholder="Enter 6-digit PIN"
            />
          </div>
          {error && <p className="text-sm text-brand-red">{error}</p>}
          <Button className="w-full" onClick="{handleVerifyPin}" disabled="{verifying}">
            {verifying ? "Verifying..." : "Access Delivery"}
          </Button>
        </Input></CardContent>
      </Card>
    </div>
  );
}
Backend: Controller Logic
C#
[HttpPost("{token}/verify-pin")]
public async Task<IActionResult> VerifyPin(Guid token, [FromBody] PinRequest request)
{
    var delivery = await _context.DeliveryHeaders
        .Include(d => d.Customer)
        .FirstOrDefaultAsync(d => d.ReceiverToken == token);

    if (delivery == null) return NotFound();
    
    if (delivery.Customer.CustomerPin == request.Pin)
        return Ok(new { valid = true });
        
    return Unauthorized("Invalid PIN");
}
Consistency Checklist
[x] Uses brand-blue for primary buttons.

[x] Uses brand-red/10 for error backgrounds/highlights.

[x] Follows the existing DTO and Controller patterns.

[x] Maintains .NET 8 and React 19 standards.