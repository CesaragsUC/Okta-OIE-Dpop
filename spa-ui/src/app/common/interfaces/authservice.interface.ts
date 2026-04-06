import OktaAuth from "@okta/okta-auth-js";

export interface IAuthService {
    loginDetailsText: string;
    getOktaAuth(): OktaAuth
    handleRedirect(): Promise<void>;
    getIssuer(): string;
    getClientId(): string;
    getRedirectUri(): string;
    getOktaLoginUrl(): string;
    getLoginSteps(): string[];
    login(): Promise<void>;
    getAccessToken(): Promise<string | null>;
    decodeAccessToken(token: string): any;
    logout(): Promise<void>;
  }