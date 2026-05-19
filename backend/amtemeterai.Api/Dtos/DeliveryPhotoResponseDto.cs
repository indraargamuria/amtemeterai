namespace amtemeterai.Api.Dtos;

public class DeliveryPhotoResponseDto
{
    public string FileName { get; set; } = null!;
    public string StorageKey { get; set; } = null!;
    public string DownloadUrl { get; set; } = null!; // Fully formed, ready-to-use stream link
    public DateTime UploadedAt { get; set; }
}