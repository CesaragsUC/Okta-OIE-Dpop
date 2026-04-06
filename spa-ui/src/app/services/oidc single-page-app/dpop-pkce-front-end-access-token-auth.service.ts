import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AccessToken, OktaAuth } from '@okta/okta-auth-js';
import { BaseAuthService } from 'src/app/common/classes/baseauth.service';

@Injectable({
  providedIn: 'root'
})
export class OidcSinglePageAppDpopPkceFrontEndAccessTokenAuthService extends BaseAuthService {
  constructor(router: Router) {
    super(router);
    this.oktaAuth = new OktaAuth({
      clientId: '0oa11mb3zfpceiSy3698',
      issuer: 'https://integrator-4733926.okta.com/oauth2/default',
      redirectUri: window.location.origin + '/oidc-single-page-app-dpop-pkce-front-end-access-token-callback',
      scopes: ['openid', 'profile', 'email'],
      responseType: ['code'],
      pkce: true,
      dpop: true
    });
    this.loginDetailsText = 'OIDC Single Page App: PKCE with Front-End Access Token + DPop';
  }

  async handleRedirect() {
    try {
      const { tokens } = await this.oktaAuth.token.parseFromUrl();
      this.oktaAuth.tokenManager.setTokens(tokens);

    } catch (error) {
      console.error('Error during PKCE authentication:', error);
      this.oktaAuth.tokenManager.clear();
      throw error
    }
  }

  async login() {
    await this.oktaAuth.signInWithRedirect();
  }

  async logout() {
    this.oktaAuth.clearDPoPStorage(true);
    await this.oktaAuth.signOut();
  }

  getLoginSteps(): string[] {
    return [
      "1️⃣ User clicks 'Login'",
      "🔐 2️⃣ Angular app generates DPoP key pair (public/private keys)",
      "3️⃣ Angular app redirects to Okta Authorization Server with PKCE challenge",
      "4️⃣ User logs in via Okta Login Page",
      "5️⃣ Okta redirects back to Angular app with Authorization Code",
      "🔐 6️⃣ Angular app creates DPoP proof JWT for token request:",
      "   • Header contains JWK (public key)",
      "   • Payload contains:",
      "     - htm (HTTP method)",
      "     - htu (HTTP URL)",
      "     - iat (issued at timestamp)",
      "     - jti (unique identifier)",
      "🔐 7️⃣ Angular app sends to token endpoint:",
      "   • Authorization Code",
      "   • PKCE verifier",
      "   • DPoP proof JWT",
      "🔐 8️⃣ Okta validates DPoP proof:",
      "   • Verifies proof signature",
      "   • Checks timestamp is recent",
      "   • Validates HTTP method/URL",
      "   • Binds access token to DPoP public key",
      "🔐 9️⃣ Okta returns DPoP-bound access token with:",
      "   • cnf claim containing JWK thumbprint",
      "   • Requires future requests use matching DPoP proof",
      "🔐 🔟 For subsequent API calls:",
      "   • New DPoP proof generated for each request",
      "   • Must be signed with same private key",
      "   • Must include fresh timestamp",
      "   • Must match request method/URL",
      "   • May include server-provided nonce"
    ];
}
}
