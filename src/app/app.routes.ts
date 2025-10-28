import { Routes } from '@angular/router';
import { LogonComponent } from './logon/logon.component';
import { LoginComponent } from './login/login.component';
import { OrganizationsComponent } from './organizations/organizations.component';
import { DepartmentsComponent } from './departments/departments.component';

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
  {
    path: 'departments',
    component: DepartmentsComponent,
  },
];
