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
  userId: number;
  orgId: number;
  active: boolean;
}

export interface CreateOrganizationMemberDto {
  email: string;
  role: UserRoleEnum;
  orgId: number;
}

export interface OrganizationMember extends CreateOrganizationMemberDto, User {
  organization?: Organization;
  active?: boolean;
}