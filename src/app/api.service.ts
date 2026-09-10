import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
export type Item = { id: string; title?: string; name?: string; kind?: string; [key: string]: any };
export class ApiError extends Error {
  constructor(readonly status: number, readonly details: Record<string, any>) { super(details['error'] ?? details['message'] ?? 'Não foi possível concluir a operação.'); }
}
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  async request<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
    try { return await firstValueFrom(this.http.request<T>(method, `${environment.apiBaseUrl}/api/${path}`, { body, withCredentials: true })); }
    catch (error) {
      if (error instanceof HttpErrorResponse) {
        if (error.error instanceof SyntaxError || typeof error.error === 'string') {
          throw new ApiError(error.status || 0, { error: 'Não foi possível conectar à API. Inicie o backend Nest e confirme o proxy do Angular.' });
        }
        throw new ApiError(error.status, typeof error.error === 'object' && error.error ? error.error : {});
      }
      throw error;
    }
  }
}
