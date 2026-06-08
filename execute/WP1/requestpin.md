# Task: Implement Secure Out-of-Band PIN Request Feature using Existing Customer PIN

## Context
We are adding a secure, high-density corporate SaaS feature to our public delivery receipt view. When a client or buyer opens their unique tracking parameter link (`/receive/:token`), they are met with a pin validation form wrapper. To provide an elegant fallback mechanism for authorized receivers who don't have their access keys on hand, we want to implement a "Request PIN" button module.

Because the token in the URL is a cryptographically secure GUID (`ReceiverToken`), we can fully identify the delivery and customer context from the database without exposing auto-incrementing sequential integers or private client scopes. Clicking this button will look up the specific delivery record, extract the **existing PIN from the customer master table/model**, transmit it securely to the customer's registered corporate notification email using our configured MailKit/MimeKit engine, and render a safely masked preview of the email address back to the user interface.

---

## Technical Specifications & Requirements

### 1. Backend Changes

#### File to Modify: `backend/amtemeterai.Api/Controllers/DeliveriesController.cs`
- Integrate a new HTTP target route endpoint.
- **Endpoint Route:** `POST api/deliveries/public/request-pin`
- **Authorization Attribute:** Must be annotated with `[AllowAnonymous]`. This route is designed to be accessed by unauthenticated drop-off operators or buyers possessing the valid cryptographic receipt URL token.
- **Input DTO Structure:** Accepts a JSON body payload containing `Guid receiverToken`.

#### Functional Logic inside the Controller Endpoint:
1. **Validation & Context Discovery:** Query `_db.DeliveryHeaders` to locate the single record matching `ReceiverToken == payload.ReceiverToken`. You must cascade load the related customer data graph using `.Include(d => d.Customer)`.
   - If no matching tracking record is found, or if `Received` is already set to true, return an appropriate `NotFound` or `BadRequest` error code response immediately.
2. **PIN Extraction:** Do **not** generate or hash a new token sequence. Instead, safely pull the **already existing PIN field** directly from the attached customer entity reference matching that delivery master record.
3. **Email Dispatch Integration:** - Extract the customer's corporate notification email address.
   - Using the exact same `SmtpSettings` injection pattern and connection handshake workflows defined in your `EmailService.cs` implementation (instantiating `MimeMessage`, checking SMTP server settings, connecting via `SecureSocketOptions`, authenticating, and firing via `MailKit.Net.Smtp.SmtpClient`), compose and transmit an email message delivering the pre-existing company verification PIN to the recipient.
4. **Privacy Layer (Email Masking Helper):** Implement a utility helper inside the controller to mask parts of the target notification email address before transmitting it back to the client browser to protect business metadata.
   - *Example formatting engine behavior:* `logistics.coordinator@client-firm.co.id` must be translated into text formatted like `lo***********************r@client-firm.co.id`.
5. **JSON Response Structuring:** Return a `200 OK` action result tracking signature:
   ```json
   {
     "success": true,
     "message": "Verification PIN dispatched successfully.",
     "sentTo": "lo***********************r@client-firm.co.id"
   }
2. Frontend Changes
File to Modify: frontend/src/pages/receive/DeliveryReceivePage.tsx
Integrate a contextual UI trigger button underneath or stacked within your main PIN digit input form containers.

Maintain localized status tracking variables using hooks: isSending (boolean), sentToEmail (string | null), and requestError (string | null).

Wire a handler to execute an asynchronous POST request targeting /api/deliveries/public/request-pin, feeding the explicit parameter object: { receiverToken: token }.

Visual UX Feedback Sequence:
Default State: Render a neat informational subtext block: "Don't know your security pin? Click below to dispatch it to your company's registered channel." paired with an explicit action button button component.

Processing State: While the network request execution is in flight, toggle components into a disabled layout form state and update button labels to display "Processing Request...".

Success State: Upon receiving a successful response envelope from the API layer, replace the action button with an animated Tailwind box component styled with a clean emerald design scheme (bg-emerald-950/30, border-emerald-500/20, text-emerald-400 context colors) stating:

🔒 Security code sent! Check the inbox of:

Present the raw sentToEmail masked string in a highly visible monospace tracking alignment (font-mono tracking-wide).

Provide a text link underneath allowing users to reset the local status loop back to null to facilitate error recovery or retry actions.