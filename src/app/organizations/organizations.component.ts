
import { Component } from '@angular/core';
import { CreateOrganizationComponent } from './create-organization/create-organization.component';

@Component({
  selector: 'app-organizations',
  imports: [CreateOrganizationComponent],
  templateUrl: './organizations.component.html',
  styleUrl: './organizations.component.css'
})
export class OrganizationsComponent {
  showCreateOrganization = false;

  openCreateOrganization() {
    this.showCreateOrganization = true;
  }

  closeCreateOrganization() {
    this.showCreateOrganization = false;
  }
}
