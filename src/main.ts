import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { AppComponent } from './app/app.component';
import { ProcessViewComponent } from './app/process-view/process-view.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideRouter([
      { path: 'processos/:id', component: ProcessViewComponent },
      { path: '**', redirectTo: '' },
    ], withHashLocation()),
  ],
}).catch(console.error);
