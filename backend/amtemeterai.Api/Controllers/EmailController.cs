using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using amtemeterai.Api.Services;
using amtemeterai.Api.Dtos;

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = PermissionKeys.InvoiceRead)]
public class EmailController : ControllerBase
{
    private readonly IEmailService _emailService;
    private readonly ILogger<EmailController> _logger;

    public EmailController(
        IEmailService emailService,
        ILogger<EmailController> logger)
    {
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>
    /// Send email with attachments based on delivery or invoice number
    /// </summary>
    /// <param name="request">Email request with recipient details and reference information</param>
    /// <returns>Success status</returns>
    [HttpPost("send-with-attachments")]
    public async Task<IActionResult> SendEmailWithAttachments([FromBody] SendEmailRequestDto request)
    {
        try
        {
            _logger.LogInformation("Email send request received from {User} for {Type} {Number}",
                User.Identity?.Name, request.ReferenceType, request.ReferenceNumber);

            var result = await _emailService.SendEmailWithAttachmentsAsync(request);

            if (result)
            {
                return Ok(new { message = "Email sent successfully" });
            }
            else
            {
                return BadRequest(new { message = "Failed to send email" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending email with attachments");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }
}
