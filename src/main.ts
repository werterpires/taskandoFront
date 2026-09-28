import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { AppComponent } from './app/app.component';
import { ProcessViewComponent } from './app/process-view/process-view.component';
import { SectionRouteComponent } from './app/section-route.component';
import { navigation } from './app/navigation';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideRouter([
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      ...navigation.map(item => ({ path: item.path, component: SectionRouteComponent })),
      { path: 'listas/:id', component: SectionRouteComponent },
      { path: 'estrutura/organizacao/:id', component: SectionRouteComponent },
      { path: 'estrutura/departamento/:id', component: SectionRouteComponent },
      { path: 'estrutura/time/:id', component: SectionRouteComponent },
      { path: 'processos/:id', component: ProcessViewComponent },
      { path: '**', redirectTo: 'inicio' },
    ], withHashLocation()),
  ],
}).catch(console.error);
