import { Component, OnInit, Input, Injector, ComponentRef, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomTableComponent } from '../shared/components/custom-table/custom-table.component';
import { CreateOrganizationMemberComponent } from './create-organization-member/create-organization-member.component';
import { SeeOrganizationMembersComponent } from './see-organization-members/see-organization-members.component';
import { OrganizationMembersService } from './organization-members.service';
import { OrganizationMember } from './types';
import { Paginator } from '../shared/types/api';
import { TableData } from '../shared/components/custom-table/types';
import { ModalComponent } from '../shared/components/modal/modal.component';
import { ModalManagerService } from '../shared/services/modal-manager.service';

export interface Modal {
  component: any;
  injector: Injector;
  id: string;
}

@Component({
  selector: 'app-organization-members',
  imports: [
    CommonModule,
    FormsModule,
    CustomTableComponent,
    SeeOrganizationMembersComponent,
    ModalComponent,
  ],
  templateUrl: './organization-members.component.html',
  styleUrl: './organization-members.component.css',
})
export class OrganizationMembersComponent implements OnInit {
  @Input() orgId!: number;
  members: OrganizationMember[] = [];
  isLoading = false;
  selectedMember: OrganizationMember | null = null;
  paginator: Paginator = {
    limit: 10,
    offset: 0,
    orderBy: 'userId',
    direction: 'ASC',
  };
  totalItems = 0;
  modals: Modal[] = [];

  tableData: TableData<OrganizationMember> = {
    data: [],
    columns: [
      { name: 'userId', label: 'Usuário', width: 200 },
      { name: 'role', label: 'Papel', width: 150 },
      { name: 'active', label: 'Ativo', width: 100 },
      { name: 'firstName', label: 'Nome', width: 150 },
      { name: 'lastName', label: 'Sobrenome', width: 150 },
      { name: 'email', label: 'Email', width: 250 },
    ],
  };

  constructor(
    private membersService: OrganizationMembersService,
    private modalService: ModalManagerService,
    private injector: Injector
  ) {
    this.loadMembers();
    console.log('Organization ID:', this.orgId);
  }

  ngOnInit() {
    this.loadMembers();
    console.log('Organization ID:', this.orgId);
  }

  loadMembers() {
    if (!this.orgId) {
      console.error('Organization ID is required');
      return;
    }

    this.isLoading = true;
    this.membersService.getAllMembers(this.orgId, this.paginator).subscribe({
      next: (response) => {
        console.log('Members loaded:', response);
        this.members = response.itens;
        this.tableData.data = this.members;
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

  openCreateModal() {
    const modalId = 'create-member-' + Date.now();
    const injector = Injector.create({
      providers: [
        { provide: 'orgId', useValue: this.orgId },
        {
          provide: 'closeCallback',
          useValue: () => this.closeModal({ id: modalId } as Modal),
        },
      ],
      parent: this.injector,
    });

    const modal: Modal = {
      component: CreateOrganizationMemberComponent,
      injector: injector,
      id: modalId,
    };

    this.modals.push(modal);
  }

  closeCreateModal() {
    this.loadMembers();
  }

  openEditModal(member: OrganizationMember) {
    this.selectedMember = member;
    this.openCreateModal(); // Changed to openCreateModal to reuse the same modal logic
  }

  onMemberCreated() {
    this.loadMembers();
  }

  onMemberUpdated() {
    this.loadMembers();
  }

  onSeeMember(memberId: number) {
    const member = this.tableData.data.find((m) => m.userId === memberId);
    if (member) {
      const modalId = 'see-member-' + Date.now();
      const injector = Injector.create({
        providers: [
          { provide: 'member', useValue: member },
          {
            provide: 'closeCallback',
            useValue: () => this.closeModal({ id: modalId } as Modal),
          },
          { provide: 'updateCallback', useValue: () => this.onMemberUpdated() },
        ],
        parent: this.injector,
      });

      const modal: Modal = {
        component: SeeOrganizationMembersComponent,
        injector: injector,
        id: modalId,
      };

      this.modals.push(modal);
    }
  }

  onDeleteMember(index: number) {
    const member = this.members[index];
    // if (member && confirm('Tem certeza que deseja excluir este membro?')) {
    //   this.membersService.deleteMember(member.userId).subscribe({
    //     next: () => {
    //       this.loadMembers();
    //     },
    //     error: (error) => {
    //       console.error('Error deleting member:', error);
    //     }
    //   });
    // }
  }

  onPaginationChange(paginator: Paginator) {
    this.paginator = { ...this.paginator, ...paginator };
    this.loadMembers();
  }

  closeMemberModal() {
    this.selectedMember = null;
    this.loadMembers();
  }

  closeModal(modal: Modal) {
    this.modals = this.modals.filter((m) => m.id !== modal.id);
    this.loadMembers();
  }
}