import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AccessToken, OktaAuth } from '@okta/okta-auth-js';
import { BaseAuthService } from 'src/app/common/classes/baseauth.service';

@Injectable({
  providedIn: 'root'
})
export class OidcSinglePageAppPkceFrontEndAccessTokenAuthService extends BaseAuthService {
  constructor(router: Router) {
    super(router);
    this.oktaAuth = new OktaAuth({
      clientId: '0oa11mb8gxwnBhuYu698',
      issuer: 'https://integrator-4733926.okta.com/oauth2/default',
      redirectUri: window.location.origin + '/oidc-single-page-app-pkce-front-end-access-token-callback',
      scopes: ['openid', 'profile', 'email'],
      responseType: ['code'],
      pkce: true
    });
    this.loginDetailsText = 'OIDC Single Page App: PKCE with Front-End Access Token';
  }

   
  async handleRedirect() {
    try {
      const { tokens } = await this.oktaAuth.token.parseFromUrl();
      this.oktaAuth.tokenManager.setTokens(tokens);
    } catch (error) {
      console.error('Error during PKCE authentication:', error);  
      this.oktaAuth.tokenManager.clear();
      throw error;
    }
  }

  async login() {
    await this.oktaAuth.signInWithRedirect();
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
      "6️⃣ Angular app exchanges Authorization Code to Okta for an Access Token.",
      "7️⃣ Access Token is stored and used for API calls.",
      "✅ Authentication completed!"
    ];
  }
}
