using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class ChangeForeignKeyForDeliveryLine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DeliveryLines_DeliveryHeaders_DeliveryHeaderDeliveryID",
                table: "DeliveryLines");

            migrationBuilder.RenameColumn(
                name: "DeliveryHeaderDeliveryID",
                table: "DeliveryLines",
                newName: "DeliveryID");

            migrationBuilder.RenameIndex(
                name: "IX_DeliveryLines_DeliveryHeaderDeliveryID",
                table: "DeliveryLines",
                newName: "IX_DeliveryLines_DeliveryID");

            migrationBuilder.AddForeignKey(
                name: "FK_DeliveryLines_DeliveryHeaders_DeliveryID",
                table: "DeliveryLines",
                column: "DeliveryID",
                principalTable: "DeliveryHeaders",
                principalColumn: "DeliveryID",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DeliveryLines_DeliveryHeaders_DeliveryID",
                table: "DeliveryLines");

            migrationBuilder.RenameColumn(
                name: "DeliveryID",
                table: "DeliveryLines",
                newName: "DeliveryHeaderDeliveryID");

            migrationBuilder.RenameIndex(
                name: "IX_DeliveryLines_DeliveryID",
                table: "DeliveryLines",
                newName: "IX_DeliveryLines_DeliveryHeaderDeliveryID");

            migrationBuilder.AddForeignKey(
                name: "FK_DeliveryLines_DeliveryHeaders_DeliveryHeaderDeliveryID",
                table: "DeliveryLines",
                column: "DeliveryHeaderDeliveryID",
                principalTable: "DeliveryHeaders",
                principalColumn: "DeliveryID",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
