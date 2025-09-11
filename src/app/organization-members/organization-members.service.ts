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
    private readonly authService: AuthStateService
  ) {}

  createInvite(createInviteDto: CreateInviteDto): Observable<any> {
    const token = this.authService.makeHeadObjt();
    return this.httpClient.put(
      `${this.baseUrl}/organizations-members/invite`,
      createInviteDto,
      { headers: token }
    );
  }

  getAllMembers(
    orgId: number,
    paginator: Paginator
  ): Observable<Response<OrganizationMember>> {
    const token = this.authService.makeHeadObjt();
    console.log('token 1:', token);

    let params = new HttpParams()
      .set('limit', paginator.limit?.toString() || '10')
      .set('offset', paginator.offset?.toString() || '0')
      .set('orderBy', paginator.orderBy || 'userId')
      .set('direction', paginator.direction || 'ASC');

    return this.httpClient.get<Response<OrganizationMember>>(
      `${this.baseUrl}/organizations-members/organization/${orgId}`,
      { headers: token, params }
    );
  }

  getMemberById(userId: number, orgId: number): Observable<OrganizationMember> {
    const token = this.authService.makeHeadObjt();

    let params = new HttpParams()
      .set('userId', userId.toString())
      .set('orgId', orgId.toString());

    return this.httpClient.get<OrganizationMember>(
      `${this.baseUrl}/organizations-members/member`,
      { headers: token, params }
    );
  }

  updateMember(
    updateMemberDto: UpdateMemberDto
  ): Observable<OrganizationMember> {
    const token = this.authService.makeHeadObjt();
    return this.httpClient.put<OrganizationMember>(
      `${this.baseUrl}/organizations-members/update`,
      updateMemberDto,
      { headers: token }
    );
  }
}
