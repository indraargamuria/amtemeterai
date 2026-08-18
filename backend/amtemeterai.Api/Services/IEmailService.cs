using System.Threading.Tasks;
using amtemeterai.Api.Dtos;

namespace amtemeterai.Api.Services
{
    public interface IEmailService
    {
        Task SendDeliveryConfirmationEmailAsync(int deliveryId);
        Task<bool> SendPinEmailAsync(string customerEmail, string customerPin, string deliveryNumber);
        Task<bool> SendEmailWithAttachmentsAsync(SendEmailRequestDto request);
    }
}