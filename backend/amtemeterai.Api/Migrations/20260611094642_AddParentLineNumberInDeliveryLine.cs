using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddParentLineNumberInDeliveryLine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {


            migrationBuilder.AddColumn<string>(
                name: "ParentLineNumber",
                table: "DeliveryLines",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

    }
}
