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
            string targetToEmail = "syarif@opexcg.com";
            string targetCcEmail = "arga@opexcg.com;hari@opexcg.com";

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
            
            // Include CC Router rules for observation transparency
            if (!string.IsNullOrWhiteSpace(targetCcEmail))
            {
                message.Cc.Add(new MailboxAddress("", targetCcEmail));
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
                
                _logger.LogInformation("Confirmation mail successfully dispatched to {Email} (CC: {Cc}) for Delivery: {Num}", targetToEmail, targetCcEmail ?? "None", delivery.DeliveryNumber);
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
    }
}