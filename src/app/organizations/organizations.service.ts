import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthStateService } from '../shared/services/auth/auth-state.service';
import { CreateOrganizationDto, Organization } from './types';
import { Paginator, Response } from '../shared/types/api';

@Injectable({
  providedIn: 'root',
})
export class OrganizationsService {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly authService: AuthStateService
  ) {}

  createOrganization(organization: CreateOrganizationDto): Observable<any> {
    const token = this.authService.makeHeadObjt();
    return this.httpClient.post(
      'http://localhost:3000/organizations',
      organization,
      { headers: token }
    );
  }

  getOrganizations(paginator: Paginator): Observable<Response<Organization>> {
    const token = this.authService.makeHeadObjt();

    let params = new HttpParams()
      .set('limit', paginator.limit.toString())
      .set('offset', paginator.offset.toString())
      .set('direction', paginator.direction);

    if (paginator.orderBy) {
      params = params.set('orderBy', paginator.orderBy);
    }

    return this.httpClient.get<Response<Organization>>(
      'http://localhost:3000/organizations',
      { headers: token, params }
    );
  }

  findOne(id: string): Observable<Organization> {
    const token = this.authService.makeHeadObjt();
    return this.httpClient.get<Organization>(
      `http://localhost:3000/organizations/${id}`,
      { headers: token }
    );
  }

  updateOrganization(organization: UpdateOrganizationDto): Observable<Organization> {
    const token = this.authService.makeHeadObjt();
    return this.httpClient.put<Organization>(
      'http://localhost:3000/organizations',
      organization,
      { headers: token }
    );
  }
}