import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../api.service';
import { ItemEditorService } from '../../shared/item-editor-modal/item-editor.service';
import { ToastService } from '../../shared/toast/toast.service';
import { SettingsViewComponent } from './settings-view.component';
import { InviteQuota } from './settings.types';

describe('SettingsViewComponent', () => {
  afterEach(() => {
    TestBed.inject(ToastService).clear();
    vi.restoreAllMocks();
  });

  it('renders 1-invite quota panel, creates user with toast, and refreshes quota', async () => {
    const initialQuota: InviteQuota = { limit: 1, used: 0, remaining: 1, invitedUser: null };
    const refreshedQuota: InviteQuota = {
      limit: 1,
      used: 1,
      remaining: 0,
      invitedUser: {
        id: 'u-2',
        displayName: 'Maria Convidada',
        email: 'maria@example.test',
        createdAt: '2026-11-22T15:00:00.000Z',
      },
    };
    const api = {
      request: vi.fn(async (path: string, method = 'GET') => {
        if (path === 'auth/users' && method === 'POST') return { user: refreshedQuota.invitedUser };
        if (path === 'auth/me') return { inviteQuota: refreshedQuota };
        throw new Error(`Unexpected request: ${method} ${path}`);
      }),
    };
    const router = { navigate: vi.fn(async () => true) };

    await TestBed.configureTestingModule({
      imports: [SettingsViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SettingsViewComponent);
    fixture.componentRef.setInput('user', { id: 'u-1', displayName: 'Pessoa', email: 'pessoa@example.test' });
    fixture.componentRef.setInput('inviteQuota', initialQuota);
    fixture.detectChanges();

    const quotaChanges: (InviteQuota | null)[] = [];
    fixture.componentInstance.inviteQuotaChange.subscribe(q => quotaChanges.push(q));

    const panel = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="create-user-panel"]')!;
    expect(panel.textContent).toContain('Convites restantes: 1 de 1');
    expect(panel.querySelector('form')).toBeTruthy();

    fixture.componentInstance.newUserDisplayName.set('Maria Convidada');
    fixture.componentInstance.newUserEmail.set('maria@example.test');
    fixture.componentInstance.newUserPassword.set('password123');
    await fixture.componentInstance.createUser();
    fixture.detectChanges();

    expect(api.request).toHaveBeenCalledWith('auth/users', 'POST', {
      displayName: 'Maria Convidada',
      email: 'maria@example.test',
      password: 'password123',
    });
    expect(quotaChanges).toEqual([refreshedQuota]);
    expect(panel.querySelector('form')).toBeNull();
    expect(panel.textContent).toContain('Maria Convidada');
    expect(panel.textContent).toContain('0 de 1');
    expect(TestBed.inject(ToastService).toasts().some(t => t.message.includes('Usuário criado'))).toBe(true);
    fixture.destroy();
  });

  it('saves preferences, updates ItemEditorService size labels, and handles invitations/transfers', async () => {
    const api = {
      request: vi.fn(async () => ({ ok: true })),
    };
    const router = { navigate: vi.fn(async () => true) };

    await TestBed.configureTestingModule({
      imports: [SettingsViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SettingsViewComponent);
    fixture.componentRef.setInput('user', { id: 'u-1', displayName: 'Pessoa', email: 'pessoa@example.test' });
    fixture.componentRef.setInput('initialSettings', { dueSoonEnabled: true, timeZone: 'America/Sao_Paulo' });
    fixture.componentRef.setInput('initialSizeLabels', 'PP, P, M, G, GG');
    fixture.componentRef.setInput('initialInvitations', [{ id: 'inv-1', itemName: 'Projeto Alpha', role: 'editor' }]);
    fixture.componentRef.setInput('initialTransfers', [{ id: 'tr-1', itemName: 'Tarefa Beta', canAccept: true }]);
    fixture.detectChanges();

    const sizeChanges: string[] = [];
    let reloadCount = 0;
    let navReloadCount = 0;
    fixture.componentInstance.sizeLabelsChange.subscribe(v => sizeChanges.push(v));
    fixture.componentInstance.reloadRequested.subscribe(() => { reloadCount += 1; });
    fixture.componentInstance.navigationReloadRequested.subscribe(() => { navReloadCount += 1; });

    fixture.componentInstance.setSetting('overdueEnabled', false);
    fixture.componentInstance.sizeLabels.set('XS, S, M, L, XL');
    await fixture.componentInstance.saveSettings();

    expect(api.request).toHaveBeenCalledWith('notification-preferences', 'PATCH', {
      dueSoonEnabled: true,
      timeZone: 'America/Sao_Paulo',
      overdueEnabled: false,
    });
    expect(api.request).toHaveBeenCalledWith('preferences/size-labels', 'PATCH', {
      labels: ['XS', 'S', 'M', 'L', 'XL'],
    });
    expect(sizeChanges).toEqual(['XS, S, M, L, XL']);
    expect(TestBed.inject(ItemEditorService).sizeLabels()).toBe('XS, S, M, L, XL');

    await fixture.componentInstance.acceptInvitation({ id: 'inv-1', itemName: 'Projeto Alpha', role: 'editor' }, true);
    await fixture.componentInstance.respondTransfer({ id: 'tr-1', itemName: 'Tarefa Beta' }, 'accept');

    expect(navReloadCount).toBe(1);
    expect(reloadCount).toBe(2);
    expect(fixture.componentInstance.invitations()).toHaveLength(0);
    expect(fixture.componentInstance.transfers()).toHaveLength(0);
    fixture.destroy();
  });

  it('generates and revokes MCP token with confirmation modal', async () => {
    const api = {
      request: vi.fn(async (path: string, method = 'GET') => {
        if (path === 'mcp-token' && method === 'POST') return { secret: 'tsk_mcp_123' };
        if (path === 'mcp-token' && method === 'DELETE') return { ok: true };
        throw new Error(`Unexpected request: ${method} ${path}`);
      }),
    };
    const router = { navigate: vi.fn(async () => true) };

    await TestBed.configureTestingModule({
      imports: [SettingsViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SettingsViewComponent);
    fixture.componentRef.setInput('user', { id: 'u-1', displayName: 'Pessoa', email: 'pessoa@example.test' });
    fixture.detectChanges();

    const generatePromise = fixture.componentInstance.generateToken();
    fixture.detectChanges();

    const confirmBtn = (fixture.nativeElement as HTMLElement).querySelector('.modal.decision button.primary') as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();
    confirmBtn.click();
    await generatePromise;
    fixture.detectChanges();

    expect(fixture.componentInstance.token()).toBe('tsk_mcp_123');
    const tokenInput = (fixture.nativeElement as HTMLElement).querySelector('input[aria-label="Token MCP"]') as HTMLInputElement;
    expect(tokenInput?.value).toBe('tsk_mcp_123');

    await fixture.componentInstance.revokeToken();
    fixture.detectChanges();
    expect(fixture.componentInstance.token()).toBe('');
    fixture.destroy();
  });
});
