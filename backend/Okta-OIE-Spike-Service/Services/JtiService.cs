namespace Okta_OIE_Spike_Service.Services;
using System.Collections.Concurrent;

public class JtiService
{
    private readonly ConcurrentDictionary<string, DateTime> _usedJtiValues = new();
    private readonly TimeSpan _jtiLifetime = TimeSpan.FromMinutes(5);

    public bool ValidateAndStoreJti(string jti)
    {
        CleanupExpiredJti();

        if (_usedJtiValues.ContainsKey(jti))
        {
            // ✅ If `jti` has been used before, reject it (replay attack)
            return false;
        }

        // ✅ Store new `jti` with timestamp
        _usedJtiValues[jti] = DateTime.UtcNow;
        return true;
    }

    private void CleanupExpiredJti()
    {
        var now = DateTime.UtcNow;
        foreach (var kvp in _usedJtiValues)
        {
            if (now - kvp.Value > _jtiLifetime)
            {
                _usedJtiValues.TryRemove(kvp.Key, out _);
            }
        }
    }
}
