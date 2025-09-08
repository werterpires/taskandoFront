import { Routes } from '@angular/router';
import { LogonComponent } from './logon/logon.component';
import { LoginComponent } from './login/login.component';
import { OrganizationsComponent } from './organizations/organizations.component';

export const routes: Routes = [
  {
    path: '',
    component: OrganizationsComponent,
  },
  {
    path: 'logon',
    component: LogonComponent,
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'organizations',
    component: OrganizationsComponent,
  },
];
