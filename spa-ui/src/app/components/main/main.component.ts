import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthServiceSelector } from 'src/app/common/classes/authservice.selector';
import { IAuthService } from 'src/app/common/interfaces/authservice.interface';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent {
  authService: IAuthService;
  loginDetailsText: string;
  showLoginDetails = false;
  oktaIssuer: string;
  clientId: string;
  redirectUri: string;

  constructor(private router: Router, private authServiceSelector: AuthServiceSelector) {}  

  showLoginDetailsInfo(loginType: string) {
    this.authService = this.authServiceSelector.getAuthServiceByType(loginType);

    this.showLoginDetails = true;
    this.loginDetailsText = this.authService.loginDetailsText;
    this.oktaIssuer = this.authService.getIssuer();
    this.clientId = this.authService.getClientId();
    this.redirectUri = this.authService.getRedirectUri();
  }

  login() {
    this.authService.login();
  }
}
