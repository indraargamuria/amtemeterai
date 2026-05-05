namespace amtemeterai.Api.Services;

public class DummyCustomerSource : ICustomerSource
{
    public Task<List<CustomerDto>> GetCustomersAsync()
    {
        var customers = new List<CustomerDto>
        {
            new() { CustomerCode = "C001", CustomerName = "PT Maju Jaya Abadis" },
            new() { CustomerCode = "C002", CustomerName = "PT Sumber Rejeki" },
            new() { CustomerCode = "C003", CustomerName = "PT Nusantara Logistics" },
            new() { CustomerCode = "C004", CustomerName = "PT Global Sentosa" },
            new() { CustomerCode = "C005", CustomerName = "PT Mitra Sejahtera" },
            new() { CustomerCode = "C006", CustomerName = "PT Indo Makmur" },
            new() { CustomerCode = "C007", CustomerName = "PT Cahaya Abadi" },
            new() { CustomerCode = "C008", CustomerName = "PT Bintang Timur" },
            new() { CustomerCode = "C009", CustomerName = "PT Surya Perkasa" },
            new() { CustomerCode = "C010", CustomerName = "PT Karya Bersama" },
            new() { CustomerCode = "C011", CustomerName = "PT Prima Utama" },
            new() { CustomerCode = "C012", CustomerName = "PT Andalan Nusantara" },
            new() { CustomerCode = "C013", CustomerName = "PT Sukses Selalu" },
            new() { CustomerCode = "C014", CustomerName = "PT Sentosa Makmur" },
            new() { CustomerCode = "C015", CustomerName = "PT Mega Jaya" },
            new() { CustomerCode = "C016", CustomerName = "PT Delta Industri" },
            new() { CustomerCode = "C017", CustomerName = "PT Artha Mandiri" },
            new() { CustomerCode = "C018", CustomerName = "PT Lintas Samudra" },
            new() { CustomerCode = "C019", CustomerName = "PT Tirta Abadi" },
            new() { CustomerCode = "C020", CustomerName = "PT Rajawali Nusindo" }
        };

        return Task.FromResult(customers);
    }
}
