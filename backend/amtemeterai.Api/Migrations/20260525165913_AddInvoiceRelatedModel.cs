using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceRelatedModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Invoices",
                columns: table => new
                {
                    InvoiceID = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    InvoiceNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CustomerNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    InvoiceAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    InvoicedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    DeliveryHeaderId = table.Column<int>(type: "integer", nullable: true),
                    SerialNumber = table.Column<string>(type: "text", nullable: true),
                    StampingStatus = table.Column<int>(type: "integer", nullable: false),
                    StampedDocumentId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Invoices", x => x.InvoiceID);
                    table.ForeignKey(
                        name: "FK_Invoices_DeliveryHeaders_DeliveryHeaderId",
                        column: x => x.DeliveryHeaderId,
                        principalTable: "DeliveryHeaders",
                        principalColumn: "DeliveryID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Invoices_Documents_StampedDocumentId",
                        column: x => x.StampedDocumentId,
                        principalTable: "Documents",
                        principalColumn: "DocumentID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Documents_InvoiceID",
                table: "Documents",
                column: "InvoiceID");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_DeliveryHeaderId",
                table: "Invoices",
                column: "DeliveryHeaderId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_InvoiceNumber",
                table: "Invoices",
                column: "InvoiceNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_StampedDocumentId",
                table: "Invoices",
                column: "StampedDocumentId");

            migrationBuilder.AddForeignKey(
                name: "FK_Documents_Invoices_InvoiceID",
                table: "Documents",
                column: "InvoiceID",
                principalTable: "Invoices",
                principalColumn: "InvoiceID",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Documents_Invoices_InvoiceID",
                table: "Documents");

            migrationBuilder.DropTable(
                name: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Documents_InvoiceID",
                table: "Documents");
        }
    }
}
