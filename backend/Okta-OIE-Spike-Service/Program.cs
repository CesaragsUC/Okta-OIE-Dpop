using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Configuration;
using System.Text;
using Okta_OIE_Spike_Service.Services;

var builder = WebApplication.CreateBuilder(args);

var config = builder.Configuration;
var oktaSettings = config.GetSection("Okta");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = $"{oktaSettings["Issuer"]}";
        options.Audience = "api://default"; // Change if using a custom API audience
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = oktaSettings["Issuer"],
            ValidateAudience = true,
            ValidAudience = "api://default",
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true
        };
    });

builder.Services.AddSingleton<JtiService>();
builder.Services.AddSingleton<NonceService>();
builder.Services.AddHttpClient();
builder.Services.AddAuthorization();
builder.Services.AddControllers();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularDev",
        builder => builder
            .WithOrigins("http://localhost:4200")
            .AllowAnyMethod()
            .AllowAnyHeader());
});

var app = builder.Build();
app.UseCors("AllowAngularDev");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
