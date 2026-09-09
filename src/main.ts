import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { AppComponent } from './app/app.component';
bootstrapApplication(AppComponent, { providers: [provideHttpClient(), provideRouter([], withHashLocation())] }).catch(console.error);
