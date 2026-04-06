using System.Collections.Concurrent;

namespace Okta_OIE_Spike_Service.Services;
public class NonceService
{
    private readonly ConcurrentDictionary<string, (string Nonce, DateTime Timestamp)> _jwkNonces = new();
    private readonly TimeSpan _nonceLifetime = TimeSpan.FromMinutes(5);

    public (bool isValidNonce, bool isNewJwk, string newNonce) ValidateAndUpdateNonce(string accessToken, string? nonce)
    {
        CleanupExpiredNonces();
        var newNonce = GenerateNonce();
        var isNewJwk = true;

        // Check if we have an existing nonce for this JWK
        if (_jwkNonces.TryGetValue(accessToken, out var existing))
        {
            isNewJwk = false;
            // After first request, nonce is required and must match
            if (string.IsNullOrEmpty(nonce) || nonce != existing.Nonce)
            {
                return (false, isNewJwk, newNonce);
            }
        }

        // Store new nonce for next request
        _jwkNonces[accessToken] = (newNonce, DateTime.UtcNow);
        return (true, isNewJwk, newNonce);
    }

    private string GenerateNonce()
    {
        return Convert.ToBase64String(Guid.NewGuid().ToByteArray());
    }

    private void CleanupExpiredNonces()
    {
        var now = DateTime.UtcNow;
        foreach (var kvp in _jwkNonces)
        {
            if (now - kvp.Value.Timestamp > _nonceLifetime)
            {
                _jwkNonces.TryRemove(kvp.Key, out _);
            }
        }
    }
}