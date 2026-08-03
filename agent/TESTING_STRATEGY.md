# OpexNOW / e-meterai - Testing Strategy

## Overview

This document defines the automated testing strategy, TDD rules, unit testing specifications, and integration coverage requirements for the OpexNOW / e-meterai Integration Layer.

---

## Testing Philosophy

### Core Principles

1. **Test-Driven Development (TDD)**: Write tests before implementing core logic
2. **Comprehensive Coverage**: Achieve >80% code coverage for critical business logic
3. **Fast Feedback**: Unit tests should run in seconds, not minutes
4. **Independent Tests**: No shared state between tests
5. **Clear Intent**: Test names should describe the behavior being tested

---

## Testing Pyramid

```
                ┌──────────────┐
                │   E2E Tests   │  ← 5% (Critical paths only)
                │   (Playwright) │
                ├──────────────┤
                │Integration Tests│ ← 15% (API + Database)
                │  (xUnit/Fixtures)│
                ├──────────────┤
                │  Unit Tests    │  ← 80% (Business logic)
                │  (xUnit/Vitest)│
                └──────────────┘
```

---

## Backend Testing Strategy

### Technology Stack

| Layer | Framework | Purpose |
|-------|-----------|---------|
| Unit Tests | xUnit | Service layer, business logic |
| Integration Tests | xUnit + WebApplicationFactory | API endpoints + database |
| E2E Tests | Playwright (optional) | Critical user flows |

### Unit Testing Rules

#### TDD Workflow (Red-Green-Refactor)

```csharp
// 1. RED: Write failing test
[Fact]
public void CalculateVariancePercent_ShouldReturnCorrectPercentage()
{
    // Arrange
    var line = new DeliveryLine
    {
        PackQuantity = 100,
        PackQuantityDelivered = 95,
        PackQuantityReturned = 0,
        PackQuantityRejected = 0
    };

    // Act
    var result = VarianceCalculator.CalculateVariancePercent(line);

    // Assert
    Assert.Equal(-5.0m, result);
}

// 2. GREEN: Write minimal code to pass test

// 3. REFACTOR: Improve code quality
```

#### Test Naming Convention

```csharp
[Fact]
public void MethodName_StateUnderTest_ExpectedBehavior()
{
    // Example:
    // CalculateVariancePercent_WithShortage_ReturnsNegativePercentage()
    // CreateDelivery_WithValidData_ReturnsDeliveryWithQrCode()
    // StampInvoice_WhenAlreadyStamped_ThrowsInvalidOperationException()
}
```

#### AAA Pattern (Arrange-Act-Assert)

```csharp
[Fact]
public void CreateDelivery_WithValidData_ReturnsDeliveryWithQrCode()
{
    // Arrange
    var service = new DeliveryService(_mockContext, _mockStorage);
    var request = new DeliveryUpsertDto
    {
        CustomerCode = "CUST001",
        DeliveryNumber = "DLV1001",
        // ... other properties
    };

    // Act
    var result = await service.CreateDeliveryAsync(request);

    // Assert
    Assert.NotNull(result);
    Assert.NotEmpty(result.QrCodeBase64);
    Assert.NotEmpty(result.PublicUrl);
}
```

---

### Service Layer Testing

#### CustomerService Tests

```csharp
public class CustomerServiceTests
{
    [Fact]
    public async Task SyncCustomersAsync_WithErpSource_ShouldUpdateDatabase()
    {
        // Arrange
        var mockContext = CreateMockDbContext();
        var mockErpSource = new Mock<IErpCustomerSource>();
        mockErpSource.Setup(s => s.GetCustomersAsync())
            .ReturnsAsync(new List<Customer>
            {
                new() { CustomerCode = "CUST001", CustomerName = "Test Customer" }
            });

        var service = new CustomerService(mockContext, mockErpSource.Object);

        // Act
        var result = await service.SyncCustomersAsync();

        // Assert
        Assert.True(result.Total > 0);
        mockContext.Verify(c => c.Customer.AddRangeAsync(It.IsAny<IEnumerable<Customer>>()), Times.Once);
    }

    [Theory]
    [InlineData("CUST001", true)]
    [InlineData("INVALID", false)]
    public async Task GetByCustomerCodeAsync_WithValidCode_ReturnsCustomer(string code, bool exists)
    {
        // Arrange
        var mockContext = CreateMockDbContext();
        var service = new CustomerService(mockContext);

        // Act
        var result = await service.GetByCustomerCodeAsync(code);

        // Assert
        if (exists)
            Assert.NotNull(result);
        else
            Assert.Null(result);
    }
}
```

#### Invoice Stamping Service Tests

```csharp
public class PeruriOnPremiseStampServiceTests
{
    [Fact]
    public async Task StampInvoiceAsync_WithValidRequest_CompletesStampingFlow()
    {
        // Arrange
        var mockPeruriSession = new Mock<IPeruriSessionService>();
        var mockHttpClient = new Mock<HttpClient>();
        var mockStorage = new Mock<IStorageService>();

        mockPeruriSession.Setup(s => s.GetAuthTokenAsync())
            .ReturnsAsync("valid-jwt-token");

        var service = new PeruriOnPremiseStampService(
            mockPeruriSession.Object,
            mockHttpClient.Object,
            mockStorage.Object,
            _options);

        var request = new PeruriStampRequest
        {
            InvoiceNumber = "INV2025001",
            CustomerName = "Test Customer",
            Amount = 1500000,
            InvoicedDate = DateTime.UtcNow
        };

        // Act
        var result = await service.StampInvoiceAsync(request);

        // Assert
        Assert.NotNull(result.SerialNumber);
        Assert.NotNull(result.StampedPdfUrl);
        Assert.Equal(StampStatus.Success, result.Status);
    }

    [Fact]
    public async Task StampInvoiceAsync_WhenPeruriApiUnavailable_ThrowsException()
    {
        // Arrange
        var mockPeruriSession = new Mock<IPeruriSessionService>();
        mockPeruriSession.Setup(s => s.GetAuthTokenAsync())
            .ThrowsAsync(new HttpRequestException("Peruri API unavailable"));

        var service = new PeruriOnPremiseStampService(
            mockPeruriSession.Object,
            _mockHttpClient.Object,
            _mockStorage.Object,
            _options);

        // Act & Assert
        await Assert.ThrowsAsync<HttpRequestException>(
            () => service.StampInvoiceAsync(CreateValidRequest()));
    }
}
```

---

### Integration Testing Strategy

#### API Endpoint Tests

```csharp
public class DeliveriesControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public DeliveriesControllerTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetDeliveries_WithAuthenticatedUser_ReturnsOkResult()
    {
        // Arrange
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateTestToken());

        // Act
        var response = await _client.GetAsync("/api/deliveries");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        var deliveries = JsonSerializer.Deserialize<List<DeliveryHeaderDto>>(content);
        deliveries.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetDeliveryById_WithWarehouseRole_HidesCustomerData()
    {
        // Arrange
        var warehouseToken = GenerateTestToken(role: "warehouse");
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", warehouseToken);

        // Act
        var response = await _client.GetAsync("/api/deliveries/1");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        var delivery = JsonSerializer.Deserialize<DeliveryResponseDto>(content);

        // Customer data should be hidden for warehouse role
        delivery.CustomerCode.Should().Be("");
        delivery.CustomerName.Should().Be("");
    }
}
```

#### Database Integration Tests

```csharp
public class DatabaseIntegrationTests : IClassFixture<DatabaseFixture>
{
    private readonly AppDbContext _context;

    public DatabaseIntegrationTests(DatabaseFixture fixture)
    {
        _context = fixture.CreateContext();
    }

    [Fact]
    public async Task CreateDelivery_WithValidData_PersistsToDatabase()
    {
        // Arrange
        var delivery = new DeliveryHeader
        {
            DeliveryNumber = "DLV-TEST-001",
            CustomerID = 1,
            DeliveryDate = DateTime.UtcNow,
            Plant = "B1G2"
        };

        // Act
        _context.Delivery.Add(delivery);
        await _context.SaveChangesAsync();

        // Assert
        var saved = await _context.Delivery
            .FirstOrDefaultAsync(d => d.DeliveryNumber == "DLV-TEST-001");

        saved.Should().NotBeNull();
        saved.Plant.Should().Be("B1G2");
    }

    [Fact]
    public async Task PlantAssignment_ShouldFilterDeliveryData()
    {
        // Arrange
        await SeedTestDeliveries();
        var userPlants = new[] { "B1G2", "B1F1" };

        // Act
        var deliveries = await _context.Delivery
            .Where(d => userPlants.Contains(d.Plant))
            .ToListAsync();

        // Assert
        deliveries.Should().OnlyContain(d => userPlants.Contains(d.Plant));
    }
}
```

---

## Frontend Testing Strategy

### Technology Stack

| Layer | Framework | Purpose |
|-------|-----------|---------|
| Unit Tests | Vitest | Component logic, hooks, utils |
| Integration Tests | Vitest + Testing Library | Component interactions |
| E2E Tests | Playwright | Critical user flows |

### Component Testing

#### React Component Tests

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/shared/contexts/AuthContext'
import LoginPage from '@/pages/Login/LoginPage'

describe('LoginPage', () => {
  it('should render login form', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    )

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('should show validation errors for empty fields', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    )

    const submitButton = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
  })

  it('should call login API with correct credentials', async () => {
    const mockLogin = vi.fn().mockResolvedValue({ token: 'test-token' })
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    )

    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'admin@amtemeterai.com' } })
    fireEvent.change(passwordInput, { target: { value: 'Admin@123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@amtemeterai.com', 'Admin@123')
    })
  })
})
```

### Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useApi } from '@/shared/utils/api'

describe('useApi', () => {
  it('should make authenticated API calls', async () => {
    const { result } = renderHook(() => useApi())

    global.localStorage.setItem('auth_token', 'test-token')

    await act(async () => {
      const response = await result.current.get('/api/account/me')
      expect(response.ok).toBe(true)
    })
  })

  it('should logout on 401 response', async () => {
    const { result } = renderHook(() => useApi())

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401
    })

    await act(async () => {
      await result.current.get('/api/account/me')
      expect(global.localStorage.getItem('auth_token')).toBeNull()
    })
  })
})
```

### Utility Function Testing

```typescript
import { describe, it, expect } from 'vitest'
import { decodeJWT, hasRouteAccess, getUserClaims } from '@/shared/utils/routePermissions'

describe('JWT Utilities', () => {
  it('should decode JWT token correctly', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjpbInN5c2FkbWluIl0sInBlcm1pc3Npb24iOlsiZGFzaGJvYXJkOnJlYWQiXX0.signature'

    const decoded = decodeJWT(token)

    expect(decoded.roles).toContain('sysadmin')
    expect(decoded.permissions).toContain('dashboard:read')
  })

  it('should return false for invalid token', () => {
    const invalidToken = 'invalid.token.here'
    const decoded = decodeJWT(invalidToken)
    expect(decoded).toBeNull()
  })

  it('should check route access correctly', () => {
    const claims = {
      roles: ['sysadmin'],
      permissions: ['dashboard:read', 'customer:read']
    }

    expect(hasRouteAccess('/dashboard', claims)).toBe(true)
    expect(hasRouteAccess('/admin/uam', claims)).toBe(true)
    expect(hasRouteAccess('/invoices', claims)).toBe(false)
  })
})
```

---

## End-to-End Testing Strategy

### Critical User Flows

#### E2E Test Scenarios

```typescript
import { test, expect } from '@playwright/test'

test.describe('Delivery Confirmation Flow', () => {
  test('should confirm delivery with photos and GPS', async ({ page }) => {
    // Navigate to public delivery link
    await page.goto('/receive/valid-token-here')

    // Verify PIN
    await page.fill('[name="pin"]', '123456')
    await page.click('button:has-text("Verify")')

    // Wait for delivery form
    await expect(page.locator('h1:has-text("Delivery Confirmation")')).toBeVisible()

    // Fill confirmation form
    await page.fill('[name="receiverName"]', 'John Doe')
    await page.fill('[name="lines[0].delivered"]', '10')
    await page.fill('[name="lines[0].returned"]', '0')
    await page.fill('[name="lines[0].rejected"]', '0')

    // Upload photos
    await page.setInputFiles('[name="newPhotos"]', 'test-photo.jpg')

    // Submit
    await page.click('button:has-text("Post Goods Receipt")')

    // Verify success
    await expect(page.locator('text=Delivery confirmed successfully')).toBeVisible()
  })
})

test.describe('Invoice Stamping Flow', () => {
  test('should stamp invoice successfully', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[name="email"]', 'finance@amtemeterai.com')
    await page.fill('[name="password"]', 'Testing@123')
    await page.click('button:has-text("Sign In")')

    // Navigate to invoices
    await page.click('a:has-text("Invoices")')

    // Click stamp button
    await page.click('button:has-text("Stamp")')

    // Wait for stamping to complete
    await expect(page.locator('text=Stamped successfully')).toBeVisible({ timeout: 30000 })

    // Verify serial number is displayed
    await expect(page.locator('text=EM-')).toBeVisible()
  })
})
```

---

## Coverage Requirements

### Coverage Targets

| Component | Target | Current | Priority |
|-----------|--------|---------|----------|
| Service Layer | 85% | - | P0 |
| Controller Layer | 70% | - | P1 |
| Component Layer | 60% | - | P1 |
| Utility Functions | 90% | - | P0 |
| Integration Tests | 50% | - | P2 |

### Critical Path Coverage

**Must Cover:**
- Authentication & Authorization logic
- Permission-based access control
- Plant-level data filtering
- Invoice calculation logic
- Delivery confirmation flow
- e-Meterai stamping integration
- ERP integration (SAP) endpoints

**May Exclude:**
- Simple DTOs/mappers
- Configuration classes
- Logging statements
- Swagger documentation

---

## Test Data Management

### Database Seeding

```csharp
public class TestDataSeeder
{
    public static async Task SeedForTests(AppDbContext context)
    {
        // Clean existing data
        context.Delivery.RemoveRange(context.Delivery);
        context.Customer.RemoveRange(context.Customer);
        await context.SaveChangesAsync();

        // Seed test customers
        var customers = new List<Customer>
        {
            new() { CustomerCode = "TEST001", CustomerName = "Test Customer 1" },
            new() { CustomerCode = "TEST002", CustomerName = "Test Customer 2" }
        };
        await context.Customer.AddRangeAsync(customers);

        // Seed test deliveries
        var deliveries = new List<DeliveryHeader>
        {
            new()
            {
                DeliveryNumber = "TEST-001",
                CustomerID = 1,
                Plant = "B1G2",
                Status = ReceiverStatus.FullyReceived
            },
            new()
            {
                DeliveryNumber = "TEST-002",
                CustomerID = 2,
                Plant = "B1F1",
                Status = ReceiverStatus.PartialReceived
            }
        };
        await context.Delivery.AddRangeAsync(deliveries);

        await context.SaveChangesAsync();
    }
}
```

---

## Continuous Integration

### Test Execution Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup .NET
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: '8.0.0'
      - name: Run Tests
        run: |
          dotnet test backend/amtemeterai.Api.Tests --collect:"XPlat Code Coverage"
      - name: Upload Coverage
        uses: codecov/codecov-action@v3

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install Dependencies
        run: cd frontend && npm ci
      - name: Run Tests
        run: cd frontend && npm run test
      - name: Upload Coverage
        uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Playwright
        run: cd frontend && npx playwright install
      - name: Run E2E Tests
        run: cd frontend && npm run test:e2e
```

---

## Testing Best Practices

### Do's

1. **Write tests first** (TDD approach)
2. **Keep tests independent** (no shared state)
3. **Use descriptive names** (should read like documentation)
4. **Test behavior, not implementation**
5. **Mock external dependencies** (SAP, Peruri, MinIO)
6. **Use fixtures** for common test data
7. **Clean up after tests** (database rollback)

### Don'ts

1. **Don't test private methods** (test public interface)
2. **Don't add assertions in arrange/act phases**
3. **Don't write flaky tests** (time-dependent, race conditions)
4. **Don't over-mock** (mock only external dependencies)
5. **Don't ignore failing tests** (fix immediately)
6. **Don't test trivial code** (getters, simple DTOs)
7. **Don't duplicate logic in tests** (keep tests simple)

---

## Test Execution Guidelines

### Local Development

```bash
# Backend tests
dotnet test backend/amtemeterai.Api.Tests

# Frontend tests
cd frontend && npm run test

# E2E tests
cd frontend && npm run test:e2e

# With coverage
dotnet test --collect:"XPlat Code Coverage"
npm run test:coverage
```

### Pre-Commit Checklist

- [ ] All unit tests passing
- [ ] New code has test coverage
- [ ] No flaky tests introduced
- [ ] Integration tests updated if API changed
- [ ] E2E tests updated if UI flow changed

---

## Test Documentation

### Test Documentation Requirements

Each test file should include:
- **Purpose statement** (what is being tested)
- **Test scenarios** (what cases are covered)
- **Setup requirements** (fixtures, mocks)
- **Known issues** (flaky tests, limitations)

---

## Future Testing Enhancements

### Planned Improvements

| Enhancement | Priority | Target Date |
|-------------|----------|-------------|
| Increase coverage to 85% | P1 | 2025-02-01 |
| Add performance tests | P2 | 2025-02-15 |
| Implement visual regression tests | P2 | 2025-03-01 |
| Add load testing for SAP integration | P2 | 2025-03-15 |
| Implement contract testing for external APIs | P3 | 2025-04-01 |

---

*This testing strategy is maintained as part of the OpexNOW / e-meterai project documentation and updated regularly.*
