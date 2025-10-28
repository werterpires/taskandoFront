import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Department } from '../types';
import { DepartmentsService } from '../departments.service';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-see-department',
  templateUrl: './see-department.component.html',
    styleUrl: './see-department.component.css',
  imports: [CommonModule, FormsModule, ModalComponent]
})
export class SeeDepartmentComponent implements OnChanges {
  @Input() department!: Department;
  @Output() closeEmitter = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  editableDepartment: Department | null = null;
  originalDepartment: Department | null = null;
  hasChanges = false;
  isUpdating = false;

  constructor(private readonly departmentsService: DepartmentsService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['department'] && this.department) {
      this.editableDepartment = { ...this.department };
      this.originalDepartment = { ...this.department };
      this.hasChanges = false;
    }
  }

  onFieldChange() {
    if (this.editableDepartment && this.originalDepartment) {
      this.hasChanges =
        this.editableDepartment.name !== this.originalDepartment.name;
    }
  }

  saveChanges() {
    if (!this.editableDepartment || !this.hasChanges) return;

    this.isUpdating = true;

    const updateDto = {
      deptId: this.editableDepartment.deptId,
      name: this.editableDepartment.name,
    };

    this.departmentsService.updateDepartment(updateDto).subscribe({
      next: (updatedDepartment) => {
        this.department = updatedDepartment;
        this.originalDepartment = { ...updatedDepartment };
        this.editableDepartment = { ...updatedDepartment };
        this.hasChanges = false;
        this.isUpdating = false;
        this.updated.emit();
      },
      error: () => {
        this.isUpdating = false;
      },
    });
  }

  cancelChanges() {
    if (this.originalDepartment) {
      this.editableDepartment = { ...this.originalDepartment };
      this.hasChanges = false;
    }
  }

  close() {
    this.closeEmitter.emit();
  }
}
