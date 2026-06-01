// Services/MinioStorageService.cs
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using System;
using System.IO;
using System.Threading.Tasks;

namespace amtemeterai.Api.Services
{
    public class MinioStorageService : IStorageService
    {
        private readonly IAmazonS3 _s3Client;
        private readonly string _bucketName;

        public MinioStorageService(IConfiguration configuration)
        {
            var minioConfig = configuration.GetSection("Minio");
            
            var s3Config = new AmazonS3Config
            {
                ServiceURL = $"http://{minioConfig["Endpoint"]}",
                ForcePathStyle = true // This flag is mandatory for local MinIO routing
            };

            _s3Client = new AmazonS3Client(minioConfig["AccessKey"], minioConfig["SecretKey"], s3Config);
            _bucketName = minioConfig["BucketName"] 
              ?? throw new InvalidOperationException("MinIO configuration error: 'BucketName' is missing in appsettings.json");
        }

        public async Task DeleteFileAsync(string objectKey)
        {
            if (string.IsNullOrEmpty(objectKey)) return;

            try
            {
                // 1. Initialize the S3-compatible delete parameters
                var deleteRequest = new DeleteObjectRequest
                {
                    BucketName = _bucketName,
                    Key = objectKey
                };

                // 2. Transmit the deletion command via the AWS S3 Client wrapper
                await _s3Client.DeleteObjectAsync(deleteRequest);
            }
            catch (AmazonS3Exception ex)
            {
                Console.WriteLine($"[MinIO/S3 Error] Exception thrown during asset purge execution for key '{objectKey}': {ex.Message}");
                throw;
            }
        }
        
        public async Task<string> UploadFileAsync(string objectKey, Stream fileStream, string contentType)
        {
            var putRequest = new PutObjectRequest
            {
                BucketName = _bucketName,
                Key = objectKey,
                InputStream = fileStream,
                ContentType = contentType
            };

            await _s3Client.PutObjectAsync(putRequest);
            return objectKey;
        }
        // Services/MinioStorageService.cs
        public async Task<string> GetPresignedUrlAsync(string objectKey, double expiryMinutes = 60)
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = _bucketName,
                Key = objectKey,
                Expires = DateTime.UtcNow.AddMinutes(expiryMinutes)
            };

            // Note the exact capitalization of the AWS SDK method: GetPreSignedURLAsync
            return await _s3Client.GetPreSignedURLAsync(request);
        }

        // 2026-05-19 21:08:20
        public async Task<Stream> GetFileStreamAsync(string objectKey)
        {
            try
            {
                var request = new GetObjectRequest
                {
                    BucketName = _bucketName,
                    Key = objectKey
                };

                // Fetch the response object from MinIO via AWSSDK
                GetObjectResponse response = await _s3Client.GetObjectAsync(request);

                // This ResponseStream is already a live, open network stream from MinIO.
                // We pass it directly back to our File() controller result.
                return response.ResponseStream;
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // Return null if the file doesn't exist so your controller can return a clean NotFound()
                return null!;
            }
        }
    }
}