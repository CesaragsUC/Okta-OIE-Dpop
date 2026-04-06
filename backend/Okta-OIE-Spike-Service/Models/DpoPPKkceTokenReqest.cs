namespace Okta_OIE_Spike_Service.Models
{
    public class DPoPPkceTokenRequest
    {
        /// <summary>
        /// The authorization code received from the authorization server.
        /// </summary>
        public string Code { get; set; }

        /// <summary>
        /// The code verifier used in PKCE.
        /// </summary>
        public string CodeVerifier { get; set; }

        /// <summary>
        /// The client ID of the application making the request.
        /// </summary>
        public string ClientId { get; set; }
    }

}
