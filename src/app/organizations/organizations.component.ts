import { Component } from '@angular/core';
import { CreateOrganizationComponent } from './create-organization/create-organization.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-organizations',
  imports: [CreateOrganizationComponent, CommonModule],
  templateUrl: './organizations.component.html',
  styleUrl: './organizations.component.css',
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
