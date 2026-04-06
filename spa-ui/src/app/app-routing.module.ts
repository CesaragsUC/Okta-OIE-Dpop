import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CallbackComponent } from './components/callback/callback.component';
import { MainComponent } from './components/main/main.component';

const routes: Routes = [
  { path: '', component: MainComponent },
  { path: 'oidc-single-page-app-pkce-front-end-access-token-callback', component: CallbackComponent, data: { authServiceType: 'pkceFrontEndAccessToken' } },
  { path: 'oidc-single-page-app-pkce-back-end-access-token-callback', component: CallbackComponent, data: { authServiceType: 'pkceBackEndAccessToken' } },
  { path: 'oidc-single-page-app-dpop-pkce-front-end-access-token-callback', component: CallbackComponent, data: { authServiceType: 'dpopPkceFrontEndAccessToken' } },
  { path: 'oidc-single-page-app-dpop-pkce-back-end-access-token-callback', component: CallbackComponent, data: { authServiceType: 'dpopPkceBackEndAccessToken' } },
  { path: 'oidc-web-application-back-end-access-token', component: CallbackComponent, data: { authServiceType: 'client-credentials-back-end-access-token' } },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
