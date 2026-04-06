import { Component, Input, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import OktaAuth from '@okta/okta-auth-js';
import { DPoPService } from 'src/app/common/classes/dpop.service';

@Component({
  selector: 'app-token-validator',
  templateUrl: './token-validator.component.html',
  styleUrls: ['./token-validator.component.scss']
})
export class TokenValidatorComponent implements OnInit {
  @Input() accessToken: string;
  @Input() clientId: string;
  @Input() oktaAuth: OktaAuth;
  dPopProof: string;
  validationStatus: string;
  currentNonce?: string;
  isValidating: boolean;

  constructor(private http: HttpClient, private dPopService: DPoPService) {}

  ngOnInit(): void {
    this.validateToken();
    console.log(this.oktaAuth.options.dpop);
  }

  validateToken(): void {
    if(!this.isValidating){
      this.isValidating = true;
      if(this.oktaAuth.options.dpop === true) { 
        this.validateDPopTokenWithNonce();
      }
      else{
      const body = { token: this.accessToken, clientId: this.clientId };
      this.http.post('http://localhost:30303/api/tokenvalidation/validate-token', body)
        .subscribe(
          response => {
            this.validationStatus = '✅Okta Introspect: Token is valid!';
          },
          error => {
            this.validationStatus = '❌Okta Introspect: Token is invalid!';
          }
        );
        this.isValidating = false;
      }
    }
  
  }

  async validateDPopTokenWithNonce(): Promise<any> {
    try {
        const endpoint = `http://localhost:30303/api/DPopTokenValidationWithNonce/validate`;
        const accessToken = await this.oktaAuth.getAccessToken();
        
        try{
          // Create DPoP-bound request with JWK and nonce
          const oktaDPopProof = await this.oktaAuth.getDPoPAuthorizationHeaders({
              url: endpoint,
              method: 'GET',
              nonce: this.currentNonce // Include current nonce if we have one
          });

          this.dPopProof = oktaDPopProof.Dpop;
        }
        catch(error){
          // Must be the system-generated DpopProof
          this.dPopProof = await this.dPopService.generateDpopProof(endpoint, "GET", this.currentNonce);
        }
              
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `DPoP ${accessToken}`,
                'DPoP': this.dPopProof
            },
            mode: 'cors',
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`DPoP validation failed: ${error}`);
        }

        const result = await response.json();
        // Store new nonce for next request
        if (result.nonce) {
            this.currentNonce = result.nonce;
        }

        this.validationStatus = result.message;

        return result;
    } catch (error) {
        console.error('DPoP validation error:', error);
        this.validationStatus = `❌DPoP validation failed: ${error.message}`;
        throw error;
    } finally {
      this.isValidating = false;
    }
  }
}