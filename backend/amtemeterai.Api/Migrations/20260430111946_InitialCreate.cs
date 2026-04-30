using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Customers",
                columns: table => new
                {
                    CustomerID = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CustomerCode = table.Column<string>(type: "text", nullable: false),
                    CustomerName = table.Column<string>(type: "text", nullable: false),
                    CustomerEmail = table.Column<string>(type: "text", nullable: true),
                    CustomerPin = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Customers", x => x.CustomerID);
                });

            migrationBuilder.CreateTable(
                name: "DeliveryHeaders",
                columns: table => new
                {
                    DeliveryID = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CustomerID = table.Column<int>(type: "integer", nullable: false),
                    DeliveryNumber = table.Column<string>(type: "text", nullable: false),
                    DeliveryDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeliveryRemarks = table.Column<string>(type: "text", nullable: true),
                    ReceiverToken = table.Column<Guid>(type: "uuid", nullable: false),
                    ReceiverName = table.Column<string>(type: "text", nullable: true),
                    ReceiverNotes = table.Column<string>(type: "text", nullable: true),
                    Received = table.Column<bool>(type: "boolean", nullable: false),
                    Invoiced = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeliveryHeaders", x => x.DeliveryID);
                    table.ForeignKey(
                        name: "FK_DeliveryHeaders_Customers_CustomerID",
                        column: x => x.CustomerID,
                        principalTable: "Customers",
                        principalColumn: "CustomerID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DeliveryLines",
                columns: table => new
                {
                    DeliveryLineID = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DeliveryID = table.Column<int>(type: "integer", nullable: false),
                    DeliveryHeaderDeliveryID = table.Column<int>(type: "integer", nullable: false),
                    DeliveryLineNumber = table.Column<string>(type: "text", nullable: false),
                    DeliveryItemCode = table.Column<string>(type: "text", nullable: false),
                    DeliveryItemDescription = table.Column<string>(type: "text", nullable: false),
                    SalesQuantity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SalesUOM = table.Column<string>(type: "text", nullable: false),
                    PackQuantity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PackUOM = table.Column<string>(type: "text", nullable: false),
                    PackQuantityDelivered = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PackQuantityReturned = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PackQuantityRejected = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeliveryLines", x => x.DeliveryLineID);
                    table.ForeignKey(
                        name: "FK_DeliveryLines_DeliveryHeaders_DeliveryHeaderDeliveryID",
                        column: x => x.DeliveryHeaderDeliveryID,
                        principalTable: "DeliveryHeaders",
                        principalColumn: "DeliveryID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Customers_CustomerCode",
                table: "Customers",
                column: "CustomerCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryHeaders_CustomerID",
                table: "DeliveryHeaders",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryHeaders_DeliveryNumber",
                table: "DeliveryHeaders",
                column: "DeliveryNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryLines_DeliveryHeaderDeliveryID",
                table: "DeliveryLines",
                column: "DeliveryHeaderDeliveryID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DeliveryLines");

            migrationBuilder.DropTable(
                name: "DeliveryHeaders");

            migrationBuilder.DropTable(
                name: "Customers");
        }
    }
}
