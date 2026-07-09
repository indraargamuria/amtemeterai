using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace amtemeterai.Api.Services;

/// <summary>
/// Implementation of PDF anchor text coordinate extractor using PdfPig library.
/// Searches for the "Notes" keyword and calculates e-Meterai stamp bounding box coordinates.
/// </summary>
public class PdfAnchorService : IPdfAnchorService
{
    // Constants for e-Meterai stamp size and positioning
    private const int StampSize = 54; // 54x54 point bounding box
    private const int HardcodedVisURX = 482; // Lock horizontal target (X-Axis)
    private const int VerticalOffset = 0; // Offset to position stamp below the "Notes" text line

    // Fallback default constants when anchor pattern cannot be verified
    private const int DefaultVisLLX = 428;
    private const int DefaultVisLLY = 218;
    private const int DefaultVisURX = 482;
    private const int DefaultVisURY = 272;
    private const int DefaultPageNumber = 1;

    /// <summary>
    /// Extracts the "Notes" keyword position from a PDF stream and calculates
    /// the e-Meterai stamp bounding box coordinates.
    /// </summary>
    /// <param name="pdfStream">Stream containing the PDF document</param>
    /// <returns>Tuple containing (visLLX, visLLY, visURX, visURY, stampPageNumber) or null if anchor not found</returns>
    public async Task<(int visLLX, int visLLY, int visURX, int visURY, int stampPageNumber)?> ExtractStampCoordinatesAsync(Stream pdfStream)
    {
        // Reset stream position to beginning
        pdfStream.Position = 0;

        return await Task.Run<(int visLLX, int visLLY, int visURX, int visURY, int stampPageNumber)?>(() =>
        {
            using var pdfDocument = PdfDocument.Open(pdfStream);

            // Traverse PDF pages starting from the last page moving backwards
            for (int pageIndex = pdfDocument.NumberOfPages - 1; pageIndex >= 0; pageIndex--)
            {
                var page = pdfDocument.GetPage(pageIndex + 1);

                // Get all words from the page
                var words = page.GetWords();

                // Search for the "Notes" keyword
                foreach (var word in words)
                {
                    if (string.Equals(word.Text.Trim(), "Notes", StringComparison.OrdinalIgnoreCase))
                    {
                        // When "Notes" text box is located, calculate coordinates

                        // 1. Lock Horizontal Target (X-Axis)
                        int visURX = HardcodedVisURX;

                        // 2. Calculate Vertical Target (Y-Axis)
                        // Use the bottom position of the keyword box to position stamp slightly below
                        double notesY = word.BoundingBox.Bottom;

                        // Apply vertical offset to clear any overlap
                        int visURY = (int)notesY - VerticalOffset;

                        // Ensure visURY is not negative
                        if (visURY < 0)
                        {
                            visURY = DefaultVisURY;
                        }

                        // 3. Derive Remaining Dimensions
                        // Calculate lower-left markers relative to upper-right benchmarks
                        // to maintain uniform 54x54 point bounding box
                        int visLLX = visURX - StampSize;
                        int visLLY = visURY - StampSize;

                        // Return calculated coordinates with 1-based page number
                        int stampPageNumber = pageIndex + 1;

                        return (visLLX, visLLY, visURX, visURY, stampPageNumber);
                    }
                }
            }

            // Anchor pattern not found - return null to signal fallback to defaults
            return null;
        });
    }

    /// <summary>
    /// Returns the fallback default coordinates when text scanning cannot verify the anchor pattern.
    /// </summary>
    /// <returns>Default bounding box coordinates</returns>
    public (int visLLX, int visLLY, int visURX, int visURY, int stampPageNumber) GetDefaultCoordinates()
    {
        return (DefaultVisLLX, DefaultVisLLY, DefaultVisURX, DefaultVisURY, DefaultPageNumber);
    }
}
