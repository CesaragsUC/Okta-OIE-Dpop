import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AccessToken, OktaAuth } from '@okta/okta-auth-js';
import { BaseAuthService } from 'src/app/common/classes/baseauth.service';
import { DPoPService } from 'src/app/common/classes/dpop.service';

@Injectable({
  providedIn: 'root'
})
export class OidcSinglePageAppDPopPkceBackEndAccessTokenAuthService extends BaseAuthService {
  constructor(router: Router,private dPopService: DPoPService) {
    super(router);
    this.oktaAuth = new OktaAuth({
      clientId: '0oa11mb3zfpceiSy3698',
      issuer: 'https://integrator-4733926.okta.com/oauth2/default',
      redirectUri: window.location.origin + '/oidc-single-page-app-dpop-pkce-back-end-access-token-callback',
      scopes: ['openid', 'profile', 'email'],
      responseType: ['code'],
      pkce: true,
      dpop: true
    });
    this.loginDetailsText = 'OIDC Single Page App: PKCE with Back-End Access Token + DPoP';
  }

  async handleRedirect(): Promise<void> {
    try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        
        if (!code) {
            throw new Error('No authorization code found in URL');
        }

        const codeVerifier = localStorage.getItem('okta-code-verifier');
        if (!codeVerifier) {
            throw new Error('No code verifier found in local storage');
        }

        const backEndEndpoint = 'http://localhost:30303/api/OidcSinglePageAppPkceAuth/dpop-pkce-token';
        const tokenEndpoint = "https://integrator-4733926.okta.com/oauth2/default/v1/token";

        // ✅ Generate initial DPoP proof (without nonce)
        let dpopProof = await this.dPopService.generateDpopProof(tokenEndpoint, "POST");

        let nonceResponse = await fetch('http://localhost:30303/api/OidcSinglePageAppPkceAuth/dpop-pkce-token', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "DPoP": dpopProof,
            },
            body: JSON.stringify({ 
              code,
              codeVerifier,
              clientId: super.getClientId(),
            }),
            mode: "cors",
        });
        
        let response: any;

        // ✅ Check if Okta requires a nonce
        if (nonceResponse.status === 400) {
                const nonce = await nonceResponse.text();
                console.log("Received nonce from Okta:", nonce);

                // ✅ Generate a new DPoP proof with the nonce
                dpopProof = await this.dPopService.generateDpopProof(tokenEndpoint, "POST", nonce);

                // ✅ Retry the request with the nonce
                response = await fetch(backEndEndpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "DPoP": dpopProof,
                    },
                    body: JSON.stringify({ 
                      code,
                      codeVerifier,
                      clientId: super.getClientId(),
                    }),
                    mode: "cors",
                });
          }

        // ✅ Parse tokens from the final response
        if (!response.ok) {
            throw new Error(`Token request failed: ${await response.text()}`);
        }

        const tokens = await response.json();
        console.log("Received tokens:", JSON.stringify(tokens));

        if (tokens.access_token && tokens.id_token) {
            // ✅ Store DPoP-bound tokens
            this.oktaAuth.tokenManager.setTokens({
                accessToken: {
                    accessToken: tokens.access_token,
                    expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
                    tokenType: 'DPoP',
                    scopes: tokens.scope?.split(' ') || [],
                    claims: undefined,
                    userinfoUrl: '',
                    authorizeUrl: ''
                },
                idToken: {
                    idToken: tokens.id_token,
                    claims: this.oktaAuth.token.decode(tokens.id_token).payload,
                    issuer: '',
                    clientId: '',
                    expiresAt: 0,
                    authorizeUrl: '',
                    scopes: []
                }
            });

            this.router.navigate(['/oidc-single-page-app-dpop-pkce-back-end-access-token-callback']);
        } else {
            throw new Error("Missing tokens in response");
        }

    } catch (error) {
        console.error("Error during DPoP PKCE authentication:", error);
        this.oktaAuth.tokenManager.clear();
        throw error;
    }
}

  async login() {
    const { codeVerifier, codeChallenge } = await this.oktaAuth.token.prepareTokenParams();
    localStorage.setItem('okta-code-verifier', codeVerifier);
    await this.oktaAuth.signInWithRedirect({ codeChallenge });
  }

  async logout() {
    this.oktaAuth.clearDPoPStorage(true);
    // this.dPopService.clearDpopKeyPair();
    await this.oktaAuth.signOut();
  }


  

  getLoginSteps(): string[] {
    return [
      "1️⃣ User clicks 'Login'",
      "🔐 2️⃣ Angular app generates DPoP key pair",
      "3️⃣ Angular app redirects to Okta with PKCE challenge",
      "4️⃣ User logs in via Okta Login Page",
      "5️⃣ Okta redirects back with Authorization Code",
      "🔐 6️⃣ Angular app creates DPoP proof JWT for backend",
      "7️⃣ Angular sends to backend:",
      "   • Authorization Code",
      "   • PKCE verifier",
      "   • DPoP proof JWT",
      "8️⃣ Backend exchanges code for DPoP-bound tokens",
      "9️⃣ Backend returns tokens to Angular app",
      "🔐 🔟 Angular stores DPoP-bound tokens",
      "✅ Authentication complete!"
    ];
  }
}
