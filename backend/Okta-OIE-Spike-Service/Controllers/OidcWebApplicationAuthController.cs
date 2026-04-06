using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

[Route("api/[controller]")]
public class OidcWebApplicationAuthController : Controller
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public OidcWebApplicationAuthController(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    [HttpGet("callback")]
    public async Task<IActionResult> Callback([FromQuery] string code, [FromQuery] string state)
    {
        if (string.IsNullOrEmpty(code))
        {
            return BadRequest("Authorization code is missing.");
        }

        var tokenEndpoint = $"{_configuration["Okta:Issuer"]}/v1/token";

        var form = new Dictionary<string, string>
        {
            { "grant_type", "authorization_code" },
            { "client_id", _configuration["Okta:ClientId"] },
            { "client_secret", _configuration["Okta:ClientSecret"]  },
            { "code", code },
            { "redirect_uri", "http://localhost:30303/api/oidcwebapplicationauth/callback" }
        };

        var request = new HttpRequestMessage(HttpMethod.Post, tokenEndpoint)
        {
            Content = new FormUrlEncodedContent(form)
        };

        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var dpopProof = GenerateDpopProof(tokenEndpoint, "POST", null);
        request.Headers.Add("DPoP", dpopProof);

        var response = await _httpClient.SendAsync(request);

        // Okta may require a nonce in the DPoP proof.
        if (!response.IsSuccessStatusCode &&
            response.Headers.TryGetValues("DPoP-Nonce", out var nonceValues))
        {
            var nonce = nonceValues.FirstOrDefault();

            // Recreate the request — HttpRequestMessage cannot be reused.
            var retryRequest = new HttpRequestMessage(HttpMethod.Post, tokenEndpoint)
            {
                Content = new FormUrlEncodedContent(form)
            };
            retryRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            retryRequest.Headers.Add("DPoP", GenerateDpopProof(tokenEndpoint, "POST", nonce));

            response = await _httpClient.SendAsync(retryRequest);
        }

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            return BadRequest($"Failed to exchange authorization code for access token. Detail: {errorContent}");
        }

        var jsonResponse = await response.Content.ReadAsStringAsync();
        var tokenData = JsonSerializer.Deserialize<OktaTokenResponse>(jsonResponse, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (tokenData == null || string.IsNullOrEmpty(tokenData.AccessToken))
        {
            return BadRequest("Failed to retrieve access token.");
        }

        // Store the access token securely in an HttpOnly session cookie
        Response.Cookies.Append("AccessToken", tokenData.AccessToken, new CookieOptions
        {
            HttpOnly = true, // Does not Prevent JavaScript access (XSS protection)
            Secure = true,   // Ensures HTTPS-only transmission
            SameSite = SameSiteMode.Lax // Prevents CSRF attacks
        });

        Console.WriteLine("http://localhost:4200/oidc-web-application-back-end-access-token");
        return Redirect("http://localhost:4200/oidc-web-application-back-end-access-token");
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("AccessToken");
        return SignOut(new AuthenticationProperties { RedirectUri = "/" },
                       CookieAuthenticationDefaults.AuthenticationScheme,
                       OpenIdConnectDefaults.AuthenticationScheme);
    }

    private static string GenerateDpopProof(string htu, string htm, string? nonce)
    {
        using var rsa = RSA.Create(2048);
        var securityKey = new RsaSecurityKey(rsa);
        var rsaParameters = rsa.ExportParameters(false);

        var jwk = new Dictionary<string, object>
        {
            { "kty", "RSA" },
            { "e", Base64UrlEncoder.Encode(rsaParameters.Exponent) },
            { "n", Base64UrlEncoder.Encode(rsaParameters.Modulus) }
        };

        var header = new JwtHeader(new SigningCredentials(securityKey, SecurityAlgorithms.RsaSha256))
        {
            ["typ"] = "dpop+jwt",
            ["jwk"] = jwk
        };

        var payload = new JwtPayload
        {
            { "jti", Guid.NewGuid().ToString() },
            { "htm", htm },
            { "htu", htu },
            { "iat", DateTimeOffset.UtcNow.ToUnixTimeSeconds() }
        };

        if (!string.IsNullOrEmpty(nonce))
            payload.Add("nonce", nonce);

        var token = new JwtSecurityToken(header, payload);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }


    public class OktaTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string AccessToken { get; set; }

        [JsonPropertyName("token_type")]
        public string TokenType { get; set; }

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }

        [JsonPropertyName("refresh_token")]
        public string RefreshToken { get; set; }

        [JsonPropertyName("scope")]
        public string Scope { get; set; }

        [JsonPropertyName("id_token")]
        public string IdToken { get; set; }
    }
}
