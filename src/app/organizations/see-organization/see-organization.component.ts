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

@Component({
  selector: 'app-see-organization',
  imports: [
    CommonModule,
    ModalComponent,
    FormsModule,
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

  constructor(
    private organizationsService: OrganizationsService,
    private modalManager: ModalManagerService
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['organization'] && this.organization) {
      this.editableOrganization = { ...this.organization };
      this.originalOrganization = { ...this.organization };
      this.hasChanges = false;
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
}
