using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class BatchNumberInDeliveryLine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BatchNumber",
                table: "DeliveryLines",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BatchNumber",
                table: "DeliveryLines");
        }
    }
}
