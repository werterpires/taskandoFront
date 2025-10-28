import { Department } from '../departments/types';
import { UserRoleEnum } from '../shared/types/roles.enum';
import { User } from '../shared/types/user.types';

export interface CreateOrganizationDto {
  name: string;
  cnpj?: string;
  address?: string;
  phone?: string;
}

export interface Organization extends CreateOrganizationDto {
  orgId: number;
  owner?: User;
  currentUserRoles?: UserRoleEnum[];
  departments?: Department[];
}

export interface UpdateOrganizationDto extends Partial<CreateOrganizationDto> {
  orgId: number;
}
