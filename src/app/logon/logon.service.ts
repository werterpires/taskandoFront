import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthStateService } from '../shared/services/auth/auth-state.service';
import { UserFromJwt } from '../shared/services/auth/types';
import { LogonDto, UserToLogon } from './types';

@Injectable({ providedIn: 'root' })
export class LogonService {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly authStateService: AuthStateService
  ) {}

  logon(logonDto: LogonDto): Observable<UserFromJwt> {
    return this.httpClient.post<UserFromJwt>(
      'http://localhost:3000/users/',
      logonDto
    );
  }
}
