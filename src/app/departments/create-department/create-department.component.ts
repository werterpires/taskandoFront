import { Component, EventEmitter, Output } from '@angular/core';
import { DepartmentsService } from '../departments.service';
import { CreateDepartmentDto } from '../types';
import { FormsModule } from '@angular/forms';
import { CreatingFormComponent } from '../../shared/components/creating-form/creating-form.component';
import { CustomInputComponent } from '../../shared/components/custom-input/custom-input.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-create-department',
  templateUrl: './create-department.component.html',
    styleUrl: './create-department.component.css',
  imports: [
    FormsModule,
    CreatingFormComponent,
    CustomInputComponent,
    ModalComponent,
  ]
})
export class CreateDepartmentComponent {
  @Output() closeEmitter = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  createDepartmentDto: CreateDepartmentDto = { name: '' };
  loading = false;

  constructor(private readonly departmentsService: DepartmentsService) {}

  close() {
    this.closeEmitter.emit();
  }

  createDepartment() {
    this.loading = true;
    this.departmentsService.createDepartment(this.createDepartmentDto).subscribe({
      next: () => {
        this.loading = false;
        this.created.emit();
        this.close();
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
