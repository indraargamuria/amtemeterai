using amtemeterai.Api.Config; // Kept as your local namespace reference
using amtemeterai.Api.Data;
using amtemeterai.Api.Models;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MimeKit;
using System;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace amtemeterai.Api.Services
{
    public class EmailService : IEmailService
    {
        private readonly AppDbContext _db;
        private readonly SmtpSettings _settings;
        private readonly ILogger<EmailService> _logger;

        public EmailService(
            AppDbContext db, 
            IOptions<SmtpSettings> settings, 
            ILogger<EmailService> logger)
        {
            _db = db;
            _settings = settings.Value;
            _logger = logger;
        }

        public async Task SendDeliveryConfirmationEmailAsync(int deliveryId)
        {
            // 1. Fetch complete delivery details including relational lines data
            var delivery = await _db.DeliveryHeaders
                .Include(d => d.Lines)
                .FirstOrDefaultAsync(d => d.DeliveryID == deliveryId);

            if (delivery == null)
            {
                _logger.LogWarning("Email task aborted: Delivery record with ID {Id} not found.", deliveryId);
                return;
            }

            // ====================================================================
            // 🔒 RECIPIENT ROUTING ENGINE (TEMPORARY HARDCODE GUARD)
            // ====================================================================
            // [STAGING MODE ACTIVE]: Direct delivery targets explicitly defined
            string targetToEmail = "arga@opexcg.com";
            
            // 🚀 Updated: Collection engine to cleanly route multiple transparent visibility copies
            string[] targetCcEmails = new[] 
            { 
                // "arga@opexcg.com", 
                // "hari@opexcg.com" // You can append additional testing emails here
            };

            /* // TODO: UNCOMMENT THIS BLOCK TO ACTIVATE DYNAMIC PRODUCTION SALESPERSON ROUTING ON LIVE GO-LIVE
            if (string.IsNullOrWhiteSpace(delivery.SalesPersonEmail))
            {
                _logger.LogWarning("Email task skipped: SalesPersonEmail field is null or empty for Delivery: {Num}", delivery.DeliveryNumber);
                return;
            }
            string targetToEmail = delivery.SalesPersonEmail;
            */
            // ====================================================================

            // 2. Identify if any items were damaged, missing, or rejected
            bool hasDiscrepancies = delivery.Lines.Any(l => l.PackQuantityReturned > 0 || l.PackQuantityRejected > 0);

            string subject = hasDiscrepancies
                ? $"⚠️ [Discrepancy Variance] Delivery Confirmed: {delivery.DeliveryNumber}"
                : $"✅ [Clean Receipt] Delivery Confirmed: {delivery.DeliveryNumber}";

            // 3. Compile high-density HTML content
            var emailBody = BuildHtmlTemplate(delivery, hasDiscrepancies);

            // 4. Transport execution core via MailKit
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.SenderName, _settings.SenderEmail));
            
            // Assign Staging/Production Target Maps
            message.To.Add(new MailboxAddress("", targetToEmail));
            
            // 🚀 Iteratively inject all active CC staging routes safely into MailKit address collection
            foreach (var ccEmail in targetCcEmails)
            {
                if (!string.IsNullOrWhiteSpace(ccEmail))
                {
                    message.Cc.Add(new MailboxAddress("", ccEmail.Trim()));
                }
            }

            message.Subject = subject;

            var bodyBuilder = new BodyBuilder { HtmlBody = emailBody };
            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            try
            {
                // Connect using explicitly typed STARTTLS configurations required by Google
                await client.ConnectAsync(_settings.Server, _settings.Port, SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(_settings.Username, _settings.Password);
                await client.SendAsync(message);
                
                // Join targets for cleaner structured trace logging
                string ccTraceList = string.Join(", ", targetCcEmails);
                _logger.LogInformation("Confirmation mail successfully dispatched to {Email} (CC: [{Cc}]) for Delivery: {Num}", targetToEmail, ccTraceList, delivery.DeliveryNumber);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send notification email via Gmail SMTP for Delivery ID: {Id}", deliveryId);
                throw; // Rethrow to let background worker log the execution error trace correctly
            }
            finally
            {
                await client.DisconnectAsync(true);
            }
        }

        private string BuildHtmlTemplate(DeliveryHeader delivery, bool hasDiscrepancies)
        {
            var sb = new StringBuilder();
            sb.Append("<div style='font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; color: #1d2351; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;'>");
            sb.Append($"<h2 style='margin-top: 0; font-size: 20px; font-weight: 600; color: {(hasDiscrepancies ? "#dc2626" : "#1d2351")};'>Fulfillment Confirmation Report</h2>");
            sb.Append("<p style='font-size: 14px; color: #64748b;'>A buyer has verified delivery status. See operational payload details below:</p>");
            
            sb.Append("<table style='width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;'>");
            sb.Append($"<tr><td style='padding: 6px 0; color: #64748b; width: 35%;'>Delivery Number:</td><td style='padding: 6px 0; font-weight: 600;'>{delivery.DeliveryNumber}</td></tr>");
            sb.Append($"<tr><td style='padding: 6px 0; color: #64748b;'>Receiver Name:</td><td style='padding: 6px 0; font-weight: 600;'>{delivery.ReceiverName}</td></tr>");
            sb.Append($"<tr><td style='padding: 6px 0; color: #64748b;'>Fulfillment State:</td><td style='padding: 6px 0; font-weight: 600;'>{(hasDiscrepancies ? "<span style='color:#dc2626;'>Discrepancy Variance Flagged</span>" : "<span style='color:#16a34a;'>Clean Transaction</span>")}</td></tr>");
            sb.Append($"<tr><td style='padding: 6px 0; color: #64748b;'>Buyer Notes:</td><td style='padding: 6px 0; font-style: italic;'>{(string.IsNullOrWhiteSpace(delivery.ReceiverNotes) ? "-" : delivery.ReceiverNotes)}</td></tr>");
            sb.Append("</table>");

            // Build dynamic validation sub-table if discrepancy variables exist
            if (hasDiscrepancies)
            {
                sb.Append("<h3 style='font-size: 14px; font-weight: 600; color: #dc2626; margin-top: 24px; margin-bottom: 8px;'>Discrepancy Line Items Summary:</h3>");
                sb.Append("<table style='width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;'>");
                
                // HEADER LINE: Expanded explicitly to track detailed quantitative balances
                sb.Append("<tr style='background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;'>");
                sb.Append("<th style='padding: 8px;'>Item Code</th>");
                sb.Append("<th style='padding: 8px; text-align: center;'>Ordered</th>");
                sb.Append("<th style='padding: 8px; text-align: center; color: #16a34a;'>Delivered</th>");
                sb.Append("<th style='padding: 8px; text-align: center; color: #ea580c;'>Returned</th>");
                sb.Append("<th style='padding: 8px; text-align: center; color: #dc2626;'>Rejected</th>");
                sb.Append("<th style='padding: 8px; padding-left: 12px;'>Comments</th>");
                sb.Append("</tr>");

                foreach (var line in delivery.Lines.Where(l => l.PackQuantityReturned > 0 || l.PackQuantityRejected > 0))
                {
                    sb.Append("<tr style='border-bottom: 1px solid #f1f5f9;'>");
                    sb.Append($"<td style='padding: 8px; font-weight: 500;'>{line.DeliveryItemCode}</td>");
                    sb.Append($"<td style='padding: 8px; text-align: center;'>{line.PackQuantity:0}</td>");
                    sb.Append($"<td style='padding: 8px; text-align: center; color: #16a34a; font-weight: 600;'>{line.PackQuantityDelivered:0}</td>");
                    sb.Append($"<td style='padding: 8px; text-align: center; color: #ea580c; font-weight: 600;'>{line.PackQuantityReturned:0}</td>");
                    sb.Append($"<td style='padding: 8px; text-align: center; color: #dc2626; font-weight: 600;'>{line.PackQuantityRejected:0}</td>");
                    sb.Append($"<td style='padding: 8px; padding-left: 12px; color: #64748b;'>{(string.IsNullOrWhiteSpace(line.LineComment) ? "-" : line.LineComment)}</td>");
                    sb.Append("</tr>");
                }
                sb.Append("</table>");
            }

            sb.Append("<hr style='border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;' />");
            sb.Append("<p style='font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;'>Automated transmission sent via OpexNOW Engine System.</p>");
            sb.Append("</div>");

            return sb.ToString();
        }

        public async Task<bool> SendPinEmailAsync(string customerEmail, string customerPin, string deliveryNumber)
        {
            // ====================================================================
            // 🔒 RECIPIENT ROUTING ENGINE (TEMPORARY HARDCODE GUARD FOR UAT)
            // ====================================================================
            // [STAGING MODE ACTIVE]: Direct PIN delivery targets explicitly defined
            string targetToEmail = "arga@opexcg.com";
            
            string[] targetCcEmails = new[] 
            { 
                // "arga@opexcg.com", 
                // "hari@opexcg.com" 
            };

            /* // TODO: UNCOMMENT THIS BLOCK TO ACTIVATE PRODUCTION LIVE CUSTOMER PIN ROUTING
            if (string.IsNullOrWhiteSpace(customerEmail))
            {
                _logger.LogWarning("Email task skipped: Customer email is null or empty for delivery {DeliveryNumber}", deliveryNumber);
                return false;
            }
            string targetToEmail = customerEmail;
            */
            // ====================================================================

            string subject = $"🔒 Your Delivery Verification PIN - {deliveryNumber}";

            var emailBody = BuildPinEmailTemplate(customerPin, deliveryNumber);

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.SenderName, _settings.SenderEmail));
            
            // Assign Staging Target Maps
            message.To.Add(new MailboxAddress("", targetToEmail));
            
            // Inject all active CC validation loops safely into MailKit collections
            foreach (var ccEmail in targetCcEmails)
            {
                if (!string.IsNullOrWhiteSpace(ccEmail))
                {
                    message.Cc.Add(new MailboxAddress("", ccEmail.Trim()));
                }
            }

            message.Subject = subject;

            var bodyBuilder = new BodyBuilder { HtmlBody = emailBody };
            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            try
            {
                await client.ConnectAsync(_settings.Server, _settings.Port, SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(_settings.Username, _settings.Password);
                await client.SendAsync(message);

                string ccTraceList = string.Join(", ", targetCcEmails);
                _logger.LogInformation("PIN email successfully dispatched to {Email} (CC: [{Cc}]) for delivery {DeliveryNumber}", targetToEmail, ccTraceList, deliveryNumber);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send PIN email to {Email} for delivery {DeliveryNumber}", targetToEmail, deliveryNumber);
                return false;
            }
            finally
            {
                await client.DisconnectAsync(true);
            }
        }
        
        private string BuildPinEmailTemplate(string pin, string deliveryNumber)
        {
            var sb = new StringBuilder();
            
            // Outer wrapping container wrapper to force white backdrop isolation layers even on deep night configurations
            sb.Append("<div style='background-color: #ffffff; padding: 32px 16px; min-height: 100%; width: 100%; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;'>");
            
            // Core Card Frame
            sb.Append("<div style='background-color: #ffffff; color: #0f172a; max-width: 580px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);'>");

            // Header Meta Block
            sb.Append("<div style='text-align: center; margin-bottom: 28px;'>");
            sb.Append("<div style='width: 56px; height: 56px; background-color: #f1f5f9; border-radius: 50%; display: inline-block; text-align: center; line-height: 56px;'>");
            sb.Append("<span style='font-size: 24px; vertical-align: middle;'>🔒</span>");
            sb.Append("</div>");
            sb.Append("<h2 style='margin: 16px 0 6px 0; font-size: 22px; font-weight: 700; color: #1e3a8a; tracking-tight: -0.025em;'>Corporate Security PIN</h2>");
            sb.Append($"<p style='font-size: 14px; color: #475569; margin: 0;'>Delivery Destination Context: <strong style='color: #0f172a;'>{deliveryNumber}</strong></p>");
            sb.Append("</div>");

            // Clean, High-Contrast PIN Display Section (White background with dark blue border to survive night modes gracefully)
            sb.Append("<div style='background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;'>");
            sb.Append("<p style='font-size: 12px; font-weight: 600; color: #64748b; margin: 0 0 8px 0; letter-spacing: 1px; uppercase;'>YOUR ACTIVE VERIFICATION CODE</p>");
            sb.Append($"<div style='font-size: 38px; font-weight: 800; color: #1e3a8a; letter-spacing: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; padding-left: 10px;'>{pin}</div>");
            sb.Append("</div>");

            // Informational Flow Block
            sb.Append("<div style='background-color: #f8fafc; border-radius: 8px; padding: 18px; margin: 24px 0; border: 1px solid #e2e8f0;'>");
            sb.Append("<h3 style='margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;'>Fulfillment Verification Steps:</h3>");
            sb.Append("<ol style='margin: 0; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.7;'>");
            sb.Append("<li>Return to your secure tracking landing page URL</li>");
            sb.Append("<li>Provide authorization details along with the unique 6-digit PIN above</li>");
            sb.Append("<li>Confirm physical item volume allocations to complete hand-off ledger state</li>");
            sb.Append("</ol>");
            sb.Append("</div>");

            // Security Disclaimer Banner - Adjusted to emphasize the 3-month rotation constraint
            sb.Append("<div style='background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px; padding: 14px 16px; margin: 24px 0;'>");
            sb.Append("<p style='font-size: 12.5px; color: #1e40af; margin: 0; line-height: 1.5;'>");
            sb.Append("⏳ <strong>Dynamic Security Policy:</strong> This verification code is mapped to your corporate registry for the current cycle. To maintain compliance and security integrity, authorization codes are automatically rotated every 3 months.");
            sb.Append("</p>");
            sb.Append("</div>");

            // Standard Footer Elements
            sb.Append("<hr style='border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;' />");
            sb.Append("<p style='font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0; line-height: 1.4;'>");
            sb.Append("Automated transmission generated securely by AMT e-Meterai ERP Connector Systems.<br />");
            sb.Append("Verification codes cycle automatically on a quarterly schedule to protect supply chain hand-offs.");
            sb.Append("</p>");

            sb.Append("</div>"); // Close core card frame
            sb.Append("</div>"); // Close outer wrapper block

            return sb.ToString();
        }
    }
}