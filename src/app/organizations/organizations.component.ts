import { Component, OnInit } from '@angular/core';
import { CreateOrganizationComponent } from './create-organization/create-organization.component';
import { CommonModule } from '@angular/common';
import { CustomTableComponent } from '../shared/components/custom-table/custom-table.component';
import { TableData } from '../shared/components/custom-table/types';
import { Organization } from './types';
import { OrganizationsService } from './organizations.service';

@Component({
  selector: 'app-organizations',
  imports: [CreateOrganizationComponent, CommonModule, CustomTableComponent],
  templateUrl: './organizations.component.html',
  styleUrl: './organizations.component.css',
})
export class OrganizationsComponent implements OnInit {
  showCreateOrganization = false;
  organizations: Organization[] = [];
  
  tableData: TableData<Organization> = {
    data: [],
    columns: [
      {
        name: 'name',
        label: 'Nome',
        width: 30
      },
      {
        name: 'cnpj',
        label: 'CNPJ',
        width: 20
      },
      {
        name: 'address',
        label: 'Endereço',
        width: 30
      },
      {
        name: 'phone',
        label: 'Telefone',
        width: 20
      }
    ]
  };

  constructor(private readonly organizationsService: OrganizationsService) {}

  ngOnInit() {
    this.loadOrganizations();
  }

  loadOrganizations() {
    this.organizationsService.getOrganizations().subscribe({
      next: (organizations) => {
        this.organizations = organizations;
        this.tableData.data = organizations;
      },
      error: (error) => {
        console.error('Erro ao carregar organizações:', error);
      }
    });
  }

  openCreateOrganization() {
    this.showCreateOrganization = true;
  }

  closeCreateOrganization() {
    this.showCreateOrganization = false;
    this.loadOrganizations(); // Recarrega a lista após criar uma nova organização
  }

  onSeeOrganization(index: number) {
    const organization = this.organizations[index];
    console.log('Ver organização:', organization);
    // Aqui você pode implementar a navegação para ver detalhes da organização
  }

  onDeleteOrganization(index: number) {
    const organization = this.organizations[index];
    console.log('Deletar organização:', organization);
    // Aqui você pode implementar a funcionalidade de deletar organização
  }
}
