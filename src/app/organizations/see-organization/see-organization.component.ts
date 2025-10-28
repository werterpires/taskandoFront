import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Organization, UpdateOrganizationDto } from '../types';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { OrganizationsService } from '../organizations.service';
import { OrganizationMembersComponent } from '../../organization-members/organization-members.component';
import { ModalManagerService } from '../../shared/services/modal-manager.service';
import { DepartmentsService } from '../../departments/departments.service';
import { CreateDepartmentDto } from '../../departments/types';
import { CreatingFormComponent } from '../../shared/components/creating-form/creating-form.component';
import { CustomInputComponent } from '../../shared/components/custom-input/custom-input.component';
import { CustomTableComponent } from '../../shared/components/custom-table/custom-table.component';
import { TableData } from '../../shared/components/custom-table/types';
import { Paginator, Response } from '../../shared/types/api';

@Component({
  selector: 'app-see-organization',
  imports: [
    CommonModule,
    ModalComponent,
    FormsModule,
    OrganizationMembersComponent,
    CreatingFormComponent,
    CustomInputComponent,
    CustomTableComponent,
  ],
  templateUrl: './see-organization.component.html',
  styleUrl: './see-organization.component.css',
})
export class SeeOrganizationComponent implements OnChanges {
  @Input() organization: Organization | null = null;
  @Output() closeEmitter = new EventEmitter<void>();
  @Output() updateEmitter = new EventEmitter<void>();

  editableOrganization: Organization | null = null;
  originalOrganization: Organization | null = null;
  hasChanges = false;
  isUpdating = false;

  showCreateDepartment = false;
  createDepartmentDto: CreateDepartmentDto = { name: '' };
  isCreatingDepartment = false;

  // Departments table state inside organization view
  departmentsTable: TableData<import('../../departments/types').Department> = {
    data: [],
    columns: [{ name: 'name', label: 'Nome do Departamento', width: 400 }],
  };
  departmentsTotal = 0;
  departmentsLoading = false;

  constructor(
    private organizationsService: OrganizationsService,
    private modalManager: ModalManagerService,
    private departmentsService: DepartmentsService
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['organization'] && this.organization) {
      this.editableOrganization = { ...this.organization };
      this.originalOrganization = { ...this.organization };
      this.hasChanges = false;

      // Initialize table data from current org or fetch first page
      this.departmentsTable.data = this.organization.departments || [];
      this.departmentsTotal = this.departmentsTable.data.length;
      // Optionally load from server for freshest data
      this.loadDepartmentsByOrg({
        limit: 10,
        offset: 0,
        orderBy: 'deptId',
        direction: 'ASC',
      });
    }
  }

  onFieldChange() {
    if (this.editableOrganization && this.originalOrganization) {
      this.hasChanges =
        this.editableOrganization.name !== this.originalOrganization.name ||
        this.editableOrganization.cnpj !== this.originalOrganization.cnpj ||
        this.editableOrganization.address !==
          this.originalOrganization.address ||
        this.editableOrganization.phone !== this.originalOrganization.phone;
    }
  }

  saveChanges() {
    if (!this.editableOrganization || !this.hasChanges) return;

    this.isUpdating = true;

    const updateDto: UpdateOrganizationDto = {
      orgId: this.editableOrganization.orgId,
      name: this.editableOrganization.name,
      cnpj: this.editableOrganization.cnpj || undefined,
      address: this.editableOrganization.address || undefined,
      phone: this.editableOrganization.phone || undefined,
    };

    this.organizationsService.updateOrganization(updateDto).subscribe({
      next: (updatedOrganization) => {
        console.log('Organização atualizada com sucesso:', updatedOrganization);
        this.organization = updatedOrganization;
        this.originalOrganization = { ...updatedOrganization };
        this.editableOrganization = { ...updatedOrganization };
        this.hasChanges = false;
        this.isUpdating = false;
        this.updateEmitter.emit();
      },
      error: (error) => {
        console.error('Erro ao atualizar organização:', error);
        this.isUpdating = false;
      },
    });
  }

  cancelChanges() {
    if (this.originalOrganization) {
      this.editableOrganization = { ...this.originalOrganization };
      this.hasChanges = false;
    }
  }

  close() {
    this.closeEmitter.emit();
  }

  openCreateDepartment() {
    this.showCreateDepartment = true;
    this.createDepartmentDto = { name: '', orgId: this.organization?.orgId };
  }

  closeCreateDepartment() {
    this.showCreateDepartment = false;
    this.createDepartmentDto = { name: '' };
  }

  createDepartment() {
    if (!this.createDepartmentDto.name || !this.organization?.orgId) return;

    this.isCreatingDepartment = true;
    this.createDepartmentDto.orgId = this.organization.orgId;

    this.departmentsService
      .createDepartment(this.createDepartmentDto)
      .subscribe({
        next: () => {
          this.isCreatingDepartment = false;
          this.closeCreateDepartment();
          // Opcional: adicionar feedback de sucesso
          // Refresh departments list
          if (this.organization?.orgId) {
            this.loadDepartmentsByOrg({
              limit: 10,
              offset: 0,
              orderBy: 'deptId',
              direction: 'ASC',
            });
          }
        },
        error: () => {
          this.isCreatingDepartment = false;
        },
      });
  }

  onDepartmentsPagination(paginator: Paginator) {
    this.loadDepartmentsByOrg(paginator);
  }

  private loadDepartmentsByOrg(paginator: Paginator) {
    if (!this.organization?.orgId) return;
    this.departmentsLoading = true;
    this.departmentsService
      .findAllByOrgId(this.organization.orgId, paginator)
      .subscribe({
        next: (
          response: Response<import('../../departments/types').Department>
        ) => {
          const departments = response.itens;
          const total = response.quantity;
          // Update organization's departments and table
          if (this.editableOrganization) {
            this.editableOrganization.departments = departments;
          }
          this.departmentsTable.data = departments;
          this.departmentsTotal = total;
          this.departmentsLoading = false;
        },
        error: () => {
          this.departmentsLoading = false;
        },
      });
  }
}
