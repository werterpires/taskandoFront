
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthStateService } from '../shared/services/auth/auth-state.service';
import { OrganizationMember, CreateInviteDto, UpdateMemberDto } from './types';
import { Paginator, Response } from '../shared/types/api';

@Injectable({
  providedIn: 'root',
})
export class OrganizationMembersService {
  private readonly baseUrl = 'http://localhost:3000';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly authService: AuthStateService,
  ) {}

  getAllMembers(orgId: number, paginator: Paginator): Observable<Response<OrganizationMember>> {
    const token = this.authService.makeHeadObjt();

    let params = new HttpParams()
      .set('page', paginator.page.toString())
      .set('pageSize', paginator.pageSize.toString());

    return this.httpClient.get<Response<OrganizationMember>>(
      `${this.baseUrl}/organizations/${orgId}/members`,
      { headers: token, params }
    );
  }

  searchMembers(orgId: number, searchTerm: string, paginator: Paginator): Observable<Response<OrganizationMember>> {
    const token = this.authService.makeHeadObjt();

    let params = new HttpParams()
      .set('page', paginator.page.toString())
      .set('pageSize', paginator.pageSize.toString())
      .set('search', searchTerm);

    return this.httpClient.get<Response<OrganizationMember>>(
      `${this.baseUrl}/organizations/${orgId}/members`,
      { headers: token, params }
    );
  }

  createInvite(inviteDto: CreateInviteDto): Observable<any> {
    const token = this.authService.makeHeadObjt();
    return this.httpClient.post(
      `${this.baseUrl}/organizations/${inviteDto.orgId}/invites`,
      inviteDto,
      { headers: token }
    );
  }

  updateMember(orgId: number, memberId: number, updateDto: UpdateMemberDto): Observable<OrganizationMember> {
    const token = this.authService.makeHeadObjt();
    return this.httpClient.put<OrganizationMember>(
      `${this.baseUrl}/organizations/${orgId}/members/${memberId}`,
      updateDto,
      { headers: token }
    );
  }

  removeMember(orgId: number, memberId: number): Observable<any> {
    const token = this.authService.makeHeadObjt();
    return this.httpClient.delete(
      `${this.baseUrl}/organizations/${orgId}/members/${memberId}`,
      { headers: token }
    );
  }
}
