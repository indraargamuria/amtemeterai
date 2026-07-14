namespace amtemeterai.Api.Config;

/// <summary>
/// Configuration options for MinIO S3-compatible object storage
/// </summary>
public class MinioOptions
{
    public const string SectionName = "Minio";

    /// <summary>
    /// MinIO server endpoint (host:port format)
    /// Example: "minio:9000" for Docker internal network
    /// Example: "localhost:9000" for local development
    /// </summary>
    public string Endpoint { get; set; } = string.Empty;

    /// <summary>
    /// S3-compatible access key for authentication
    /// </summary>
    public string AccessKey { get; set; } = string.Empty;

    /// <summary>
    /// S3-compatible secret key for authentication
    /// </summary>
    public string SecretKey { get; set; } = string.Empty;

    /// <summary>
    /// Target bucket name for document storage
    /// </summary>
    public string BucketName { get; set; } = string.Empty;

    /// <summary>
    /// Use HTTPS (true) or HTTP (false) for connection
    /// MinIO typically uses HTTP in internal Docker networks
    /// </summary>
    public bool Secure { get; set; } = false;
}
