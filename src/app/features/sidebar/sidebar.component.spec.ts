import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SidebarComponent, SidebarNavigationRequest } from './sidebar.component';

describe('SidebarComponent', () => {
  it('renders user info, active section, open task count, and organizations', async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.componentRef.setInput('user', { id: 'u-1', displayName: 'Maria Silva', email: 'maria@example.test' });
    fixture.componentRef.setInput('section', 'Minhas tarefas');
    fixture.componentRef.setInput('openCount', 7);
    fixture.componentRef.setInput('organizations', [{ id: 'org-1', name: 'Edubazu' }]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.workspace .avatar')?.textContent?.trim()).toBe('M');
    expect(el.querySelector('.sidebar-footer')?.textContent).toContain('Maria Silva');
    expect(el.querySelector('nav button.active')?.textContent).toContain('Minhas tarefas');
    expect(el.querySelector('.count')?.textContent?.trim()).toBe('7');
    expect(el.querySelector('.organization-link')?.textContent).toContain('Edubazu');

    fixture.componentRef.setInput('scope', { id: 'org-1', kind: 'organization', name: 'Edubazu' });
    fixture.detectChanges();
    expect(el.querySelector('nav button.active')).toBeNull();
    fixture.destroy();
  });

  it('emits navigation, organization creation, logout, and closeMobile events', async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.componentRef.setInput('user', { id: 'u-1', displayName: 'Maria' });
    fixture.componentRef.setInput('section', 'Início');
    fixture.componentRef.setInput('organizations', [{ id: 'org-1', name: 'Edubazu' }]);
    fixture.componentRef.setInput('mobileOpen', true);
    fixture.detectChanges();

    const navEvents: SidebarNavigationRequest[] = [];
    let createOrgCalls = 0;
    let logoutCalls = 0;
    let closeMobileCalls = 0;
    fixture.componentInstance.navigate.subscribe(e => navEvents.push(e));
    fixture.componentInstance.createOrganization.subscribe(() => { createOrgCalls += 1; });
    fixture.componentInstance.logout.subscribe(() => { logoutCalls += 1; });
    fixture.componentInstance.closeMobile.subscribe(() => { closeMobileCalls += 1; });

    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('button[aria-label="Fechar menu"]') as HTMLButtonElement).click();
    (el.querySelector('button[aria-label="Nova organização"]') as HTMLButtonElement).click();
    (el.querySelector('.organization-link') as HTMLButtonElement).click();
    (el.querySelector('.sidebar-footer button') as HTMLButtonElement).click();

    expect(closeMobileCalls).toBe(1);
    expect(createOrgCalls).toBe(1);
    expect(logoutCalls).toBe(1);
    expect(navEvents).toEqual([
      { section: 'Estrutura', scope: { id: 'org-1', kind: 'organization', name: 'Edubazu' } },
    ]);
    fixture.destroy();
  });
});
