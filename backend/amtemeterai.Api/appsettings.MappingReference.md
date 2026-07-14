# appsettings.json Configuration Mapping Reference

## C# Option Classes → Environment Variables Mapping

This document shows the exact mapping between ASP.NET Core configuration classes and environment variables.

---

### ConnectionStrings

| JSON Path | Environment Variable | C# Usage |
|-----------|-------------------|----------|
| `ConnectionStrings:DefaultConnection` | `ConnectionStrings__DefaultConnection` | DbContext connection string |

**Environment Variable Format:**
```bash
ConnectionStrings__DefaultConnection=Host=postgres;Port=5432;Database=opexdb;Username=postgres;Password=postgres
```

---

### JwtOptions

| JSON Path | Environment Variable | C# Property |
|-----------|-------------------|-------------|
| `Jwt:Key` | `Jwt__Key` | `JwtOptions.Key` |
| `Jwt:Issuer` | `Jwt__Issuer` | `JwtOptions.Issuer` |
| `Jwt:Audience` | `Jwt__Audience` | `JwtOptions.Audience` |

**C# Class Structure:**
```csharp
public class JwtOptions
{
    public string Key { get; set; }
    public string Issuer { get; set; }
    public string Audience { get; set; }
}
```

**Program.cs Registration:**
```csharp
builder.Services.Configure<JwtOptions>(
    builder.Configuration.GetSection("Jwt"));
```

---

### SapOptions

| JSON Path | Environment Variable | C# Property |
|-----------|-------------------|-------------|
| `SapOptions:BaseUrl` | `SapOptions__BaseUrl` | `SapOptions.BaseUrl` |
| `SapOptions:Client` | `SapOptions__Client` | `SapOptions.Client` |
| `SapOptions:Username` | `SapOptions__Username` | `SapOptions.Username` |
| `SapOptions:Password` | `SapOptions__Password` | `SapOptions.Password` |

**C# Class Structure:**
```csharp
public class SapOptions
{
    public string BaseUrl { get; set; }
    public string Client { get; set; }
    public string Username { get; set; }
    public string Password { get; set; }
    public string BasicAuthToken { get; set; } // Auto-generated
}
```

**Program.cs Registration:**
```csharp
builder.Services.Configure<SapOptions>(
    builder.Configuration.GetSection("SapOptions"));
```

---

### PeruriOptions

| JSON Path | Environment Variable | C# Property |
|-----------|-------------------|-------------|
| `Peruri:BackendStg` | `Peruri__BackendStg` | `PeruriOptions.BackendStg` |
| `Peruri:Stampv2Stg` | `Peruri__Stampv2Stg` | `PeruriOptions.Stampv2Stg` |
| `Peruri:InventoryStg` | `Peruri__InventoryStg` | `PeruriOptions.InventoryStg` |
| `Peruri:User` | `Peruri__User` | `PeruriOptions.User` |
| `Peruri:Password` | `Peruri__Password` | `PeruriOptions.Password` |
| `Peruri:KeyStamp` | `Peruri__KeyStamp` | `PeruriOptions.KeyStamp` |
| `Peruri:SharedFolder` | `Peruri__SharedFolder` | `PeruriOptions.SharedFolder` |
| `Peruri:TokenExpiryBufferMinutes` | `Peruri__TokenExpiryBufferMinutes` | `PeruriOptions.TokenExpiryBufferMinutes` |

**C# Class Structure:**
```csharp
public class PeruriOptions
{
    public string BackendStg { get; set; }
    public string Stampv2Stg { get; set; }
    public string InventoryStg { get; set; }
    public string User { get; set; }
    public string Password { get; set; }
    public string KeyStamp { get; set; }
    public string SharedFolder { get; set; }
    public int TokenExpiryBufferMinutes { get; set; }
}
```

**Program.cs Registration:**
```csharp
builder.Services.Configure<PeruriOptions>(
    builder.Configuration.GetSection("Peruri"));
```

---

### MinioOptions

| JSON Path | Environment Variable | C# Property |
|-----------|-------------------|-------------|
| `Minio:Endpoint` | `Minio__Endpoint` | `MinioOptions.Endpoint` |
| `Minio:AccessKey` | `Minio__AccessKey` | `MinioOptions.AccessKey` |
| `Minio:SecretKey` | `Minio__SecretKey` | `MinioOptions.SecretKey` |
| `Minio:BucketName` | `Minio__BucketName` | `MinioOptions.BucketName` |
| `Minio:Secure` | `Minio__Secure` | `MinioOptions.Secure` |

**C# Class Structure:**
```csharp
public class MinioOptions
{
    public string Endpoint { get; set; }
    public string AccessKey { get; set; }
    public string SecretKey { get; set; }
    public string BucketName { get; set; }
    public bool Secure { get; set; }
}
```

**Program.cs Registration:**
```csharp
builder.Services.Configure<MinioOptions>(
    builder.Configuration.GetSection("Minio"));
```

---

### SmtpSettings

| JSON Path | Environment Variable | C# Property |
|-----------|-------------------|-------------|
| `SmtpSettings:Host` | `SmtpSettings__Host` | `SmtpSettings.Host` |
| `SmtpSettings:Port` | `SmtpSettings__Port` | `SmtpSettings.Port` |
| `SmtpSettings:EnableSsl` | `SmtpSettings__EnableSsl` | `SmtpSettings.EnableSsl` |
| `SmtpSettings:Username` | `SmtpSettings__Username` | `SmtpSettings.Username` |
| `SmtpSettings:Password` | `SmtpSettings__Password` | `SmtpSettings.Password` |
| `SmtpSettings:SenderEmail` | `SmtpSettings__SenderEmail` | `SmtpSettings.SenderEmail` |
| `SmtpSettings:SenderName` | `SmtpSettings__SenderName` | `SmtpSettings.SenderName` |

**C# Class Structure:**
```csharp
public class SmtpSettings
{
    public string Host { get; set; }
    public int Port { get; set; }
    public bool EnableSsl { get; set; }
    public string Username { get; set; }
    public string Password { get; set; }
    public string SenderEmail { get; set; }
    public string SenderName { get; set; }
}
```

**Program.cs Registration:**
```csharp
builder.Services.Configure<SmtpSettings>(
    builder.Configuration.GetSection("SmtpSettings"));
```

---

### Cors Configuration

| JSON Path | Environment Variable | Usage |
|-----------|-------------------|-------|
| `Cors:Origins` | `Cors__Origins` | CORS allowed origins array |

**Environment Variable Format (Comma-Separated):**
```bash
Cors__Origins=https://app.opexnow.com,https://admin.opexnow.com
```

**Program.cs Registration:**
```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>())
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});
```

---

## Environment Variable Resolution Order

ASP.NET Core loads configuration in the following order (later overrides earlier):

1. `appsettings.json`
2. `appsettings.{Environment}.json` (e.g., `appsettings.Production.json`)
3. **Environment Variables** (highest priority for production)
4. Command line arguments

---

## Docker Compose Environment Variable Injection

Example docker-compose.yml injection:

```yaml
api:
  environment:
    # Database
    - DB_HOST=postgres
    - DB_PORT=5432
    - DB_NAME=opexdb
    - DB_USER=postgres
    - DB_PASSWORD=${DB_PASSWORD}

    # JWT
    - JWT__KEY=${JWT_SECRET}
    - JWT__ISSUER=${JWT_ISSUER}
    - JWT__AUDIENCE=${JWT_AUDIENCE}

    # SAP
    - SapOptions__BaseUrl=${SAP_BASE_URL}
    - SapOptions__Client=${SAP_CLIENT}
    - SapOptions__Username=${SAP_USERNAME}
    - SapOptions__Password=${SAP_PASSWORD}

    # MinIO
    - Minio__Endpoint=${MINIO_ENDPOINT}
    - Minio__AccessKey=${MINIO_ACCESS_KEY}
    - Minio__SecretKey=${MINIO_SECRET_KEY}
```

---

## Important Notes

1. **Double-underscore notation:** Use `__` for nested section separation in environment variables
2. **Case sensitivity:** Configuration keys are case-insensitive in ASP.NET Core
3. **Array handling:** Use comma-separated values for environment variable arrays
4. **Boolean parsing:** Strings "true"/"false" are automatically converted to bool
5. **Integer parsing:** Numeric strings are automatically converted to int
