import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Department, CreateDepartmentDto, UpdateDepartmentDto } from './types';
import { Response, Paginator } from '../shared/types/api';
import { AuthStateService } from '../shared/services/auth/auth-state.service';

@Injectable({ providedIn: 'root' })
export class DepartmentsService {
  private readonly baseUrl = 'http://localhost:3000/departments';

  constructor(
    private http: HttpClient,
    private readonly authService: AuthStateService
  ) {}

  getDepartments(paginator: Paginator): Observable<Response<Department>> {
    const token = this.authService.makeHeadObjt();

    let params = new HttpParams()
      .set('limit', paginator.limit.toString())
      .set('offset', paginator.offset.toString())
      .set('direction', paginator.direction);

    if (paginator.orderBy) {
      params = params.set('orderBy', paginator.orderBy);
    }

    return this.http.get<Response<Department>>(this.baseUrl, {
      headers: token,
      params,
    });
  }

  findOne(deptId: number): Observable<Department> {
    const token = this.authService.makeHeadObjt();
    return this.http.get<Department>(`${this.baseUrl}/${deptId}`, {
      headers: token,
    });
  }

  createDepartment(department: CreateDepartmentDto): Observable<Department> {
    const token = this.authService.makeHeadObjt();
    return this.http.post<Department>(this.baseUrl, department, {
      headers: token,
    });
  }

  updateDepartment(
    updateDto: UpdateDepartmentDto
  ): Observable<Department> {
    const token = this.authService.makeHeadObjt();
    return this.http.put<Department>(this.baseUrl, updateDto, {
      headers: token,
    });
  }

  deleteDepartment(deptId: number): Observable<void> {
    const token = this.authService.makeHeadObjt();
    return this.http.delete<void>(`${this.baseUrl}/${deptId}`, {
      headers: token,
    });
  }

  findAllByOrgId(
    orgId: number,
    paginator: Paginator
  ): Observable<Response<Department>> {
    const token = this.authService.makeHeadObjt();

    let params = new HttpParams()
      .set('limit', paginator.limit.toString())
      .set('offset', paginator.offset.toString())
      .set('direction', paginator.direction);

    // Backend fixa orderBy = 'deptId', então não precisamos enviar.

    return this.http.get<Response<Department>>(
      `${this.baseUrl}/organization/${orgId}`,
      {
        headers: token,
        params,
      }
    );
  }
}
