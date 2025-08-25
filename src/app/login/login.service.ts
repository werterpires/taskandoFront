import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { loginDto as LoginDto, UserToken } from './types';
import {
  BehaviorSubject,
  catchError,
  Observable,
  Subject,
  throwError,
} from 'rxjs';
import { AuthStateService } from '../shared/services/auth/auth-state.service';
import { UserFromJwt } from '../shared/services/auth/types';

@Injectable({ providedIn: 'root' })
export class LoginService {
  showLoginSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    true
  );

  showLogin$ = this.showLoginSubject.asObservable();
  constructor(
    private readonly httpClient: HttpClient,
    private readonly authStateService: AuthStateService
  ) {}

  isShowingLogin(): boolean {
    return this.showLoginSubject.getValue();
  }

  showLogin() {
    this.showLoginSubject.next(true);
  }

  hideLogin() {
    this.showLoginSubject.next(false);
  }

  login(loginDto: LoginDto): Observable<UserToken> {
    return this.httpClient.post<UserToken>(
      'http://localhost:3000/auth/login',
      loginDto
    );
  }

  saveToken(token: UserToken) {
    localStorage.setItem('taskando-token', token.accessToken);
  }

  saveUser(token: UserToken) {
    const payload = JSON.parse(
      atob(token.accessToken.split('.')[1])
    ) as UserFromJwt;
    this.authStateService.user = payload;
  }
}
