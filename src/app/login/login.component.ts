import { Component, QueryList, ViewChildren } from '@angular/core';
import { CustomInputComponent } from '../shared/components/custom-input/custom-input.component';
import * as validators from '../shared/components/custom-input/validators';
import { loginDto, UserToken } from './types';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { LoginService } from './login.service';
import { CommonModule } from '@angular/common';
import { MessagesService } from '../shared/components/messages/messages.service';
import { LoaderService } from '../shared/components/loader/loader.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [CustomInputComponent, FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  @ViewChildren(CustomInputComponent) inputs!: QueryList<CustomInputComponent>;

  validators = validators;
  loginDto: loginDto = {
    password: '',
    userEmail: '',
  };

  showLogin = true;

  constructor(
    private readonly loginService: LoginService,
    private readonly loaderService: LoaderService,
    private readonly messagesService: MessagesService,
    private readonly router: Router
  ) {
    this.loginService.showLogin$.subscribe((show) => {
      this.showLogin = show;
    });
  }

  getPolicies() {
    this.loaderService.showLoader(true);
    let errorsQuantity = 0;
    this.inputs.forEach((input) => {
      input.validate();
      errorsQuantity += input.errorMessages.length;
    });

    if (errorsQuantity > 0) {
      return;
    }

    this.login();
  }

  login() {
    this.loaderService.showLoader(true);
    this.loginService.login(this.loginDto).subscribe({
      next: (userToken: UserToken) => {
        this.loginService.saveToken(userToken);
        this.loginService.saveUser(userToken);
        this.loginService.hideLogin();
        
        // Redireciona para a rota vazia
        this.router.navigate(['']);
      },
      error: (error) => {
        // Exibe mensagem de erro
        this.messagesService.show({
          type: 'error',
          title: 'Erro no Login',
          description: [
            'Ocorreu um erro ao tentar fazer login.',
            error?.error?.message || 'Verifique suas credenciais e tente novamente.'
          ],
          show: true
        });
      },
      complete: () => {
        this.loaderService.showLoader(false);
      },
    });
  }
}
