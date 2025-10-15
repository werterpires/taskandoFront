import {
  Component,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren,
  Inject,
  Optional,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { CreateInviteDto } from '../types';
import { UserRoleEnum, userRoles } from '../../shared/types/roles.enum';
import { OrganizationMembersService } from '../organization-members.service';
import * as validators from '../../shared/components/custom-input/validators';
import * as masks from '../../shared/components/custom-input/masks';
import { CreateOrganizationMemberDto } from '../types';
import { MessagesService } from '../../shared/components/messages/messages.service';
import { LoaderService } from '../../shared/components/loader/loader.service';
import { CustomInputComponent } from '../../shared/components/custom-input/custom-input.component';

@Component({
  selector: 'app-create-organization-member',
  imports: [CommonModule, FormsModule],
  templateUrl: './create-organization-member.component.html',
  styleUrl: './create-organization-member.component.css',
})
export class CreateOrganizationMemberComponent {
  @ViewChildren(CustomInputComponent) inputs!: QueryList<CustomInputComponent>;
  @Output() closeEmitter: EventEmitter<void> = new EventEmitter();
  @Input() orgId!: number;

  validators = validators;
  masks = masks;

  createOrganizationMemberDto: CreateOrganizationMemberDto = {
    email: '',
    orgId: 0,
    role: UserRoleEnum.CONTRIBUTOR,
  };

  constructor(
    private organizationMembersService: OrganizationMembersService,
    private messagesService: MessagesService,
    private loaderService: LoaderService,
    @Optional() @Inject('orgId') private injectedOrgId?: number,
    @Optional() @Inject('closeCallback') private closeCallback?: () => void
  ) {
    if (this.injectedOrgId) {
      this.orgId = this.injectedOrgId;
    }
  }

  createInvite() {
    if (
      !this.createOrganizationMemberDto.email ||
      !this.orgId ||
      !this.createOrganizationMemberDto.role
    ) {
      return;
    }

    this.loaderService.showLoader(true);
    const inviteDto: CreateOrganizationMemberDto = {
      email: this.createOrganizationMemberDto.email,
      role: this.createOrganizationMemberDto.role,
      orgId: this.orgId,
    };

    this.organizationMembersService.createInvite(inviteDto).subscribe({
      next: () => {
        this.messagesService.show({
          description: [
            'Convite enviado com sucesso! O usuário receberá um email com as instruções para acessar a organização.',
          ],
          type: 'success',
          show: true,
          title: 'Sucesso',
        });
        this.createOrganizationMemberDto = {
          email: '',
          orgId: 0,
          role: UserRoleEnum.CONTRIBUTOR,
        };
      },
      error: (error) => {
        this.messagesService.show({
          description: ['Erro ao enviar convite. Tente novamente mais tarde.'],
          type: 'error',
          show: true,
          title: 'Erro',
        });
        console.error('Error creating invite:', error);
      },
      complete: () => {
        this.loaderService.showLoader(false);
      },
    });
  }

  close() {
    if (this.closeCallback) {
      this.closeCallback();
    } else {
      this.closeEmitter.emit();
    }
  }
}
