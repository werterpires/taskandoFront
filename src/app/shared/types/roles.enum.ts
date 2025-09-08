export enum UserRoleEnum {
  WATCHER = 'watcher',
  REVIEWER = 'reviewer',
  EXECUTOR = 'executor',
  EDITOR = 'editor',
  CONTRIBUTOR = 'contributor',
  LEADER = 'leader',
  OWNER = 'owner',
}

export const userRoles: userRole[] = [
  {
    name: UserRoleEnum.WATCHER,
    description: 'Pode ver',
  },
  {
    name: UserRoleEnum.CONTRIBUTOR,
    description: 'Pode ver e ver filhos',
  },
  {
    name: UserRoleEnum.EXECUTOR,
    description: 'Pode ver e interagir, ver filhos',
  },
  {
    name: UserRoleEnum.REVIEWER,
    description: 'Pode ver, interagir e aprovar, ver filhos',
  },
  {
    name: UserRoleEnum.EDITOR,
    description: 'Pode ver, interagir e adicionar filhos, ver filhos',
  },
  {
    name: UserRoleEnum.LEADER,
    description:
      'Pode Ver, interagir, aprovar, adicionar filhos, ver filhos e adicionar membros.',
  },
  {
    name: UserRoleEnum.OWNER,
    description:
      'Pode Ver, interagir, aprovar, adicionar filhos, adicionar membros, editar e deletar.',
  },
];

export interface userRole {
  name: UserRoleEnum;
  description: string;
}
