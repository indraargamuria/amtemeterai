using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPostGoodsIssueDateToDelivery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PostGoodsIssueDate",
                table: "DeliveryHeaders",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PostGoodsIssueDate",
                table: "DeliveryHeaders");
        }
    }
}
