using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class MovePoAndOrderToDeliveryLine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add new columns to DeliveryLines table
            migrationBuilder.AddColumn<string>(
                name: "OrderNumber",
                table: "DeliveryLines",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuyerPONumber",
                table: "DeliveryLines",
                type: "text",
                nullable: true);

            // Copy data from DeliveryHeaders to DeliveryLines
            // This copies the header-level OrderNumber and BuyerPONumber to all related lines
            migrationBuilder.Sql(@"
                UPDATE ""DeliveryLines"" dl
                SET ""OrderNumber"" = dh.""OrderNumber"",
                    ""BuyerPONumber"" = dh.""BuyerPONumber""
                FROM ""DeliveryHeaders"" dh
                WHERE dl.""DeliveryID"" = dh.""DeliveryID""
            ");

            // Drop columns from DeliveryHeaders table
            migrationBuilder.DropColumn(
                name: "OrderNumber",
                table: "DeliveryHeaders");

            migrationBuilder.DropColumn(
                name: "BuyerPONumber",
                table: "DeliveryHeaders");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Re-add columns to DeliveryHeaders table
            migrationBuilder.AddColumn<string>(
                name: "OrderNumber",
                table: "DeliveryHeaders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuyerPONumber",
                table: "DeliveryHeaders",
                type: "text",
                nullable: true);

            // Note: Data restoration would require copying from lines back to headers
            // but this is a complex operation and may result in data loss if lines had different values

            // Drop columns from DeliveryLines table
            migrationBuilder.DropColumn(
                name: "OrderNumber",
                table: "DeliveryLines");

            migrationBuilder.DropColumn(
                name: "BuyerPONumber",
                table: "DeliveryLines");
        }
    }
}
