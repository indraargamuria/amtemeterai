using System.Text.Json.Serialization;
using System.Collections.Generic;

namespace amtemeterai.Api.Dtos; // Changed to root Dtos namespace

public class GoogleGeocodeResponse 
{ 
    public List<GeocodeResult>? Results { get; set; } 
}

public class GeocodeResult 
{ 
    [JsonPropertyName("address_components")] 
    public List<AddressComponent> AddressComponents { get; set; } = new(); 
    
    [JsonPropertyName("formatted_address")] 
    public string? FormattedAddress { get; set; } 
}

public class AddressComponent 
{ 
    [JsonPropertyName("long_name")] 
    public string? LongName { get; set; } 
    public List<string> Types { get; set; } = new(); 
}