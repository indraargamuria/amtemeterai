namespace amtemeterai.Api.Services;

/// <summary>
/// Service for extracting PDF anchor text coordinates to dynamically calculate
/// e-Meterai stamp bounding box positions.
/// </summary>
public interface IPdfAnchorService
{
    /// <summary>
    /// Extracts the "Notes" keyword position from a PDF stream and calculates
    /// the e-Meterai stamp bounding box coordinates.
    /// </summary>
    /// <param name="pdfStream">Stream containing the PDF document</param>
    /// <returns>Tuple containing (visLLX, visLLY, visURX, visURY, stampPageNumber) or null if anchor not found</returns>
    Task<(int visLLX, int visLLY, int visURX, int visURY, int stampPageNumber)?> ExtractStampCoordinatesAsync(Stream pdfStream);
}
