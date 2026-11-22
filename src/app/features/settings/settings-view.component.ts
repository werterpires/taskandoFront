import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ApiError, ApiService, Item } from '../../api.service';
import { LegalGateService } from '../../legal/legal-gate.service';
import { DateBrPipe } from '../../shared/date-br.pipe';
import { ItemEditorService } from '../../shared/item-editor-modal/item-editor.service';
import { ToastService } from '../../shared/toast/toast.service';
import { InviteQuota, PREFERENCE_FIELDS } from './settings.types';

interface DecisionPrompt {
  title: string;
  options: { value: string; label: string }[];
  resolve: (value: string | null) => void;
}

@Component({
  selector: 'app-settings-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DateBrPipe],
  templateUrl: './settings-view.component.html',
})
export class SettingsViewComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly itemEditor = inject(ItemEditorService);
  private readonly legalGate = inject(LegalGateService);

  readonly user = input.required<Item>();
  readonly inviteQuota = input<InviteQuota | null>(null);
  readonly initialSettings = input<Record<string, any>>({});
  readonly initialSizeLabels = input<string>('Muito pequeno, Pequeno, Médio, Grande, Muito grande');
  readonly initialInvitations = input<Item[]>([]);
  readonly initialTransfers = input<Item[]>([]);

  readonly inviteQuotaChange = output<InviteQuota | null>();
  readonly sizeLabelsChange = output<string>();
  readonly reloadRequested = output<void>();
  readonly navigationReloadRequested = output<void>();

  readonly quota = linkedSignal(() => this.inviteQuota());
  readonly settings = linkedSignal(() => ({ ...this.initialSettings() }));
  readonly sizeLabels = linkedSignal(() => this.initialSizeLabels());
  readonly invitations = linkedSignal(() => this.initialInvitations());
  readonly transfers = linkedSignal(() => this.initialTransfers());

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly newUserDisplayName = signal('');
  readonly newUserEmail = signal('');
  readonly newUserPassword = signal('');
  readonly token = signal('');
  readonly saving = signal(false);
  readonly decision = signal<DecisionPrompt | null>(null);

  readonly preferenceFields = PREFERENCE_FIELDS;
  readonly mcpUrl = `${environment.apiBaseUrl || (typeof location !== 'undefined' ? location.origin : '')}/api/integrations/mcp`;

  openLegalRoute(event: Event, path: '/termos' | '/privacidade'): void {
    event.preventDefault();
    void this.router.navigate([path]);
  }

  setSetting(key: string, value: unknown): void {
    this.settings.update(current => ({ ...current, [key]: value }));
  }

  async createUser(): Promise<void> {
    await this.run(async () => {
      const created = await this.api.request('auth/users', 'POST', {
        displayName: this.newUserDisplayName(),
        email: this.newUserEmail(),
        password: this.newUserPassword(),
      });
      this.newUserDisplayName.set('');
      this.newUserEmail.set('');
      this.newUserPassword.set('');
      this.toast.success('Usuário criado. Informe a senha inicial à pessoa.');
      await this.refreshInviteQuota(created);
    });
  }

  private async refreshInviteQuota(created?: { user?: Item; inviteQuota?: InviteQuota | null }): Promise<void> {
    if (created?.inviteQuota) {
      this.setQuota(created.inviteQuota);
      return;
    }
    try {
      const me = await this.api.request('auth/me');
      if (me && 'inviteQuota' in me) {
        this.setQuota(me.inviteQuota ?? null);
        return;
      }
    } catch {
      // Fallback below keeps UI consistent if auth/me fails right after user creation.
    }
    if (created?.user) {
      const limit = this.quota()?.limit ?? 1;
      this.setQuota({
        limit,
        used: limit,
        remaining: 0,
        invitedUser: {
          id: created.user.id,
          displayName: String(created.user['displayName'] ?? ''),
          email: String(created.user['email'] ?? ''),
          createdAt: String(created.user['createdAt'] ?? ''),
        },
      });
    }
  }

  private setQuota(next: InviteQuota | null): void {
    this.quota.set(next);
    this.inviteQuotaChange.emit(next);
  }

  async changePassword(): Promise<void> {
    await this.run(async () => {
      await this.api.request('auth/password', 'PATCH', {
        currentPassword: this.currentPassword(),
        newPassword: this.newPassword(),
      });
      this.currentPassword.set('');
      this.newPassword.set('');
      this.toast.success('Senha alterada.');
    });
  }

  async saveSettings(): Promise<void> {
    await this.run(async () => {
      const current = this.settings();
      const prefs: Record<string, any> = {};
      for (const key of ['dueSoonEnabled', 'overdueEnabled', 'scheduledEnabled', 'reminderEnabled', 'timeZone']) {
        if (key in current) prefs[key] = current[key];
      }
      await this.api.request('notification-preferences', 'PATCH', prefs);
      const labelsValue = this.sizeLabels();
      await this.api.request('preferences/size-labels', 'PATCH', {
        labels: labelsValue.split(',').map(v => v.trim()),
      });
      this.itemEditor.setSizeLabels(labelsValue);
      this.sizeLabelsChange.emit(labelsValue);
      this.toast.success('Preferências salvas.');
    });
  }

  async generateToken(): Promise<void> {
    if (!await this.ask('Gerar um token invalida o anterior. Continuar?', [{ value: 'yes', label: 'Gerar token' }])) {
      return;
    }
    await this.run(async () => {
      const data = await this.api.request('mcp-token', 'POST', {});
      this.token.set(data.secret);
      this.toast.success('Token gerado.');
    });
  }

  async revokeToken(): Promise<void> {
    await this.run(async () => {
      await this.api.request('mcp-token', 'DELETE', {});
      this.token.set('');
      this.toast.info('Token revogado.');
    });
  }

  async exportData(): Promise<void> {
    await this.run(async () => {
      const data = await this.api.request('privacy/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'taskando-export.json';
      a.click();
      URL.revokeObjectURL(url);
      this.toast.success('Dados exportados.');
    });
  }

  async deleteAccount(): Promise<void> {
    if (!await this.ask('Registrar solicitação de exclusão da conta? Os dados compartilhados serão analisados.', [{ value: 'yes', label: 'Solicitar exclusão' }])) {
      return;
    }
    await this.run(async () => {
      await this.api.request('privacy/deletion-request', 'POST', { confirmation: 'EXCLUIR' });
      this.toast.success('Solicitação registrada.');
    });
  }

  async acceptInvitation(row: Item, accept: boolean): Promise<void> {
    await this.run(async () => {
      await this.api.request(
        row['organization'] ? `organizations/${row['organization'].id}/members/${row.id}` : 'item-invitations',
        'PATCH',
        row['organization'] ? { action: accept ? 'accept' : 'decline' } : { id: row.id, accept },
      );
      this.toast.success(accept ? 'Convite aceito.' : 'Convite recusado.');
      this.invitations.update(list => list.filter(item => item.id !== row.id));
      this.navigationReloadRequested.emit();
      this.reloadRequested.emit();
    });
  }

  async respondTransfer(row: Item, action: string): Promise<void> {
    await this.run(async () => {
      await this.api.request('owner-transfers', 'PATCH', { id: row.id, action });
      this.toast.success('Solicitação atualizada.');
      this.transfers.update(list => list.filter(item => item.id !== row.id));
      this.reloadRequested.emit();
    });
  }

  ask(title: string, options: { value: string; label: string }[]): Promise<string | null> {
    return new Promise<string | null>(resolve => this.decision.set({ title, options, resolve }));
  }

  answer(value: string | null): void {
    const prompt = this.decision();
    this.decision.set(null);
    prompt?.resolve(value);
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await action();
    } catch (error) {
      if (error instanceof ApiError && error.status === 428 && error.details['code'] === 'LEGAL_ACCEPTANCE_REQUIRED') {
        this.legalGate.intercept428(error.details);
        return;
      }
      const message = error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
      this.toast.error(message);
    } finally {
      this.saving.set(false);
    }
  }
}
