import { User } from '../shared/types/user.types';

export interface CreateOrganizationDto {
  name: string;
  cnpj?: string;
  address?: string;
  phone?: string;
}

export interface Organization extends CreateOrganizationDto {
  id: string;
  owner?: User;
}
