using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace amtemeterai.Api.Services;

/// <summary>
/// Implementation of PDF anchor text coordinate extractor using PdfPig library.
/// Searches sequentially for "Notes" keyword first, then "Remarks" if not found, and calculates e-Meterai stamp bounding box coordinates.
/// For "Remarks", the stamp position is adjusted: 2 cm left and 0.5 cm bottom from the "Notes" position.
/// </summary>
public class PdfAnchorService : IPdfAnchorService
{
    // Constants for e-Meterai stamp size and positioning
    private const int StampSize = 54; // 54x54 point bounding box
    private const int HardcodedVisURX = 482; // Lock horizontal target (X-Axis)
    private const int VerticalOffset = 0; // Offset to position stamp below the "Notes" text line

    // Position adjustments for "Remarks" (converted from cm to points: 1 point = 1/72 inch, 1 cm = 28.35 points)
    private const double RemarksCmLeftward = 2.0; // 2 cm leftward
    private const double RemarksCmDownward = 0.5; // 0.5 cm downward
    private const double PointsPerCm = 28.35; // 1 cm = 28.35 points
    private const int RemarksHorizontalOffsetPoints = (int)(RemarksCmLeftward * PointsPerCm); // ~57 points
    private const int RemarksVerticalOffsetPoints = (int)(RemarksCmDownward * PointsPerCm); // ~14 points

    // Fallback default constants when anchor pattern cannot be verified
    private const int DefaultVisLLX = 428;
    private const int DefaultVisLLY = 218;
    private const int DefaultVisURX = 482;
    private const int DefaultVisURY = 272;
    private const int DefaultPageNumber = 1;

    /// <summary>
    /// Extracts the "Notes" or "Remarks" keyword position from a PDF stream and calculates
    /// the e-Meterai stamp bounding box coordinates.
    /// Searches sequentially: first looks for "Notes", if not found, then searches for "Remarks".
    /// For "Remarks", applies position adjustment: 2 cm left and 0.5 cm bottom from "Notes" position.
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

                // First pass: Search for "Notes" keyword
                foreach (var word in words)
                {
                    string trimmedWord = word.Text.Trim();
                    if (string.Equals(trimmedWord, "Notes", StringComparison.OrdinalIgnoreCase))
                    {
                        return CalculateStampCoordinates(word, pageIndex, isRemarks: false);
                    }
                }

                // Second pass: If "Notes" not found, search for "Remarks" keyword
                foreach (var word in words)
                {
                    string trimmedWord = word.Text.Trim();
                    if (string.Equals(trimmedWord, "Remarks", StringComparison.OrdinalIgnoreCase))
                    {
                        return CalculateStampCoordinates(word, pageIndex, isRemarks: true);
                    }
                }
            }

            // Anchor pattern not found - return null to signal fallback to defaults
            return null;
        });
    }

    /// <summary>
    /// Calculates stamp coordinates based on the found anchor word and whether it's "Remarks" or "Notes"
    /// </summary>
    private (int visLLX, int visLLY, int visURX, int visURY, int stampPageNumber) CalculateStampCoordinates(Word anchorWord, int pageIndex, bool isRemarks)
    {
        // 1. Lock Horizontal Target (X-Axis)
        int visURX = HardcodedVisURX;

        // 2. Calculate Vertical Target (Y-Axis)
        // Use the bottom position of the keyword box to position stamp slightly below
        double anchorY = anchorWord.BoundingBox.Bottom;

        // Apply vertical offset to clear any overlap
        int visURY = (int)anchorY - VerticalOffset;

        // For "Remarks", apply position adjustments: 2 cm left and 0.5 cm bottom from Notes position
        if (isRemarks)
        {
            // Move left by 2 cm (57 points) - this means reducing visURX
            visURX -= RemarksHorizontalOffsetPoints;
            // Move down by 0.5 cm (14 points) - this means reducing visURY
            visURY -= RemarksVerticalOffsetPoints;
        }

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

    /// <summary>
    /// Returns the fallback default coordinates when text scanning cannot verify the anchor pattern.
    /// </summary>
    /// <returns>Default bounding box coordinates</returns>
    public (int visLLX, int visLLY, int visURX, int visURY, int stampPageNumber) GetDefaultCoordinates()
    {
        return (DefaultVisLLX, DefaultVisLLY, DefaultVisURX, DefaultVisURY, DefaultPageNumber);
    }
}
