# Task: Fix Peruri Login Response Deserialization in PeruriSessionService

The application currently throws a `System.InvalidOperationException: Peruri authentication response is invalid or missing token` at line 113 of `PeruriSessionService.cs`. 

A manual Postman integration test reveals that the staging endpoint `https://backendservicestg.e-meterai.co.id/api/users/login` returns a multi-layered JSON payload containing a top-level `token` property, as well as a nested structure inside `result.data.login.token`.

Please modify the authentication DTOs and the deserialization logic inside `PeruriSessionService.cs` to accurately map this incoming payload.

---

## 1. Expected JSON Payload Structure
Use this exact JSON response contract to structure or update your C# Response models:

```json
{
    "statusCode": "00",
    "message": "success",
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "result": {
        "data": {
            "login": {
                "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
                "user": {
                    "id": "80e2c987-a21c-4dfe-84ed-249d85698dac",
                    "email": "opex_emet@yopmail.com"
                }
            }
        }
    }
}
2. Code Adjustments Instructions
Step A: Update or Define Response DTOs
Ensure your nested C# classes use proper JsonPropertyName mappings (or match PascalCase properties to camelCase JSON via JsonSerializerOptions).

C#
public class PeruriLoginResponse
{
    [JsonPropertyName("statusCode")]
    public string StatusCode { get; set; } = string.Empty;

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    // Direct access to the token string
    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;

    [JsonPropertyName("result")]
    public PeruriLoginResult? Result { get; set; }
}

public class PeruriLoginResult
{
    [JsonPropertyName("data")]
    public PeruriLoginData? Data { get; set; }
}

public class PeruriLoginData
{
    [JsonPropertyName("login")]
    public PeruriLoginDetails? Login { get; set; }
}

public class PeruriLoginDetails
{
    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;
}
Step B: Refactor RefreshTokenAsync in PeruriSessionService.cs
Navigate to PeruriSessionService.cs around line 113.

Deserialize the response content to the updated PeruriLoginResponse object.

Validate that statusCode == "00" and that the token is present.

Extract the token directly from the root element (responseObject.Token) or the nested path (responseObject.Result?.Data?.Login?.Token) safely to avoid NullReferenceException.

3. Verification Checklist
Ensure the validation logic flags any statusCode other than "00" as an initialization failure.

Ensure code handles missing tokens gracefully without raising unhandled null exceptions before throwing the proper InvalidOperationException.