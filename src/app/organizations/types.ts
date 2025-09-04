
export interface CreateOrganizationDto {
  name: string;
  cnpj?: string;
  address?: string;
  phone?: string;
}

export interface Organization extends CreateOrganizationDto {
  id: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
}
