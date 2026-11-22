export type InviteQuotaUser = {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
};

export type InviteQuota = {
  limit: number;
  used: number;
  remaining: number;
  invitedUser: InviteQuotaUser | null;
};

export const PREFERENCE_FIELDS = [
  { key: 'dueSoonEnabled', label: 'Avisar quando um prazo estiver próximo' },
  { key: 'overdueEnabled', label: 'Avisar sobre tarefas atrasadas' },
  { key: 'scheduledEnabled', label: 'Avisar antes de tarefas agendadas' },
  { key: 'reminderEnabled', label: 'Exibir lembretes no aplicativo' },
] as const;
