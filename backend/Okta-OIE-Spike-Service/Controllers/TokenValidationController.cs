using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Okta_OIE_Spike_Service.Models;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

[Route("api/[controller]")]
[ApiController]
public class TokenValidationController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;

    public TokenValidationController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }

    [HttpPost("validate-token")]
    public async Task<IActionResult> ValidateToken([FromBody] IntrospectRequest introspectRequest)
    {
        if (string.IsNullOrEmpty(introspectRequest.Token) || string.IsNullOrEmpty(introspectRequest.ClientId))
        {
            return BadRequest("Token or ClientId is missing");
        }

        var oktaDomain = _configuration["Okta:Issuer"];
        var introspectUrl = $"{oktaDomain}/v1/introspect";

        var requestContent = new StringContent($"token={introspectRequest.Token}&token_type_hint=access_token&client_id={introspectRequest.ClientId}", Encoding.UTF8, "application/x-www-form-urlencoded");

        var requestMessage = new HttpRequestMessage(HttpMethod.Post, introspectUrl)
        {
            Content = requestContent
        };

        var response = await _httpClient.SendAsync(requestMessage);
        var responseContent = await response.Content.ReadAsStringAsync();

        if (response.IsSuccessStatusCode)
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var introspectResponse = JsonSerializer.Deserialize<IntrospectResponse>(responseContent, options);

            if (introspectResponse.Active)
            {
                return Ok(new { message = "Token is valid" });
            }
            else
            {
                return Unauthorized(new { message = "Token is invalid" });
            }
        }
        else
        {
            return Unauthorized(new { message = "Token is invalid" });
        }
    }
}