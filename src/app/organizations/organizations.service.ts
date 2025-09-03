import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateOrganizationDto, Organization } from './types';
import { AuthStateService } from '../shared/services/auth/auth-state.service';

@Injectable({ providedIn: 'root' })
export class OrganizationsService {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly authService: AuthStateService
  ) {}

  createOrganization(
    createOrganizationDto: CreateOrganizationDto
  ): Observable<Organization> {
    const token = this.authService.makeHeadObjt();
    return this.httpClient.post<Organization>(
      'http://localhost:3000/organizations',
      createOrganizationDto,
      { headers: token }
    );
  }

  getOrganizations(): Observable<Organization[]> {
    const token = this.authService.makeHeadObjt();
    return this.httpClient.get<Organization[]>(
      'http://localhost:3000/organizations',
      { headers: token }
    );
  }
}
