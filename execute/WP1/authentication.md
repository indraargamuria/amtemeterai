Overview
Implement a secure authentication and authorization system using ASP.NET Core Identity and JWT Bearer Tokens. This will replace the current mock login page and secure the Backend API endpoints.

Proposed Tech Stack
Backend: Microsoft.AspNetCore.Authentication.JwtBearer.

Storage: Entity Framework Core with IdentityUser (PostgreSQL).  

Frontend: React Context API for auth state management and Axios interceptors for token injection.  

1. Database & Model Changes (Backend)
User Model
Instead of a custom table, we will inherit from IdentityUser to get built-in support for hashed passwords, lockout, and email confirmation.

C#
// Models/ApplicationUser.cs
public class ApplicationUser : IdentityUser 
{
    public string FullName { get; set; }
    // Add any extra profile fields here
}
DbContext Update
Update AppDbContext.cs to inherit from IdentityDbContext<ApplicationUser>.  

2. Authentication Logic (Backend)
JWT Configuration
Add security keys to appsettings.json:

JSON
"Jwt": {
  "Key": "YOUR_SUPER_SECRET_KEY_MIN_32_CHARS",
  "Issuer": "amtemeterai-api",
  "Audience": "amtemeterai-web"
}
Identity & Auth Registration (Program.cs)
C#
builder.Services.AddIdentity<ApplicationUser, IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>();

builder.Services.AddAuthentication(options => {
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options => {
    options.TokenValidationParameters = new TokenValidationParameters {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]))
    };
});
Auth Controller
Create AccountController.cs with the following endpoints:

POST /api/account/register: Create a new user.

POST /api/account/login: Validate credentials and return a JWT.

3. Frontend Implementation (React)
Auth Provider
Create a useAuth hook and AuthProvider to wrap App.tsx.  

TypeScript
// shared/hooks/useAuth.ts
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const login = (jwt) => {
    localStorage.setItem('token', jwt);
    setToken(jwt);
    // decode JWT to set user info
  };

  return <AuthContext.Provider value={{ user, token, login }}>{children}</AuthContext.Provider>;
};
Interceptors
Update your API utility to include the token in every request:

TypeScript
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
4. Security Enforcement
Protecting API Endpoints
Apply the [Authorize] attribute to your existing controllers:  

CustomersController.cs

DeliveriesController.cs (Note: Keep the public {token} endpoints unauthorized for receivers).

Frontend Route Guards
Update App.tsx to wrap protected routes in a ProtectedRoute component that checks for the presence of a valid token.  

Implementation Tasks
[Backend]
[ ] Install Microsoft.AspNetCore.Identity.EntityFrameworkCore.

[ ] Update AppDbContext and run migrations.

[ ] Implement AccountController with JWT generation logic.

[ ] Add [Authorize] to sensitive endpoints.

[Frontend]
[ ] Create AuthContext and AuthProvider.

[ ] Update LoginPage.tsx to call the login API and store the token.

[ ] Implement Axios/Fetch interceptors for the Bearer token.

[ ] Secure the Dashboard and Admin routes using a ProtectedRoute component.

Consistency Checklist
[x] Maintains the current Brand Blue UI for login forms.  

[x] Uses PostgreSQL for storing Identity tables.  

[x] Adheres to the existing Project Structure.