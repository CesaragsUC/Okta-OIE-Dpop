import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AccessToken, OktaAuth } from '@okta/okta-auth-js';
import { BaseAuthService } from 'src/app/common/classes/baseauth.service';
import { jwtDecode, JwtPayload } from 'jwt-decode';

export interface AccessTokenClaims extends JwtPayload {
  sub: string;        // User ID
  name: string;       // Full name
  email: string;      // Email address
  iss: string;        // Issuer (Okta domain)
  aud: string;        // Audience (Client ID)
  exp: number;        // Expiration time (Unix timestamp)
  iat: number;        // Issued at time
  scope?: string | string[];     // Scopes assigned to the token
}
@Injectable({
  providedIn: 'root'
})
export class ClientCredentialsBackEndAccessTokenAuthService extends BaseAuthService {
  constructor(router: Router) {
    super(router);
    this.oktaAuth = new OktaAuth({
      clientId: '0oa11mbcefhyvwwop698',
      issuer: 'https://integrator-4733926.okta.com/oauth2/default',
      redirectUri: 'http://localhost:30303/api/oidcwebapplicationauth/callback',
      scopes: ['openid', 'profile', 'email'],
      responseType: ['code'],
      pkce: false
    });
    this.loginDetailsText = 'OIDC Web Application: Back-End Access Token';
  }

  async handleRedirect() {
    try {
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
