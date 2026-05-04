namespace amtemeterai.Api.Dtos
{
    public class DeliveryHeaderDto
    {
        public int DeliveryId { get; set; }
        public string DeliveryNumber { get; set; }
        public DateTime DeliveryDate { get; set; }
        public string? DeliveryRemarks { get; set; }

        public string CustomerCode { get; set; }
        public string CustomerName { get; set; }

        public bool Received { get; set; }
        public bool Invoiced { get; set; }
    }
}