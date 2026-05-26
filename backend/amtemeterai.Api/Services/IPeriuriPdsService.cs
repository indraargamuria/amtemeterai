namespace amtemeterai.Api.Services;

public interface IPeriuriPdsService
{
    Task<PeriuriStampingResult> StampPdfAsync(byte[] pdfContent, string invoiceNumber, string customerName);
    Task<PeriuriStampingStatusResponse> CheckStampingStatusAsync(string transactionId);
}

public record PeriuriStampingResult
{
    public bool Success { get; init; }
    public string? SerialNumber { get; init; }
    public string? TransactionId { get; init; }
    public string? ErrorMessage { get; init; }
    public StampCoordinates? Coordinates { get; init; }
}

public record StampCoordinates
{
    public int PageNumber { get; init; }
    public double X { get; init; }
    public double Y { get; init; }
    public double Width { get; init; }
    public double Height { get; init; }
}

public record PeriuriStampingStatusResponse
{
    public bool IsCompleted { get; init; }
    public string? SerialNumber { get; init; }
    public string? StampedPdfUrl { get; init; }
    public string? ErrorMessage { get; init; }
}