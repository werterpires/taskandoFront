
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { MessagesService } from '../../components/messages/messages.service';

@Injectable({
  providedIn: 'root'
})
export class GlobalErrorHandlerService implements HttpInterceptor {
  constructor(
    private router: Router,
    private messagesService: MessagesService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Remove token se existir
          localStorage.removeItem('taskando-token');
          
          // Exibe mensagem de erro
          this.messagesService.show({
            type: 'error',
            title: 'Sessão Expirada',
            description: [
              'Sua sessão expirou ou você não está autenticado.',
              'Por favor, faça login novamente.'
            ],
            show: true
          });
          
          // Redireciona para a página de login
          this.router.navigate(['/login']);
        } else {
          // Outros erros podem ser tratados aqui
          this.messagesService.show({
            type: 'error',
            title: 'Erro',
            description: [
              error?.error?.message || 'Ocorreu um erro inesperado.',
              'Por favor, tente novamente.'
            ],
            show: true
          });
        }
        
        return throwError(() => error);
      })
    );
  }
}
