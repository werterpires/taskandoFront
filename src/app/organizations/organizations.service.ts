
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateOrganizationDto, Organization } from './types';

@Injectable({ providedIn: 'root' })
export class OrganizationsService {
  constructor(private readonly httpClient: HttpClient) {}

  createOrganization(createOrganizationDto: CreateOrganizationDto): Observable<Organization> {
    return this.httpClient.post<Organization>(
      'http://localhost:3000/organizations',
      createOrganizationDto
    );
  }
}
