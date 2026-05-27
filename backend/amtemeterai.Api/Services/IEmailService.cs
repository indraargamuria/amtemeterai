using System.Threading.Tasks;

namespace amtemeterai.Api.Services
{
    public interface IEmailService
    {
        Task SendDeliveryConfirmationEmailAsync(int deliveryId);
        Task<bool> SendPinEmailAsync(string customerEmail, string customerPin, string deliveryNumber);
    }
}