import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { AppComponent } from './app/app.component';
import { PhaseViewComponent } from './app/phase-view/phase-view.component';
import { ProcessViewComponent } from './app/process-view/process-view.component';
import { TaskViewComponent } from './app/task-view/task-view.component';
import { SectionRouteComponent } from './app/section-route.component';
import { navigation } from './app/navigation';

registerLocaleData(localePt);

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    provideRouter([
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      ...navigation.map(item => ({ path: item.path, component: SectionRouteComponent })),
      { path: 'listas/:id', component: SectionRouteComponent },
      { path: 'estrutura/organizacao/:id', component: SectionRouteComponent },
      { path: 'estrutura/departamento/:id', component: SectionRouteComponent },
      { path: 'estrutura/time/:id', component: SectionRouteComponent },
      { path: 'processos/:id', component: ProcessViewComponent },
      { path: 'fases/:id', component: PhaseViewComponent },
      { path: 'phases/:id', redirectTo: 'fases/:id' },
      { path: 'tarefas/:id', component: TaskViewComponent },
      { path: 'tasks/:id', redirectTo: 'tarefas/:id' },
      { path: '**', redirectTo: 'inicio' },
    ], withHashLocation()),
  ],
}).catch(console.error);
