import { Injectable } from '@angular/core';
import { UserFromJwt } from './types';
import { HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  private _user!: UserFromJwt;

  set user(user: UserFromJwt) {
    this._user = user;
  }

  get user() {
    return this._user;
  }

  hasRole(roleId: number): boolean {
    return this._user?.userRoles?.includes(roleId);
  }

  makeHeadObjt() {
    const token = localStorage.getItem('taskando-token');
    const head_obj = new HttpHeaders().set('Authorization', 'bearer ' + token);
    return head_obj;
  }

  get userName(): string {
    return this._user?.userName || '';
  }

  clear() {
    this._user = {
      userId: 0,
      userName: '',
      userEmail: '',
      userRoles: [],
      userActive: false,
    };
  }
}
