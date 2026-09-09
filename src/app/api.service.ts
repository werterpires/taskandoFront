import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
export type Item = { id: string; title?: string; name?: string; kind?: string; [key: string]: any };
export class ApiError extends Error {
  constructor(readonly status: number, readonly details: Record<string, any>) { super(details['error'] ?? details['message'] ?? 'Não foi possível concluir a operação.'); }
}
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  async request<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
    try { return await firstValueFrom(this.http.request<T>(method, `/api/${path}`, { body, withCredentials: true })); }
    catch (error) { if (error instanceof HttpErrorResponse) throw new ApiError(error.status, typeof error.error === 'object' && error.error ? error.error : {}); throw error; }
  }
}
