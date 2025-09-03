import { Component, QueryList, ViewChildren } from '@angular/core';
import { OnlyModalBaseComponent } from '../shared/components/only-modal-base/only-modal-base.component';
import { CustomInputComponent } from '../shared/components/custom-input/custom-input.component';
import * as validators from '../shared/components/custom-input/validators';
import * as masks from '../shared/components/custom-input/masks';
import { ActivatedRoute, Router } from '@angular/router';
import { LogonService } from './logon.service';
import { LogonDto, UserToLogon } from './types';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LoginService } from '../login/login.service';
import { filter, map, Subject, takeUntil } from 'rxjs';
import { LoaderService } from '../shared/components/loader/loader.service';

@Component({
  selector: 'app-logon',
  imports: [CustomInputComponent, FormsModule, CommonModule],
  templateUrl: './logon.component.html',
  styleUrl: './logon.component.css',
})
export class LogonComponent {
  @ViewChildren(CustomInputComponent) inputs!: QueryList<CustomInputComponent>;
  validators = validators;
  masks = masks;

  userToLogon: UserToLogon = {
    firstName: '',
    lastName: '',
  };

  logonDto: LogonDto = {
    firstName: '',
    password: '',
    lastName: '',
    email: '',
  };
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private readonly logonService: LogonService,
    private readonly loginService: LoginService,
    private readonly loaderService: LoaderService
  ) {}

  ngOnInit() {
    localStorage.removeItem('taskando-token');
    this.loginService.hideLogin();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  preLogon() {
    let errorsQuantity = 0;
    this.inputs.forEach((input) => {
      input.validate();
      errorsQuantity += input.errorMessages.length;
    });

    if (errorsQuantity > 0) {
      return;
    }

    this.logon();
  }

  logon() {
    this.loaderService.showLoader(true);

    this.logonDto = {
      firstName: this.userToLogon.firstName,
      lastName: this.userToLogon.lastName,
      password: this.logonDto.password,
      email: this.logonDto.email,
    };

    this.logonService.logon(this.logonDto).subscribe({
      next: (response) => {
        this.router.navigate(['']);
      },
      error: (error) => {
        throw error;
      },
      complete: () => {
        this.loaderService.showLoader(false);
      },
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
