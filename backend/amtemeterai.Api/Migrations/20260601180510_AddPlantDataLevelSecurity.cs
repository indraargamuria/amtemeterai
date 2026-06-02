using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace amtemeterai.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPlantDataLevelSecurity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Plant",
                columns: table => new
                {
                    PlantCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    PlantName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Plant", x => x.PlantCode);
                });

            migrationBuilder.CreateTable(
                name: "UserPlant",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    PlantCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPlant", x => new { x.UserId, x.PlantCode });
                    table.ForeignKey(
                        name: "FK_UserPlant_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserPlant_Plant_PlantCode",
                        column: x => x.PlantCode,
                        principalTable: "Plant",
                        principalColumn: "PlantCode",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserPlant_PlantCode",
                table: "UserPlant",
                column: "PlantCode");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserPlant");

            migrationBuilder.DropTable(
                name: "Plant");
        }
    }
}
