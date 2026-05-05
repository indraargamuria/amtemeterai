using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Data;
using amtemeterai.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

//2026-04-30 18:30:44 - Arga - Add Db Context
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

//2026-04-30 18:34:15 - Arga - Add Controller
builder.Services.AddControllers();

// 2026-04-30 13:51:08 - Arga - Add Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 2026-05-05 18:31:08 - Arga - Allow CORS Dinamically
var allowedOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins!)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// 2026-05-06 - Customer Source Configuration
var customerSourceType = builder.Configuration["CustomerSource"] ?? "Dummy";

if (customerSourceType == "Dummy")
{
    builder.Services.AddScoped<ICustomerSource, DummyCustomerSource>();
}
else
{
    builder.Services.AddScoped<ICustomerSource, ErpCustomerSource>();
}

builder.Services.AddScoped<CustomerService>();

var app = builder.Build();

app.UseHttpsRedirection();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

// app.MapGet("/weatherforecast", () =>
// {
//     var forecast =  Enumerable.Range(1, 5).Select(index =>
//         new WeatherForecast
//         (
//             DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
//             Random.Shared.Next(-20, 55),
//             summaries[Random.Shared.Next(summaries.Length)]
//         ))
//         .ToArray();
//     return forecast;
// })
// .WithName("GetWeatherForecast");

//2026-04-30 13:51:36 - Arga - Add Swagger
app.UseSwagger();
app.UseSwaggerUI();


app.UseCors("AllowFrontend");

app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider
        .GetRequiredService<AppDbContext>();

    db.Database.Migrate();
}
app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
