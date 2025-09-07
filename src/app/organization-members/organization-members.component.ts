import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomTableComponent } from '../shared/components/custom-table/custom-table.component';
import { CreateOrganizationMemberComponent } from './create-organization-member/create-organization-member.component';
import { SeeOrganizationMembersComponent } from './see-organization-members/see-organization-members.component';
import { OrganizationMembersService } from './organization-members.service';
import { OrganizationMember } from './types';
import { Paginator } from '../shared/types/api';
import { TableColumn } from '../shared/components/custom-table/types';

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
  styleUrl: './organization-members.component.css'
})
export class OrganizationMembersComponent implements OnInit {
  @Input() orgId!: number;
  members: OrganizationMember[] = [];
  isLoading = false;
  paginator: Paginator = {
    page: 1,
    pageSize: 10,
  };
  totalItems = 0;
  columns: TableColumn[] = [
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Cargo' },
  ];

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
        this.members = response.data;
        this.totalItems = response.total;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading members:', error);
        this.isLoading = false;
      },
    });
  }

  onPageChange(page: number) {
    this.paginator.page = page;
    this.loadMembers();
  }

  onSearch(searchTerm: string) {
    this.membersService.searchMembers(this.orgId, searchTerm, this.paginator).subscribe({
      next: (response) => {
        this.members = response.data;
        this.totalItems = response.total;
      },
      error: (error) => {
        console.error('Error searching members:', error);
      },
    });
  }
}