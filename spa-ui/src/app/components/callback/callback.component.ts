import { Component, OnInit, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import OktaAuth from '@okta/okta-auth-js';
import { AuthServiceSelector } from 'src/app/common/classes/authservice.selector';
import { IAuthService } from 'src/app/common/interfaces/authservice.interface';

@Component({
  selector: 'app-callback',
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.scss']
})
export class CallbackComponent implements OnInit {
  authService: IAuthService;
  loading = true;
  loginSuccess: boolean | null = null;
  accessToken: string | null = null;
  clientId: string | null = null;
  decodedToken: any = null;
  loginSteps: string[] = [];
  authorizationServerUrl!: string;
  oktaLoginUrl!: string;
  redirectUrl!: string;
  oktaAuth: OktaAuth;

  constructor(
    private authServiceSelector: AuthServiceSelector,
    private route: ActivatedRoute,
    private router: Router
  ) {
    console.log(this.route.snapshot.data['authServiceType']);
    this.authService = this.authServiceSelector.getAuthServiceByType(this.route.snapshot.data['authServiceType']);
  }

  async ngOnInit() {
    try {
      this.oktaAuth = this.authService.getOktaAuth();
      this.authorizationServerUrl = this.authService.getIssuer();
      this.oktaLoginUrl = this.authService.getOktaLoginUrl();
      this.redirectUrl = this.authService.getRedirectUri();
      this.loginSteps = this.authService.getLoginSteps();
      await this.authService.handleRedirect();
      this.accessToken = await this.authService.getAccessToken();
      this.clientId = this.authService.getClientId();
      this.decodedToken = this.authService.decodeAccessToken(this.accessToken);
      this.loginSuccess = true;
    } catch (error) {
      this.loginSuccess = false;
    } finally {
      this.loading = false;
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}