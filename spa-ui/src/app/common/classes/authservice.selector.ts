import { Router } from "@angular/router";
import { OidcSinglePageAppPkceBackEndAccessTokenAuthService } from "src/app/services/oidc single-page-app/pkce-back-end-access-token-auth.service";
import { OidcSinglePageAppPkceFrontEndAccessTokenAuthService } from "src/app/services/oidc single-page-app/pkce-front-end-access-token-auth.service";
import { IAuthService } from "../interfaces/authservice.interface";
import { Injectable } from "@angular/core";
import { OidcSinglePageAppDPopPkceBackEndAccessTokenAuthService } from "src/app/services/oidc single-page-app/dpop-pkce-back-end-access-token-auth.service";
import { OidcSinglePageAppDpopPkceFrontEndAccessTokenAuthService } from "src/app/services/oidc single-page-app/dpop-pkce-front-end-access-token-auth.service";
import { DPoPService } from "./dpop.service";
import { ClientCredentialsBackEndAccessTokenAuthService } from "src/app/services/oidc web-application/client-credentials-back-end-access-token-auth.service";

@Injectable({
  providedIn: 'root'
})
export class AuthServiceSelector {
  private authServiceMap: { [key: string]: () => IAuthService } = {};

  constructor(private router: Router, private dPopService: DPoPService) {
    this.authServiceMap['pkceFrontEndAccessToken'] = () => new OidcSinglePageAppPkceFrontEndAccessTokenAuthService(this.router);
    this.authServiceMap['pkceBackEndAccessToken'] = () => new OidcSinglePageAppPkceBackEndAccessTokenAuthService(this.router);
    this.authServiceMap['dpopPkceBackEndAccessToken'] = () => new OidcSinglePageAppDPopPkceBackEndAccessTokenAuthService(this.router, this.dPopService);
    this.authServiceMap['dpopPkceFrontEndAccessToken'] = () => new OidcSinglePageAppDpopPkceFrontEndAccessTokenAuthService(this.router);
    this.authServiceMap['client-credentials-back-end-access-token'] = () => new ClientCredentialsBackEndAccessTokenAuthService(this.router);
  }

  getAuthServiceByType(authServiceType: string): IAuthService {
    const authServiceFactory = this.authServiceMap[authServiceType];

    if (!authServiceFactory) {
      throw new Error(`Unknown auth service type: ${authServiceType}`);
    }

    return authServiceFactory();
  }
}