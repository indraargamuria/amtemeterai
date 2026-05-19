using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class SalesPersonTypeLineComment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Plant",
                table: "DeliveryHeaders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SalesPersonEmail",
                table: "DeliveryHeaders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SalesPersonName",
                table: "DeliveryHeaders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "DeliveryHeaders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Type",
                table: "DeliveryHeaders",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Plant",
                table: "DeliveryHeaders");

            migrationBuilder.DropColumn(
                name: "SalesPersonEmail",
                table: "DeliveryHeaders");

            migrationBuilder.DropColumn(
                name: "SalesPersonName",
                table: "DeliveryHeaders");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "DeliveryHeaders");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "DeliveryHeaders");
        }
    }
}
