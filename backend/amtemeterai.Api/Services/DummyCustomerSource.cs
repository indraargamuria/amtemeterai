namespace amtemeterai.Api.Services;

public class DummyCustomerSource : ICustomerSource
{
    public Task<List<CustomerDto>> GetCustomersAsync()
    {
        var customers = new List<CustomerDto>
        {
            new() { CustomerCode = "C001", CustomerName = "PT Maju Jaya Abadi", CustomerEmail = "andi.pratama01@gmail.com" },
            new() { CustomerCode = "C002", CustomerName = "PT Sumber Rejeki", CustomerEmail = "siti.nurhaliza02@yahoo.com" },
            new() { CustomerCode = "C003", CustomerName = "PT Nusantara Logistics", CustomerEmail = "budi.santoso03@gmail.com" },
            new() { CustomerCode = "C004", CustomerName = "PT Global Sentosa", CustomerEmail = "rina.angkasa04@gmail.com" },
            new() { CustomerCode = "C005", CustomerName = "PT Mitra Sejahtera", CustomerEmail = "dika.prakoso05@yahoo.com" },
            new() { CustomerCode = "C006", CustomerName = "PT Indo Makmur", CustomerEmail = "maya.sari06@gmail.com" },
            new() { CustomerCode = "C007", CustomerName = "PT Cahaya Abadi", CustomerEmail = "fajar.nugroho07@gmail.com" },
            new() { CustomerCode = "C008", CustomerName = "PT Bintang Timur", CustomerEmail = "dewi.lestari08@yahoo.com" },
            new() { CustomerCode = "C009", CustomerName = "PT Surya Perkasa", CustomerEmail = "rizky.firman09@gmail.com" },
            new() { CustomerCode = "C010", CustomerName = "PT Karya Bersama", CustomerEmail = "nanda.putri10@gmail.com" },
            new() { CustomerCode = "C011", CustomerName = "PT Prima Utama", CustomerEmail = "agus.wibowo11@yahoo.com" },
            new() { CustomerCode = "C012", CustomerName = "PT Andalan Nusantara", CustomerEmail = "putri.amelia12@gmail.com" },
            new() { CustomerCode = "C013", CustomerName = "PT Sukses Selalu", CustomerEmail = "yogi.hartono13@gmail.com" },
            new() { CustomerCode = "C014", CustomerName = "PT Sentosa Makmur", CustomerEmail = "lisa.marlina14@yahoo.com" },
            new() { CustomerCode = "C015", CustomerName = "PT Mega Jaya", CustomerEmail = "reza.kurniawan15@gmail.com" },
            new() { CustomerCode = "C016", CustomerName = "PT Delta Industri", CustomerEmail = "fitri.ananda16@gmail.com" },
            new() { CustomerCode = "C017", CustomerName = "PT Artha Mandiri", CustomerEmail = "irfan.maulana17@gmail.com" },
            new() { CustomerCode = "C018", CustomerName = "PT Lintas Samudra", CustomerEmail = "novita.safira18@gmail.com" },
            new() { CustomerCode = "C019", CustomerName = "PT Tirta Abadi", CustomerEmail = "hanif.ramadhan19@gmail.com" },
            new() { CustomerCode = "C020", CustomerName = "PT Rajawali Nusindo", CustomerEmail = "clara.damayanti20@gmail.com" }
        };

        return Task.FromResult(customers);
    }
}
