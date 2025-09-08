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

export interface createOrganizationMember {
  userId: number;
  orgId: number;
  role: UserRoleEnum;
}

export interface OrganizationMember extends createOrganizationMember, User {
  organization?: Organization;
  active?: boolean;
}
