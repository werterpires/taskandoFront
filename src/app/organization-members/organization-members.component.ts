import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomTableComponent } from '../shared/components/custom-table/custom-table.component';
import { CreateOrganizationMemberComponent } from './create-organization-member/create-organization-member.component';
import { SeeOrganizationMembersComponent } from './see-organization-members/see-organization-members.component';
import { OrganizationMembersService } from './organization-members.service';
import { OrganizationMember } from './types';
import { Paginator } from '../shared/types/api';
import { TableData } from '../shared/components/custom-table/types';

@Component({
  selector: 'app-organization-members',
  imports: [
    CommonModule,
    FormsModule,
    CustomTableComponent,
    CreateOrganizationMemberComponent,
    SeeOrganizationMembersComponent,
  ],
  templateUrl: './organization-members.component.html',
  styleUrl: './organization-members.component.css',
})
export class OrganizationMembersComponent implements OnInit {
  @Input() orgId!: number;
  members: OrganizationMember[] = [];
  isLoading = false;
  paginator: Paginator = {
    limit: 10,
    offset: 0,
    orderBy: 'userId',
    direction: 'ASC',
  };
  totalItems = 0;

  tableData: TableData<OrganizationMember> = {
    data: [],
    columns: [
      { name: 'userId', label: 'Usuário', width: 200 },
      { name: 'role', label: 'Papel', width: 150 },
      { name: 'active', label: 'Ativo', width: 100 },
      { name: 'firstName', label: 'Nome', width: 150 },
      { name: 'lastName', label: 'Sobrenome', width: 150 },
      { name: 'email', label: 'Email', width: 250 },
    ],
  };

  constructor(private membersService: OrganizationMembersService) {}

  ngOnInit() {
    if (this.orgId) {
      this.loadMembers();
    }
  }

  loadMembers() {
    if (!this.orgId) {
      console.error('Organization ID is required');
      return;
    }

    this.isLoading = true;
    this.membersService.getAllMembers(this.orgId, this.paginator).subscribe({
      next: (response) => {
        this.members = response.itens;
        this.totalItems = response.quantity;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading members:', error);
        this.isLoading = false;
      },
    });
  }

  onPageChange(page: number) {
    this.paginator.offset = (page - 1) * (this.paginator.limit || 10);
    this.loadMembers();
  }

  onSearch(searchTerm: string) {
    // Search functionality not available in current API
    console.log('Search not implemented:', searchTerm);
  }
}
