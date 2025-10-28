import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomTableComponent } from '../shared/components/custom-table/custom-table.component';
import { TableData } from '../shared/components/custom-table/types';
import { Paginator } from '../shared/types/api';
import { Department } from './types';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentComponent } from './create-department/create-department.component';
import { SeeDepartmentComponent } from './see-department/see-department.component';

@Component({
  selector: 'app-departments',
  imports: [
    CommonModule,
    CustomTableComponent,
    CreateDepartmentComponent,
    SeeDepartmentComponent,
  ],
  templateUrl: './departments.component.html',
  styleUrl: './departments.component.css',
})
export class DepartmentsComponent implements OnInit {
  showCreateDepartment = false;
  showSeeDepartment = false;
  selectedDepartment: Department | null = null;
  departments: Department[] = [];
  totalItems = 0;
  loading = false;

  tableData: TableData<Department> = {
    data: [],
    columns: [
      { name: 'name', label: 'Nome', width: 300 },
      { name: 'orgId', label: 'Organização', width: 200 },
    ],
  };

  constructor(private readonly departmentsService: DepartmentsService) {}

  ngOnInit() {
    this.loadDepartments({
      limit: 10,
      offset: 0,
      orderBy: 'deptId',
      direction: 'ASC',
    });
  }

  loadDepartments(paginator: Paginator) {
    this.loading = true;
    this.departmentsService.getDepartments(paginator).subscribe({
      next: (response) => {
        this.departments = response.itens;
        this.totalItems = response.quantity;
        this.tableData.data = response.itens;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  onPaginationChange(paginator: Paginator) {
    this.loadDepartments(paginator);
  }

  openCreateDepartment() {
    this.showCreateDepartment = true;
  }

  closeCreateDepartment() {
    this.showCreateDepartment = false;
    this.loadDepartments({
      limit: 10,
      offset: 0,
      orderBy: 'deptId',
      direction: 'ASC',
    });
  }

  closeSeeDepartment() {
    this.showSeeDepartment = false;
    this.selectedDepartment = null;
  }

  onDepartmentUpdated() {
    this.loadDepartments({
      limit: 10,
      offset: 0,
      orderBy: 'deptId',
      direction: 'ASC',
    });
  }

  onSeeDepartment(index: number) {
    const department = this.departments[index];
    this.departmentsService.findOne(department.deptId).subscribe({
      next: (departmentDetails) => {
        this.selectedDepartment = departmentDetails;
        this.showSeeDepartment = true;
      },
      error: () => {},
    });
  }

  onDeleteDepartment(index: number) {
    const department = this.departments[index];
    if (
      confirm(`Tem certeza que deseja deletar o departamento "${department.name}"?`)
    ) {
      this.departmentsService.deleteDepartment(department.deptId).subscribe({
        next: () => {
          this.loadDepartments({
            limit: 10,
            offset: 0,
            orderBy: 'deptId',
            direction: 'ASC',
          });
        },
        error: () => {},
      });
    }
  }
}
