import { Routes } from '@angular/router';
import { LogonComponent } from './logon/logon.component';
import { LoginComponent } from './login/login.component';


export const routes: Routes = [
  {
    path: 'logon',
    component: LogonComponent,
  },
  {
    path: 'login',
    component: LoginComponent,
  },
];
