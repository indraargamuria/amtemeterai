using System.IO;
using System.Threading.Tasks;

namespace amtemeterai.Api.Services
{
    public interface IStorageService
    {
        Task<string> UploadFileAsync(string objectKey, Stream fileStream, string contentType);
        
        // Changed to Task<string> and appended Async to the name
        Task<string> GetPresignedUrlAsync(string objectKey, double expiryMinutes = 60);
        // 💡 ADD THIS LINE RIGHT HERE:
        Task<Stream> GetFileStreamAsync(string storageKey);
    }
}