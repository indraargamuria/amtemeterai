namespace amtemeterai.Api.Services;

public class ErpCustomerSource : ICustomerSource
{
    public async Task<List<CustomerDto>> GetCustomersAsync()
    {
        // TODO: Call ERP API later
        // Example: Call external ERP system to fetch customer data
        // var response = await _httpClient.GetAsync("https://erp-api.example.com/customers");
        // var data = await response.Content.ReadAsStringAsync();
        // return JsonSerializer.Deserialize<List<CustomerDto>>(data);

        await Task.Delay(100); // Simulate API call
        return new List<CustomerDto>();
    }
}
