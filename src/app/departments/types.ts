import { Organization } from "../organizations/types";
import { User } from "../shared/types/user.types";
import { UserRoleEnum } from "../shared/types/roles.enum";

export interface Department {
  name: string;
  ownerId: number;
  orgId?: number;
  deptId: number;
  owner?: User;
  organization?: Organization;
  currentUserRoles?: UserRoleEnum[];
}

export interface CreateDepartmentDto {
  name: string;
  orgId?: number;
}

export interface UpdateDepartmentDto {
  deptId: number;
  name?: string;
}
