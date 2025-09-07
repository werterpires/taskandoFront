
import { userRoleEnum } from '../shared/types/roles.enum';

export interface CreateInviteDto {
  email: string;
  role: userRoleEnum;
  orgId: number;
}

export interface UpdateMemberDto {
  role: userRoleEnum;
  userId: number;
  orgId: number;
  active: boolean;
}

export interface createOrganizationMember {
  userId: number;
  orgId: number;
  role: userRoleEnum;
}

export interface OrganizationMember extends createOrganizationMember {
  user?: {
    id: number;
    name: string;
    email: string;
  };
  organization?: {
    id: number;
    name: string;
  };
  active?: boolean;
}
