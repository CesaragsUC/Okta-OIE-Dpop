import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AccessToken, OktaAuth } from '@okta/okta-auth-js';
import { BaseAuthService } from 'src/app/common/classes/baseauth.service';

@Injectable({
  providedIn: 'root'
})
export class OidcSinglePageAppPkceBackEndAccessTokenAuthService extends BaseAuthService {
  constructor(router: Router) {
    super(router);
    this.oktaAuth = new OktaAuth({
      clientId: '0oa11mb8gxwnBhuYu698',
      issuer: 'https://integrator-4733926.okta.com/oauth2/default',
      redirectUri: window.location.origin + '/oidc-single-page-app-pkce-back-end-access-token-callback',
      scopes: ['openid', 'profile', 'email'],
      responseType: ['code'],
      pkce: true
    });
    this.loginDetailsText = 'OIDC Single Page App: PKCE with Back-End Access Token';
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

      const response = await fetch('http://localhost:30303/api/OidcSinglePageAppPkceAuth/pkce-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          code,
          codeVerifier,
          clientId: super.getClientId(),
        }),
        mode: 'cors',
      });

      const tokens = await response.json();
      
      // Store tokens received from backend
      if (tokens) {
        this.oktaAuth.tokenManager.setTokens({
          accessToken: {
            accessToken: tokens.access_token,
            expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
            tokenType: tokens.token_type,
            scopes: tokens.scope.split(' '),
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

        this.router.navigate(['/oidc-single-page-app-pkce-back-end-access-token-callback']);
      }
    } catch (error) {
      console.error('Error during PKCE authentication:', error);
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
    await this.oktaAuth.signOut();
  }

  getLoginSteps(): string[] {
    return [
      "1️⃣ User clicks 'Login'.",
      `2️⃣ Angular app redirects to Okta Authorization Server: ${this.getIssuer()} with PKCE challenge`,
      `3️⃣ User logs in via Okta Login Page: ${this.getOktaLoginUrl()}`,
      `4️⃣ Okta redirects back to Angular app with an Authorization Code.`,
      `5️⃣ Redirect URI: ${this.getRedirectUri()}`,
      "6️⃣ Angular app sends the client id, authorization code, and pkce code verifier to the backend service at http://localhost:30303/api/OidcSinglePageAppPkceAuth/pkce-token",
      "7️⃣ Backend service exchanges Authorization Code to Okta for an Access Token.",
      "8️⃣ Backend service sends the Access Token back to the Angular app.",
      "9️⃣ Access Token is stored and used for API calls.",
      "✅ Authentication completed!"
    ];
  }
}
