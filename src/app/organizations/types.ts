import { userRoleEnum } from '../shared/types/roles.enum';
import { User } from '../shared/types/user.types';

export interface CreateOrganizationDto {
  name: string;
  cnpj?: string;
  address?: string;
  phone?: string;
}

export interface Organization extends CreateOrganizationDto {
  orgId: string;
  owner?: User;
  currentUserRoles?: userRoleEnum[];
}

export interface UpdateOrganizationDto extends Partial<CreateOrganizationDto> {
  orgId: number;
}
