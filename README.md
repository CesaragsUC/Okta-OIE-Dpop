# 🔐 Okta OIE Authentication Flows — Developer Guide

This repository demonstrates five OAuth 2.0 / OpenID Connect (OIDC) authentication flows using Okta's Identity Engine (OIE), including **DPoP (Demonstrating Proof of Possession)** token binding.

---

## 📋 Table of Contents

- [What is DPoP?](#what-is-dpop)
- [System Architecture](#system-architecture)
- [Okta Application Setup](#okta-application-setup)
- [Authentication Flows](#authentication-flows)
  - [Flow 1 — PKCE: Front-End Access Token](#flow-1--pkce-front-end-access-token)
  - [Flow 2 — PKCE: Back-End Access Token](#flow-2--pkce-back-end-access-token)
  - [Flow 3 — PKCE + DPoP: Front-End Access Token](#flow-3--pkce--dpop-front-end-access-token)
  - [Flow 4 — PKCE + DPoP: Back-End Access Token](#flow-4--pkce--dpop-back-end-access-token)
  - [Flow 5 — Web Application Back-End Access Token](#flow-5--web-application-back-end-access-token)
- [Token Comparison](#token-comparison)
- [Configuration Reference](#configuration-reference)
- [Local Setup Guide](#local-setup-guide)

---

## What is DPoP?

**DPoP (Demonstrating Proof of Possession)** is an OAuth 2.0 security mechanism defined in [RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449). It binds an access token to a cryptographic key pair owned by the client, making stolen tokens useless to attackers.

> **Analogy:** A regular Bearer token is like a physical key — anyone who finds it can use it. A DPoP token is like a key that only works when paired with its original lock — even if someone copies the key, they cannot use it without the matching private key.

### How DPoP Works

1. The client generates an asymmetric key pair (RSA or EC) — typically via the **WebCrypto API** in the browser.
2. For every token request, the client creates a signed **DPoP Proof JWT** using its private key. This JWT contains:
   - `htm` — HTTP method
   - `htu` — request URL
   - `iat` — issued-at timestamp
   - `jti` — unique identifier (prevents replay attacks)
3. Okta verifies the proof and issues an access token containing a **`cnf.jkt`** claim — a SHA-256 thumbprint of the client's public key.
4. Every API call must include both the access token and a fresh DPoP Proof in the request headers.

### DPoP Request Headers

```
Authorization: DPoP <access_token>
DPoP: <signed_dpop_proof_jwt>
```

### DPoP Access Token Payload (Example)

```json
{
  "sub": "user@example.com",
  "iss": "https://<your-okta-domain>/oauth2/default",
  "cnf": {
    "jkt": "KouKkatheEsxaJGF4wwMZTBiStPq7JRXDnqsEUHl8vc"
  },
  "scp": ["openid", "profile", "email"]
}
```

---

## System Architecture
<img width="1472" height="636" alt="image" src="https://github.com/user-attachments/assets/a266a0a5-0106-455a-849e-bac9145b9537" />


| Component | Technology | Port | Responsibility |
|---|---|---|---|
| **Frontend** | Angular | `4200` | Initiates auth flows, displays tokens, calls backend |
| **Backend** | .NET 8 (ASP.NET Core) | `30303` | Exchanges auth codes, validates DPoP tokens, holds secrets |

---

## Okta Application Setup

Three Okta applications must be configured in the Okta Admin Console. Each serves a different subset of flows.

<img width="1600" height="511" alt="image" src="https://github.com/user-attachments/assets/7dc87437-ccef-42e1-bbba-3ab3b7e71f46" />


### Issuer URL (Authorization Server)

```
https://<your-okta-domain>/oauth2/default
```

### Redirect URIs per App

**App 1 — SPA-PKCE (No DPoP):**
```
http://localhost:4200/oidc-single-page-app-pkce-front-end-access-token-callback
http://localhost:4200/oidc-single-page-app-pkce-back-end-access-token-callback
```

**App 2 — SPA-DPoP:**
```
http://localhost:4200/oidc-single-page-app-dpop-pkce-front-end-access-token-callback
http://localhost:4200/oidc-single-page-app-dpop-pkce-back-end-access-token-callback
```

**App 3 — Web Application:**
```
http://localhost:30303/api/oidcwebapplicationauth/callback
```

> ⚠️ **Security:** The Web Application Client Secret must never be committed to source control. Use `appsettings.Development.json` (excluded via `.gitignore`) or Azure Key Vault for production.

---

## Authentication Flows

---

### Flow 1 — PKCE: Front-End Access Token

**Type:** `SPA` | **DPoP:** No | **Exchange:** Browser

The Angular app handles the entire authentication flow directly with Okta. The access token is obtained and stored in the browser. No backend service is involved in the token exchange.

<img width="1488" height="606" alt="image" src="https://github.com/user-attachments/assets/b25cf3bd-cf86-4ded-9583-fc2b4b530648" />


**Key points:**
- Authorization Code Flow + PKCE (no client secret required)
- Token is stored in the Angular app (in-memory)
- Token type: `Bearer`

**Callback URI:**
```
http://localhost:4200/oidc-single-page-app-pkce-front-end-access-token-callback
```

---

### Flow 2 — PKCE: Back-End Access Token

**Type:** `SPA + Backend` | **DPoP:** No | **Exchange:** .NET Backend

Similar to Flow 1, but the authorization code is forwarded to the **.NET backend**, which performs the token exchange with Okta. The token is returned to Angular.

<img width="1570" height="650" alt="image" src="https://github.com/user-attachments/assets/32640a1f-1d75-4474-861a-95a26e24a123" />


**Key points:**
- Angular sends: `client_id`, `code`, `code_verifier`, `redirect_uri` to `.NET`
- Backend controller: `OidcSinglePageAppPkceAuthController` → `POST /pkce-token`
- Token type: `Bearer`

**Callback URI:**
```
http://localhost:4200/oidc-single-page-app-pkce-back-end-access-token-callback
```

---

### Flow 3 — PKCE + DPoP: Front-End Access Token

**Type:** `SPA` | **DPoP:** ✅ Yes | **Exchange:** Browser

Same as Flow 1, but with **DPoP enabled**. Angular generates a cryptographic key pair via the WebCrypto API and creates a DPoP Proof JWT. The resulting access token is bound to the public key via the `cnf.jkt` claim.

<img width="1432" height="683" alt="image" src="https://github.com/user-attachments/assets/da6c233f-7e78-44dc-9037-1a99bd8429bc" />


**Key points:**
- Angular uses `@okta/okta-auth-js` with `dpop: true`
- Key pair is generated per-session using `SubtleCrypto.generateKey()`
- The DPoP Proof JWT header contains the **JWK (public key)**
- Resulting token has `cnf.jkt` claim (public key thumbprint)
- Okta App must have **DPoP required** enabled

**Callback URI:**
```
http://localhost:4200/oidc-single-page-app-dpop-pkce-front-end-access-token-callback
```

---

### Flow 4 — PKCE + DPoP: Back-End Access Token

**Type:** `SPA + Backend` | **DPoP:** ✅ Yes | **Exchange:** .NET Backend

Combines DPoP security with a backend token exchange. Angular generates the DPoP key pair and proof, then forwards both the authorization code and the DPoP proof to the **.NET backend**, which performs the token exchange with Okta.

<img width="1572" height="728" alt="image" src="https://github.com/user-attachments/assets/c3f3d65a-6490-4cd5-8544-29bc76ff9d25" />


**Key points:**
- **The private key never leaves the browser** — Angular creates the proof, .NET forwards it
- Backend controller: `OidcSinglePageAppPkceAuthController` → `POST /dpop-pkce-token`
- Backend validates the DPoP proof before forwarding to Okta
- If Okta requires a nonce, the backend handles the retry automatically

**Callback URI:**
```
http://localhost:4200/oidc-single-page-app-dpop-pkce-back-end-access-token-callback
```

---

### Flow 5 — Web Application Back-End Access Token

**Type:** `Web App` | **DPoP:** ✅ Yes | **Exchange:** .NET Backend | **Client Secret:** Yes

A traditional **server-side web application flow**. Okta redirects directly to the .NET backend callback URL. The backend holds the Client Secret, generates its own DPoP proof, and performs the full token exchange. The token is stored in an **HttpOnly cookie**.

<img width="1539" height="728" alt="image" src="https://github.com/user-attachments/assets/64cbcc78-0ef5-478c-9ef6-2fb87fc4b82f" />


**Key points:**
- Okta redirects to the **.NET backend** (`/api/oidcwebapplicationauth/callback`), not to Angular
- **Client Secret stays server-side** — Angular never sees it
- DPoP Proof is generated by .NET using an RSA key
- Token is stored in an **HttpOnly + Secure + SameSite=Lax cookie** — inaccessible to JavaScript
- If Okta requires a nonce, the backend retries the token exchange automatically

**Callback URI (Backend):**
```
http://localhost:30303/api/oidcwebapplicationauth/callback
```

---

## Token Comparison

| Flow | Token Type | Has `cnf.jkt` | Where Exchanged | Client Secret | Security Level |
|---|---|---|---|---|---|
| 1 — PKCE Front-End | `Bearer` | ❌ | Browser (Angular) | No | ⭐⭐ Standard |
| 2 — PKCE Back-End | `Bearer` | ❌ | .NET Backend | No | ⭐⭐⭐ Standard+ |
| 3 — DPoP Front-End | `DPoP` | ✅ | Browser (Angular) | No | ⭐⭐⭐⭐ High |
| 4 — DPoP Back-End | `DPoP` | ✅ | .NET Backend | No | ⭐⭐⭐⭐ High |
| 5 — Web App | `DPoP` | ✅ | .NET Backend | Yes | ⭐⭐⭐⭐⭐ Highest |

---

## Configuration Reference

### appsettings.json (.NET Backend)

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "Okta": {
    "Issuer": "https://<your-okta-domain>/oauth2/default",
    "ClientId": "<Web App Client ID>",
    "ClientSecret": "<see appsettings.Development.json>",
    "RedirectUri": "http://localhost:4200/oidc-single-page-app-pkce-back-end-access-token-callback",
    "DPopRedirectUri": "http://localhost:4200/oidc-single-page-app-dpop-pkce-back-end-access-token-callback",
    "CCRedirectUri": "http://localhost:4200/oidc-web-application-back-end-access-token",
    "Scopes": "openid profile email"
  }
}
```

### Angular Service — DPoP Configuration Example

```typescript
const oktaConfig = {
  issuer: 'https://<your-okta-domain>/oauth2/default',
  clientId: '<SPA-DPoP Client ID>',
  redirectUri: window.location.origin + '/oidc-single-page-app-dpop-pkce-front-end-access-token-callback',
  scopes: ['openid', 'profile', 'email'],
  pkce: true,
  dpop: true  // enables DPoP in @okta/okta-auth-js
};
```

### Required Okta Scopes

Ensure the following scopes exist in your Authorization Server (`Security → API → Authorization Servers → default → Scopes`):

| Scope | Description |
|---|---|
| `openid` | Required for OIDC flows |
| `profile` | User profile information |
| `email` | User email address |
| `offline_access` | Refresh token support |

---

## Local Setup Guide

### Prerequisites

- .NET 8 SDK
- Node.js 18+ and Angular CLI (`npm install -g @angular/cli`)
- Access to the Okta Admin Console

### Step 1 — Clone the repository

```bash
git clone <repo-url>
cd Okta-OIE-Spike
```

### Step 2 — Configure the .NET backend secrets

Create `Okta-OIE-Spike-Service/appsettings.Development.json` (excluded from git):

```json
{
  "Okta": {
    "ClientSecret": "<your Web Application client secret from Okta Admin>"
  }
}
```

> ⚠️ **Never commit this file.** Verify it is listed in `.gitignore`.

### Step 3 — Run the .NET backend

```bash
cd Okta-OIE-Spike-Service
dotnet run --launch-profile http
```

The backend starts at **http://localhost:30303**.

### Step 4 — Run the Angular frontend

```bash
cd okta-oie-spike-angular
npm install
ng serve
```

The frontend starts at **http://localhost:4200**.

### Step 5 — Assign your user to Okta apps

In the Okta Admin Console, for each of the three apps:

```
Applications → Applications → [App Name] → Assignments → Assign to People
```

Assign your user account to all three apps.

### Step 6 — Verify all flows

Open `http://localhost:4200` and test each of the five authentication flows.

**Expected result for each flow:**
- ✅ Green **Login Successful** banner
- 🔑 Raw Access Token displayed
- 📋 Decoded JWT Payload displayed
- ✅ **Okta Introspect: Token is valid!** confirmation

**For DPoP flows (3, 4, 5), verify the `cnf.jkt` claim is present in the decoded payload:**

```json
"cnf": {
  "jkt": "<public key thumbprint>"
}
```

---

## Project Structure

```
Okta-OIE-Spike/
├── Okta-OIE-Spike-Service/          # .NET Backend
│   ├── Controllers/
│   │   ├── DPopTokenValidationWithNonceController.cs
│   │   ├── OidcSinglePageAppPkceAuthController.cs
│   │   ├── OidcWebApplicationAuthController.cs
│   │   └── TokenValidationController.cs
│   ├── Services/
│   │   ├── JtiService.cs            # Replay attack prevention
│   │   └── NonceService.cs          # DPoP nonce management
│   ├── Models/
│   │   ├── TokenRequest.cs
│   │   ├── DpoPPkceTokenRequest.cs
│   │   └── IntrospectRequest.cs
│   ├── appsettings.json
│   └── Program.cs
│
└── okta-oie-spike-angular/          # Angular Frontend
    └── src/app/services/
        ├── pkce-front-end-auth.service.ts
        ├── pkce-back-end-auth.service.ts
        ├── dpop-pkce-front-end-auth.service.ts
        ├── dpop-pkce-back-end-auth.service.ts
        └── web-app-auth.service.ts
```

---

# 🏦 Understanding DPoP — A Bank Vault Analogy

Let's use a **bank vault** analogy to make everything click.

---

## The Problem DPoP Solves

Imagine you go to the bank and get a **vault key** (regular Bearer access token).

If someone steals that key on the way out — **game over**. That person opens the vault as if they were you. The bank has no way to tell the difference.

**DPoP solves this:**

> The bank now gives you a key that only works with your **fingerprint**. Even if someone steals the key, without your fingerprint it opens nothing.

That "fingerprint" is the **cryptographic private key** that only exists on your device.

---

## The 3 Characters

| Character | In the real world | In the PoC |
|---|---|---|
| 🏦 **Bank** | Issues and validates identity | **Okta** |
| 📱 **You** | Wants to access the vault | **Angular (browser)** |
| 🏢 **Bank Manager** | Trusted intermediary | **.NET Backend** |

---

## Flow 1 — PKCE without DPoP (the simplest)

> **Analogy:** You go to the bank, prove who you are, get the vault key, and walk away with it in your pocket.

```
You (Angular)           Bank (Okta)
     │                      │
     │── "I want in" ──────►│
     │◄── "Please log in" ──│
     │── Username/Password ─►│
     │◄── Key (token) ──────│
     │
     │ 🔑 Stores the key in pocket (browser)
```

**Risk:** If someone picks your pocket (intercepts the token), they use the key as if they were you.

---

## Flow 2 — PKCE Back-End (manager exchanges the key)

> **Analogy:** You go to the bank, but instead of picking up the key yourself, you hand your **ticket number** to the **manager**. The manager goes to the vault, picks up the key, and hands it to you.

```
You (Angular)      Manager (.NET)       Bank (Okta)
     │                   │                   │
     │── Login ───────────────────────────►│
     │◄── Ticket number ──────────────────│
     │── "Manager, use this ticket" ──────►│
     │                   │── Goes to bank with ticket ──►│
     │                   │◄── Key (token) ───────────────│
     │◄── Key ───────────│                   │
```

**Advantage:** The manager can verify things before handing you the key.

---

## Flow 3 — PKCE + DPoP: Front-End ⭐

> **Analogy:** Before going to the bank, you go to a special machine and **register your fingerprint**. The bank issues a key that only works with that fingerprint. Even if someone steals the key, they need your hand.

```
You (Angular)                      Bank (Okta)
     │                                  │
     ├── 🔑 Generates key pair           │
     │      (public + private)           │
     │      via WebCrypto API            │
     │                                  │
     │── Login ───────────────────────►│
     │◄── Ticket number ───────────────│
     │                                  │
     ├── 📝 Creates "DPoP Proof"         │
     │      Signed with private key:     │
     │      • Which URL it's accessing   │
     │      • Which method (POST/GET)    │
     │      • Timestamp (prevents replay)│
     │      • Unique ID (prevents dupes) │
     │                                  │
     │── Token request ────────────────►│
     │      Authorization: DPoP <proof> │
     │                                  │
     │◄── Token with cnf.jkt ──────────│
     │       (fingerprint embedded       │
     │        inside the token)          │
```

The token now contains:

```json
{
  "cnf": {
    "jkt": "hash_of_your_public_key"
  }
}
```

> If someone steals this token and tries to use it — the server will ask for a DPoP proof signed with the private key. Since the attacker does not have the private key, **access denied**.

---

## Flow 4 — PKCE + DPoP: Back-End (manager + fingerprint)

> **Analogy:** You register your fingerprint and create the proof, but you hand everything to the **manager** to exchange at the bank. The manager does not create the fingerprint — he just presents it to the bank on your behalf.

```
You (Angular)         Manager (.NET)          Bank (Okta)
     │                      │                      │
     ├── Generates keys 🔑   │                      │
     │                      │                      │
     │── Login ──────────────────────────────────►│
     │◄── Ticket number ─────────────────────────│
     │                      │                      │
     ├── Creates DPoP Proof 📝                      │
     │                      │                      │
     │── "Manager, use this" ──►│                  │
     │   ticket + DPoP proof    │                  │
     │                      │── Presents to bank ──►│
     │                      │   (forwards DPoP proof)│
     │                      │◄── DPoP Token ────────│
     │◄── Token ────────────│                      │
```

**Key point:** The private key **never leaves the browser**. The manager only presents the proof, never creates it.

---

## Flow 5 — Web Application (manager does everything)

> **Analogy:** You do not even go to the bank. You tell the manager you want to access the vault. The manager has the **bank master password** (Client Secret), generates his own fingerprint, and handles everything for you. The result comes back in a **sealed envelope** that only you can open (HttpOnly cookie).

```
You (Browser)       Manager (.NET)          Bank (Okta)
     │                    │                      │
     │── "I want in" ─────►│                     │
     │                    │── Redirects to login ──────►│
     │── Login on Okta page ────────────────────────────►│
     │                    │◄── Ticket number (goes to manager!)│
     │                    │                      │
     │                    ├── Manager generates 🔑│
     │                    │   its own DPoP proof  │
     │                    │                      │
     │                    │── POST /token ───────►│
     │                    │   client_id           │
     │                    │   client_secret 🔐    │
     │                    │   DPoP proof          │
     │                    │◄── DPoP Token ────────│
     │                    │                      │
     │                    ├── Stores in 🍪 HttpOnly cookie
     │◄── Cookie ──────────│  (JS cannot access, HTTPS only)
     │
     │ Angular reads the cookie and displays the token
```

**Most secure because:**
- Client Secret stays server-side only
- Token is stored in a cookie unreachable by JavaScript
- Even an XSS attack cannot steal the token

---

## Summary of All 5 Flows

| Flow | DPoP Proof Created By | Token Exchanged By | Token Type | Security |
|---|---|---|---|---|
| 1 — PKCE Front-End | ❌ No DPoP | Angular | `Bearer` | ⭐⭐ |
| 2 — PKCE Back-End | ❌ No DPoP | .NET | `Bearer` | ⭐⭐⭐ |
| 3 — DPoP Front-End | ✅ Angular | Angular | `DPoP` | ⭐⭐⭐⭐ |
| 4 — DPoP Back-End | ✅ Angular | .NET | `DPoP` | ⭐⭐⭐⭐ |
| 5 — Web App | ✅ .NET | .NET | `DPoP` | ⭐⭐⭐⭐⭐ |

---

## The Question That Ties It All Together

> **"If someone intercepts my DPoP token, what happens?"**

The attacker tries to use the token on an API:

```
Authorization: DPoP <stolen_token>
DPoP: <fake_or_missing_proof>
```

The server checks:

1. The token has `cnf.jkt` = hash of the original public key
2. The DPoP proof must be **signed by the corresponding private key**
3. The attacker does not have the private key → **access denied** ✅

---
