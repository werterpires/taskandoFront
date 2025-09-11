import { Component, EventEmitter, Input, Output, QueryList, ViewChildren, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { CreateInviteDto } from '../types';
import { UserRoleEnum, userRoles } from '../../shared/types/roles.enum';
import { OrganizationMembersService } from '../organization-members.service';
import { CreatingFormComponent } from 'src/app/shared/components/creating-form/creating-form.component';
import { CustomInputComponent } from 'src/app/shared/components/custom-input/custom-input.component';
import * as validators from '../../shared/components/custom-input/validators';
import * as masks from '../../shared/components/custom-input/masks';
import { CreateOrganizationMemberDto } from '../types';
import { MessagesService } from 'src/app/shared/components/messages/messages.service';
import { LoaderService } from 'src/app/shared/components/loader/loader.service';


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
    firstName: '',
    lastName: '',
    email: '',
    organizationId: 0,
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
      !this.createOrganizationMemberDto.firstName ||
      !this.createOrganizationMemberDto.lastName ||
      !this.orgId
    ) {
      return;
    }

    this.loaderService.show();
    const inviteDto: CreateOrganizationMemberDto = {
      email: this.createOrganizationMemberDto.email,
      firstName: this.createOrganizationMemberDto.firstName,
      lastName: this.createOrganizationMemberDto.lastName,
      organizationId: this.orgId,
    };

    this.organizationMembersService.createInvite(inviteDto).subscribe({
      next: () => {
        this.messagesService.add('Convite enviado com sucesso!');
        this.createOrganizationMemberDto = {
          firstName: '',
          lastName: '',
          email: '',
          organizationId: 0,
        };
        this.inputs.forEach((input) => input.clear());
      },
      error: (error) => {
        this.messagesService.add('Erro ao enviar convite!');
        console.error('Error creating invite:', error);
      },
      complete: () => {
        this.loaderService.hide();
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