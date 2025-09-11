import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { CreateInviteDto } from '../types';
import { UserRoleEnum, userRoles } from '../../shared/types/roles.enum';
import { OrganizationMembersService } from '../organization-members.service';

@Component({
  selector: 'app-create-organization-member',
  imports: [CommonModule, FormsModule],
  templateUrl: './create-organization-member.component.html',
  styleUrl: './create-organization-member.component.css',
})
export class CreateOrganizationMemberComponent {
  @Input() orgId!: number;
  @Output() closeEmitter = new EventEmitter<void>();
  @Output() createEmitter = new EventEmitter<void>();

  newMember = {
    email: '',
    role: UserRoleEnum.CONTRIBUTOR,
  };

  isCreating = false;

  constructor(private organizationMembersService: OrganizationMembersService) {}

  createInvite() {
    if (
      this.isCreating ||
      !this.newMember.email ||
      !this.newMember.role ||
      !this.orgId
    ) {
      return;
    }

    this.isCreating = true;
    const inviteDto: CreateInviteDto = {
      email: this.newMember.email,
      role: this.newMember.role,
      orgId: this.orgId,
    };

    this.organizationMembersService.createInvite(inviteDto).subscribe({
      next: () => {
        this.createEmitter.emit();
        this.newMember.email = '';
        this.newMember.role = UserRoleEnum.CONTRIBUTOR;
      },
      error: () => {
        // TODO: Handle error
      },
      complete: () => {
        this.isCreating = false;
      },
    });
  }

  closeModal() {
    this.closeEmitter.emit();
  }
}
