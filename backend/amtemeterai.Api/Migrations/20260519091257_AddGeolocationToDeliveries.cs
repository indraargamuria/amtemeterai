using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGeolocationToDeliveries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CityRegency",
                table: "DeliveryHeaders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "District",
                table: "DeliveryHeaders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FormattedAddress",
                table: "DeliveryHeaders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "DeliveryHeaders",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "DeliveryHeaders",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Province",
                table: "DeliveryHeaders",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CityRegency",
                table: "DeliveryHeaders");

            migrationBuilder.DropColumn(
                name: "District",
                table: "DeliveryHeaders");

            migrationBuilder.DropColumn(
                name: "FormattedAddress",
                table: "DeliveryHeaders");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "DeliveryHeaders");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "DeliveryHeaders");

            migrationBuilder.DropColumn(
                name: "Province",
                table: "DeliveryHeaders");
        }
    }
}
