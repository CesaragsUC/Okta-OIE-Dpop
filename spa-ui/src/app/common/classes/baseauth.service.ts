import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import { OktaAuth, AccessToken } from '@okta/okta-auth-js';
import { IAuthService } from '../interfaces/authservice.interface';

export abstract class BaseAuthService implements IAuthService {
  protected oktaAuth!: OktaAuth;
  public loginDetailsText!: string;

  constructor(protected router: Router) {}
    abstract getLoginSteps(): string[];
    abstract login(): Promise<void>;
    abstract logout(): Promise<void>;
    abstract handleRedirect(): Promise<void>;

  decodeAccessToken(token: string): any {
    try {
      const payloadBase64 = token.split('.')[1];
      const decodedJson = atob(payloadBase64);
      return JSON.parse(decodedJson);
    } catch (error) {
      console.error('Error decoding access token:', error);
      return null;
    }
  }

  async getAccessToken(): Promise<string | null> {
    const token = await this.oktaAuth.tokenManager.get('accessToken');
    if (token && typeof token === 'object' && 'accessToken' in token) {
      return (token as AccessToken).accessToken;
    }
    return null;
  }

  getClientId(): string {
    return this.oktaAuth.options.clientId!;
  }

  getOktaAuth(): OktaAuth {
    return this.oktaAuth;
  }

  getIssuer(): string {
    return this.oktaAuth.options.issuer!;
  }

  getOktaLoginUrl(): string {
    return `${this.oktaAuth.options.issuer}/v1/authorize?client_id=${this.getClientId()}`;
  }

  getRedirectUri(): string {
    return this.oktaAuth.options.redirectUri!;
  }
}
