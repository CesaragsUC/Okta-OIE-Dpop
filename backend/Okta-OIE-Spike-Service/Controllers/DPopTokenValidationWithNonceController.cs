
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json.Linq;
using Okta_OIE_Spike_Service.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Okta_OIE_Spike_Service.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DPopTokenValidationWithNonceController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<DPopTokenValidationWithNonceController> _logger;
    private readonly HttpClient _httpClient;
    private readonly NonceService _nonceService;
    private readonly JtiService _jtiService;

    public DPopTokenValidationWithNonceController(IConfiguration configuration, ILogger<DPopTokenValidationWithNonceController> logger, HttpClient httpClient, NonceService nonceService, JtiService jtiService)
    {
        _configuration = configuration;
        _logger = logger;
        _httpClient = httpClient;
        _nonceService = nonceService;
        _jtiService = jtiService;
    }

    [HttpGet("validate")]
    public async Task<IActionResult> ValidateDPoP()
    {
        try
        {
            // 1. Extract headers
            if (!Request.Headers.TryGetValue("DPoP", out var dpopProof) ||
                !Request.Headers.TryGetValue("Authorization", out var authHeader))
            {
                return BadRequest("Missing DPoP or Authorization header");
            }

            Console.WriteLine(dpopProof);

            // 2. Parse Authorization header
            var accessToken = authHeader.ToString().Replace("DPoP ", "");

            // 3. Validate DPoP proof
            var handler = new JwtSecurityTokenHandler();
            var dpopJwt = handler.ReadJwtToken(dpopProof);

            // ✅ Extract `jti` from DPoP JWT
            var jti = dpopJwt.Claims.FirstOrDefault(c => c.Type == "jti")?.Value;
            if (string.IsNullOrEmpty(jti) || !_jtiService.ValidateAndStoreJti(jti))
            {
                return BadRequest("Duplicate JTI detected in request.");
            }

            // 4. Verify DPoP proof claims
            var now = DateTime.UtcNow;
            var dpopClaims = dpopJwt.Claims.ToDictionary(c => c.Type, c => c.Value);

            // Verify HTTP method
            if (dpopClaims["htm"] != HttpContext.Request.Method)
            {
                return BadRequest("Invalid HTTP method in DPoP proof");
            }

            // Verify URL
            var requestUrl = $"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}{HttpContext.Request.Path}";
            if (dpopClaims["htu"] != requestUrl)
            {
                return BadRequest("Invalid URL in DPoP proof");
            }

            // Verify timestamp (typically within a few minutes)
            if (long.TryParse(dpopClaims["iat"], out long issuedAt))
            {
                var issuedAtDateTime = DateTimeOffset.FromUnixTimeSeconds(issuedAt).UtcDateTime;
                if (Math.Abs((now - issuedAtDateTime).TotalMinutes) > 5)
                {
                    return BadRequest("DPoP proof has expired");
                }
            }

            // 5. Verify DPoP proof signature using the JWK in the header
            // Get the JWK from the header and parse it
            var jwkString = dpopJwt.Header["jwk"]?.ToString();
            if (string.IsNullOrEmpty(jwkString))
            {
                return BadRequest("Missing JWK in DPoP proof header");
            }

            // Parse the JWK string into a dictionary
            var jwk = JsonSerializer.Deserialize<Dictionary<string, object>>(jwkString);
            if (jwk == null)
            {
                return BadRequest("Invalid JWK format in DPoP proof header");
            }

            // 6. Validate access token with Okta
            var oktaDomain = _configuration["Okta:Issuer"];
            var introspectionEndpoint = $"{oktaDomain}/v1/introspect";
            var clientId = _configuration["Okta:ClientId"];

            var introspectionRequest = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("token", accessToken),
                new KeyValuePair<string, string>("token_type_hint", "access_token"),
                new KeyValuePair<string, string>("client_id", clientId),
                new KeyValuePair<string, string>("client_secret", _configuration["Okta:ClientSecret"])
            });

            var introspectionResponse = await _httpClient.PostAsync(introspectionEndpoint, introspectionRequest);

            // Log the response for debugging
            var responseContent = await introspectionResponse.Content.ReadAsStringAsync();
            _logger.LogInformation($"Introspection Response: {responseContent}");

            if (!introspectionResponse.IsSuccessStatusCode)
            {
                _logger.LogError($"Introspection failed: {responseContent}");
                return BadRequest($"Failed to validate access token: {introspectionResponse.StatusCode}");
            }
            var introspectionResult = JsonSerializer.Deserialize<TokenIntrospectionResponse>(
                responseContent, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (!introspectionResult.Active)
            {
                return Unauthorized("Invalid or expired access token");
            }

            // 7. Verify DPoP binding
            var cnf = introspectionResult.Cnf?.JktClaim;
            if (string.IsNullOrEmpty(cnf))
            {
                return BadRequest("Access token is not bound to DPoP proof");
            }

            // Compute thumbprint of public key in DPoP proof
            var thumbprint = ComputeJwkThumbprint(jwk);
            if (cnf != thumbprint)
            {
                return BadRequest("DPoP proof key does not match access token binding");
            }

            // Validate nonce using JWK thumbprint
            var nonceClaim = dpopJwt.Claims.FirstOrDefault(c => c.Type == "nonce")?.Value;
            var (isValidNonce, isNewJwk, newNonce) = _nonceService.ValidateAndUpdateNonce(accessToken, nonceClaim);

            if (!isValidNonce)
            {
                return BadRequest("Invalid or missing required nonce");
            }

            return Ok(new
            {
                message = isNewJwk ? $"New Jwk Thumbprint.  Sending first-time nonce. {newNonce}"
                : $"DPoP token validation successful. Next Nonce: {newNonce}",
                nonce = newNonce  // Include new nonce in response
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating DPoP token");
            return StatusCode(500, "Error validating DPoP token");
        }
    }

    private string ComputeJwkThumbprint(Dictionary<string, object> jwk)
    {
        // Implementation of RFC 7638 JWK Thumbprint
        var canonicalJwk = new
        {
            e = jwk["e"],
            kty = jwk["kty"],
            n = jwk["n"]
        };

        var json = System.Text.Json.JsonSerializer.Serialize(canonicalJwk);
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(json));
        return Base64UrlEncoder.Encode(hash);
    }
}

public class TokenIntrospectionResponse
{
    public bool Active { get; set; }
    public string Scope { get; set; }
    public string Username { get; set; }
    public long Exp { get; set; }
    public string Sub { get; set; }
    public DPoPConfirmation Cnf { get; set; }
}

public class DPoPConfirmation
{
    [System.Text.Json.Serialization.JsonPropertyName("jkt")]
    public string JktClaim { get; set; }
}
