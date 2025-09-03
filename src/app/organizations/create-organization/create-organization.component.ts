import { Component, EventEmitter, Output } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CreatingFormComponent } from '../../shared/components/creating-form/creating-form.component';
import { CustomInputComponent } from '../../shared/components/custom-input/custom-input.component';
import { OrganizationsService } from '../organizations.service';
import { CreateOrganizationDto } from '../types';
import { turnUndefinedIfEmpty } from '../../shared/services/utils/utils.functions';

@Component({
  selector: 'app-create-organization',
  imports: [CreatingFormComponent, CustomInputComponent, FormsModule],
  templateUrl: './create-organization.component.html',
  styleUrl: './create-organization.component.css',
})
export class CreateOrganizationComponent {
  @Output() closeEmitter: EventEmitter<void> = new EventEmitter();

  createOrganizationDto: CreateOrganizationDto = {
    name: '',
    cnpj: '',
    address: '',
    phone: '',
  };

  constructor(private readonly organizationsService: OrganizationsService) {}

  close() {
    this.closeEmitter.emit();
  }

  createOrganization() {
    this.createOrganizationDto.address = turnUndefinedIfEmpty(
      this.createOrganizationDto.address
    );
    this.createOrganizationDto.cnpj = turnUndefinedIfEmpty(
      this.createOrganizationDto.cnpj
    );
    this.createOrganizationDto.phone = turnUndefinedIfEmpty(
      this.createOrganizationDto.phone
    );
    this.organizationsService
      .createOrganization(this.createOrganizationDto)
      .subscribe({
        next: (organization) => {
          console.log('Organização criada com sucesso:', organization);
          this.close();
        },
        error: (error) => {
          console.error('Erro ao criar organização:', error);
        },
      });
  }
}
