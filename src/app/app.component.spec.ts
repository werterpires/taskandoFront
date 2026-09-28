import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiService } from './api.service';
import { AppComponent } from './app.component';

describe('AppComponent routing', () => {
  it('boots My Tasks directly with one task listing request', async () => {
    const events = new Subject<unknown>();
    let url = '/minhas-tarefas';
    const router = {
      events,
      get url() { return url; },
      parseUrl: vi.fn(() => ({ root: { children: { primary: { segments: url.split('/').filter(Boolean).map(path => ({ path })) } } } })),
      navigate: vi.fn(async (commands: string[]) => {
        url = `/${commands.join('/')}`;
        events.next(new NavigationEnd(1, url, url));
        return true;
      }),
    };
    const api = {
      request: vi.fn(async (path: string) => {
        if (path === 'auth/me') return { user: { id: 'user-1', displayName: 'Pessoa', email: 'pessoa@example.test' } };
        if (path === 'organizations') return { organizations: [], invitations: [] };
        if (path === 'lists') return { lists: [] };
        if (path === 'notifications?unreadOnly=1') return { unreadCount: 0, notifications: [] };
        if (path === 'reminders/due') return { reminders: [] };
        throw new Error(`Unexpected request: ${path}`);
      }),
      requestWithClosed: vi.fn(async (path: string) => {
        if (path === 'tasks') return { tasks: [{ id: 'task-1', title: 'Uma tarefa', status: 'todo' }] };
        throw new Error(`Unexpected request: ${path}`);
      }),
    };
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.componentInstance.ngOnInit();

    expect(api.requestWithClosed).toHaveBeenCalledTimes(1);
    expect(api.requestWithClosed).toHaveBeenCalledWith('tasks', []);
    expect(fixture.componentInstance.section()).toBe('Minhas tarefas');
    fixture.destroy();
  });
});
