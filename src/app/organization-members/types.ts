import { Organization } from '../organizations/types';
import { UserRoleEnum } from '../shared/types/roles.enum';
import { User } from '../shared/types/user.types';

export interface CreateInviteDto {
  email: string;
  role: UserRoleEnum;
  orgId: number;
}

export interface UpdateMemberDto {
  role: UserRoleEnum;
  userId: string;
  orgId: string;
  active: boolean;
}

export interface CreateOrganizationMemberDto {
  email: string;
  role: UserRoleEnum;
  orgId: string;
}

export interface OrganizationMember extends createOrganizationMember, User {
  organization?: Organization;
  active?: boolean;
}