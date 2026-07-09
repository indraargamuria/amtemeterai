using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCoordinateColumnForInvoiceStamp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "StampPageNumber",
                table: "Invoices",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VisLLX",
                table: "Invoices",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VisLLY",
                table: "Invoices",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VisURX",
                table: "Invoices",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VisURY",
                table: "Invoices",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StampPageNumber",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "VisLLX",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "VisLLY",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "VisURX",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "VisURY",
                table: "Invoices");
        }
    }
}
