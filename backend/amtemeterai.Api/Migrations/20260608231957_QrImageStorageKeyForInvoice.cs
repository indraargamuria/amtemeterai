using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class QrImageStorageKeyForInvoice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "QrCodeBase64",
                table: "Invoices",
                newName: "QrImageStorageKey");

            migrationBuilder.AddColumn<int>(
                name: "QrImageDocumentId",
                table: "Invoices",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QrImageDocumentId",
                table: "Invoices");

            migrationBuilder.RenameColumn(
                name: "QrImageStorageKey",
                table: "Invoices",
                newName: "QrCodeBase64");
        }
    }
}
