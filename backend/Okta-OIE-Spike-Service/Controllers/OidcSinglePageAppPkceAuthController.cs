using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Okta_OIE_Spike_Service.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;

[Route("api/[controller]")]
[ApiController]
public class OidcSinglePageAppPkceAuthController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly string _tokenEndpoint;

    public OidcSinglePageAppPkceAuthController(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _tokenEndpoint = $"{_configuration["Okta:Issuer"]}/v1/token";
    }

    [HttpPost("pkce-token")]
    public async Task<IActionResult> ExchangeCode([FromBody] TokenRequest request)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();

            var tokenRequest = new Dictionary<string, string>
            { 
                ["client_id"] = request.ClientId,
                ["grant_type"] = "authorization_code",
                ["code"] = request.Code,
                ["code_verifier"] = request.CodeVerifier,
                ["redirect_uri"] = _configuration["Okta:RedirectUri"]
            };

            var content = new FormUrlEncodedContent(tokenRequest);
            var endPoint = _tokenEndpoint;

            var response = await client.PostAsync(endPoint, content);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return BadRequest($"Failed to exchange code for tokens: {errorContent}");
            }

            var tokens = await response.Content.ReadFromJsonAsync<JsonElement>();
            return Ok(tokens);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    [HttpPost("dpop-pkce-token")]
    public async Task<IActionResult> ExchangeCodeForToken([FromBody] DPoPPkceTokenRequest request)
    {

        //TODO: Implement JTI and Nonce tracking.
        try
        {
            var tokenRequest = new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = request.Code,
                ["code_verifier"] = request.CodeVerifier,
                ["client_id"] = request.ClientId,
                ["redirect_uri"] = _configuration["Okta:DPopRedirectUri"]
            };

            // Extract DPoP proof from request headers
            var dpopProof = Request.Headers["DPoP"].FirstOrDefault();
            Console.WriteLine($"Received DPoP JWT: {dpopProof}");

            if (string.IsNullOrEmpty(dpopProof))
            {
                return BadRequest("Missing DPoP proof header");
            }

            // Validate the DPoP proof
            if (!ValidateDpopJwt(dpopProof))
            {
                return BadRequest("Invalid DPoP proof");
            }

            var client = _httpClientFactory.CreateClient();

            var content = new FormUrlEncodedContent(tokenRequest);
            client.DefaultRequestHeaders.Add("DPoP", dpopProof); // ✅ Forward same DPoP proof

            var response = await client.PostAsync(_tokenEndpoint, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            return response.IsSuccessStatusCode
                ? Content(responseContent, "application/json")
                : StatusCode((int)response.StatusCode, response.Headers.GetValues("dpop-nonce").FirstOrDefault());
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error exchanging code for token: {ex.Message}");
        }
    }

    private bool ValidateDpopJwt(string dpopProof)
    {
        if (string.IsNullOrWhiteSpace(dpopProof) || dpopProof.Split('.').Length != 3)
        {
            Console.WriteLine("DPoP JWT is malformed: incorrect format.");
            return false;
        }

        var handler = new JwtSecurityTokenHandler();
        try
        {
            var jwtToken = handler.ReadJwtToken(dpopProof);
            if (jwtToken == null)
            {
                Console.WriteLine("Failed to parse DPoP JWT.");
                return false;
            }

            if (!jwtToken.Header.ContainsKey("jwk"))
            {
                Console.WriteLine("DPoP JWT missing 'jwk' in header.");
                return false;
            }

            var jwkJson = jwtToken.Header["jwk"]?.ToString();
            if (string.IsNullOrEmpty(jwkJson))
            {
                Console.WriteLine("JWK key is empty.");
                return false;
            }

            var publicKey = new JsonWebKey(jwkJson);

            var validationParameters = new TokenValidationParameters
            {
                RequireExpirationTime = true,
                RequireSignedTokens = true,
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = publicKey
            };

            handler.ValidateToken(dpopProof, validationParameters, out _);
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"DPoP JWT Validation Failed: {ex.Message}");
            return false;
        }
    }




    public static string GenerateDpopProof(string htu, string htm, string nonce)
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
            { "iat", DateTimeOffset.UtcNow.ToUnixTimeSeconds() },
        };

        // ✅ Only include nonce if it exists
        if (!string.IsNullOrEmpty(nonce))
        {
            payload.Add("nonce", nonce);
        }

        var tokenHandler = new JwtSecurityTokenHandler();
        var securityToken = new JwtSecurityToken(header, payload);

        return tokenHandler.WriteToken(securityToken);
    }

    public async Task<string> FetchDpopNonce(string uri, Dictionary<string, string> tokenRequest)
    {
        // ✅ Generate an initial DPoP proof WITHOUT a nonce
        string dpopProof = GenerateDpopProof(uri, "POST", null);

        var request = new HttpRequestMessage(HttpMethod.Post, uri);
        request.Headers.Add("DPoP", dpopProof); // ✅ Include the DPoP Proof
        request.Headers.Add("Accept", "application/json"); // ✅ Fix Accept header
        request.Content = new FormUrlEncodedContent(tokenRequest);
          request.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/x-www-form-urlencoded");

        var client = _httpClientFactory.CreateClient();

        var response = await client.SendAsync(request);
        var responseContent = await response.Content.ReadAsStringAsync();

        if (response.Headers.Contains("DPoP-Nonce"))
        {
            return response.Headers.GetValues("DPoP-Nonce").FirstOrDefault();
        }

        throw new Exception("DPoP nonce not found in response headers.");
    }

}