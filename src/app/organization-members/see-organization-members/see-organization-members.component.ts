import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  Inject,
  Optional,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrganizationMember, UpdateMemberDto } from '../types';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { OrganizationMembersService } from '../organization-members.service';
import { UserRoleEnum, userRoles } from '../../shared/types/roles.enum';
import { ModalManagerService } from '../../shared/services/modal-manager.service';

@Component({
  selector: 'app-see-organization-members',
  imports: [CommonModule, ModalComponent, FormsModule],
  templateUrl: './see-organization-members.component.html',
  styleUrl: './see-organization-members.component.css',
})
export class SeeOrganizationMembersComponent implements OnChanges {
  @Input() member: OrganizationMember | null = null;
  @Output() closeEmitter = new EventEmitter<void>();
  @Output() updateEmitter = new EventEmitter<void>();

  editableMember: UpdateMemberDto | null = null;
  originalMember: OrganizationMember | null = null;
  hasChanges = false;
  isUpdating = false;
  availableRoles = userRoles;

  constructor(
    private membersService: OrganizationMembersService,
    private modalManager: ModalManagerService,
    @Optional() @Inject('member') private injectedMember?: OrganizationMember,
    @Optional() @Inject('closeCallback') private closeCallback?: () => void,
    @Optional() @Inject('updateCallback') private updateCallback?: () => void
  ) {
    if (this.injectedMember) {
      this.member = this.injectedMember;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['member'] && this.member) {
      this.editableMember = {
        role: this.member.role,
        userId: this.member.userId,
        orgId: this.member.orgId,
        active: this.member.active || true,
      };
      this.originalMember = { ...this.member };
      this.hasChanges = false;
    }
  }

  onFieldChange() {
    if (this.editableMember && this.originalMember) {
      this.hasChanges =
        this.editableMember.role !== this.originalMember.role ||
        this.editableMember.active !== (this.originalMember.active || true);
    }
  }

  saveChanges() {
    if (!this.editableMember || this.isUpdating) {
      return;
    }

    this.isUpdating = true;
    this.membersService.updateMember(this.editableMember).subscribe({
      next: () => {
        console.log('Membro atualizado com sucesso!');
        this.onUpdate();
        this.close();
      },
      error: (error) => {
        console.error('Error updating member:', error);
        this.isUpdating = false;
      },
    });
  }

  cancelChanges() {
    if (this.originalMember) {
      this.editableMember = {
        role: this.originalMember.role,
        userId: this.originalMember.userId,
        orgId: this.originalMember.orgId,
        active: this.originalMember.active || true,
      };
      this.hasChanges = false;
    }
  }

  close() {
    if (this.closeCallback) {
      this.closeCallback();
    } else {
      this.closeEmitter.emit();
    }
  }

  onUpdate() {
    if (this.updateCallback) {
      this.updateCallback();
    } else {
      this.updateEmitter.emit();
    }
  }

  getRoleDescription(role: UserRoleEnum): string {
    const roleObj = this.availableRoles.find((r) => r.name === role);
    return roleObj ? roleObj.description : role;
  }
}