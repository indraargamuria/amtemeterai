using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderAndBuyerPO : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Plant",
                table: "DeliveryHeaders",
                type: "character varying(10)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuyerPONumber",
                table: "DeliveryHeaders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OrderNumber",
                table: "DeliveryHeaders",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryHeaders_Plant",
                table: "DeliveryHeaders",
                column: "Plant");

            migrationBuilder.AddForeignKey(
                name: "FK_DeliveryHeaders_Plant_Plant",
                table: "DeliveryHeaders",
                column: "Plant",
                principalTable: "Plant",
                principalColumn: "PlantCode");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DeliveryHeaders_Plant_Plant",
                table: "DeliveryHeaders");

            migrationBuilder.DropIndex(
                name: "IX_DeliveryHeaders_Plant",
                table: "DeliveryHeaders");

            migrationBuilder.DropColumn(
                name: "BuyerPONumber",
                table: "DeliveryHeaders");

            migrationBuilder.DropColumn(
                name: "OrderNumber",
                table: "DeliveryHeaders");

            migrationBuilder.AlterColumn<string>(
                name: "Plant",
                table: "DeliveryHeaders",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(10)",
                oldNullable: true);
        }
    }
}
