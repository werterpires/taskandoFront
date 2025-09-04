import { Component, OnInit } from '@angular/core';
import { CreateOrganizationComponent } from './create-organization/create-organization.component';
import { SeeOrganizationComponent } from './see-organization/see-organization.component';
import { CommonModule } from '@angular/common';
import { CustomTableComponent } from '../shared/components/custom-table/custom-table.component';
import { TableData } from '../shared/components/custom-table/types';
import { Organization } from './types';
import { OrganizationsService } from './organizations.service';
import { Paginator } from '../shared/types/api';

@Component({
  selector: 'app-organizations',
  imports: [
    CreateOrganizationComponent,
    SeeOrganizationComponent,
    CommonModule,
    CustomTableComponent,
  ],
  templateUrl: './organizations.component.html',
  styleUrl: './organizations.component.css',
})
export class OrganizationsComponent implements OnInit {
  showCreateOrganization = false;
  showSeeOrganization = false;
  selectedOrganization: Organization | null = null;
  organizations: Organization[] = [];
  totalItems = 0;
  loading = false;

  tableData: TableData<Organization> = {
    data: [],
    columns: [
      {
        name: 'name',
        label: 'Nome',
        width: 200,
      },
      {
        name: 'cnpj',
        label: 'CNPJ',
        width: 150,
      },
      {
        name: 'address',
        label: 'Endereço',
        width: 250,
      },
      {
        name: 'phone',
        label: 'Telefone',
        width: 150,
      },
    ],
  };

  constructor(private readonly organizationsService: OrganizationsService) {}

  ngOnInit() {
    this.loadOrganizations({
      limit: 10,
      offset: 0,
      orderBy: 'name',
      direction: 'ASC',
    });
  }

  loadOrganizations(paginator: Paginator) {
    this.loading = true;
    this.organizationsService.getOrganizations(paginator).subscribe({
      next: (response) => {
        this.organizations = response.itens;
        this.totalItems = response.quantity;
        this.tableData.data = response.itens;
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar organizações:', error);
        this.loading = false;
      },
    });
  }

  onPaginationChange(paginator: Paginator) {
    this.loadOrganizations(paginator);
  }

  openCreateOrganization() {
    this.showCreateOrganization = true;
  }

  closeCreateOrganization() {
    this.showCreateOrganization = false;
    // Recarrega a primeira página após criar uma nova organização
    this.loadOrganizations({
      limit: 10,
      offset: 0,
      orderBy: 'name',
      direction: 'ASC',
    });
  }

  closeSeeOrganization() {
    this.showSeeOrganization = false;
    this.selectedOrganization = null;
  }

  onSeeOrganization(index: number) {
    const organization = this.organizations[index];

    this.organizationsService.findOne(organization.orgId).subscribe({
      next: (organizationDetails) => {
        console.log('Detalhes da organização:', organizationDetails);
        this.selectedOrganization = organizationDetails;
        this.showSeeOrganization = true;
      },
      error: (error) => {
        console.error('Erro ao carregar detalhes da organização:', error);
      },
    });
  }

  onDeleteOrganization(index: number) {
    const organization = this.organizations[index];
    console.log('Deletar organização:', organization);
    // Aqui você pode implementar a funcionalidade de deletar organização
  }
}
