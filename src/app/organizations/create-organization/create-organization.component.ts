
import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreatingFormComponent } from '../../shared/components/creating-form/creating-form.component';
import { CustomInputComponent } from '../../shared/components/custom-input/custom-input.component';
import { OrganizationsService } from '../organizations.service';
import { CreateOrganizationDto } from '../types';

@Component({
  selector: 'app-create-organization',
  imports: [CreatingFormComponent, CustomInputComponent, ReactiveFormsModule],
  templateUrl: './create-organization.component.html',
  styleUrl: './create-organization.component.css'
})
export class CreateOrganizationComponent {
  @Output() closeEmitter: EventEmitter<void> = new EventEmitter();

  organizationForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly organizationsService: OrganizationsService
  ) {
    this.organizationForm = this.fb.group({
      name: ['', [Validators.required]],
      cnpj: [''],
      address: [''],
      phone: ['']
    });
  }

  close() {
    this.closeEmitter.emit();
  }

  createOrganization() {
    if (this.organizationForm.valid) {
      const createOrganizationDto: CreateOrganizationDto = {
        name: this.organizationForm.get('name')?.value,
        cnpj: this.organizationForm.get('cnpj')?.value || undefined,
        address: this.organizationForm.get('address')?.value || undefined,
        phone: this.organizationForm.get('phone')?.value || undefined
      };

      this.organizationsService.createOrganization(createOrganizationDto).subscribe({
        next: (organization) => {
          console.log('Organização criada com sucesso:', organization);
          this.close();
        },
        error: (error) => {
          console.error('Erro ao criar organização:', error);
        }
      });
    }
  }
}
