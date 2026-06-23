using System;
using System.Text;

namespace amtemeterai.Api.Config;

public class SapOptions
{
    public const string Position = "SapOptions";

    public string BaseUrl { get; set; } = null!;
    public string Client { get; set; } = null!;
    public string Username { get; set; } = null!;
    public string Password { get; set; } = null!;

    public string BasicAuthToken 
    {
        get
        {
            var bytes = Encoding.UTF8.GetBytes($"{Username}:{Password}");
            return Convert.ToBase64String(bytes);
        }
    }
}