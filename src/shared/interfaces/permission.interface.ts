export interface ProjectRoleRule {
  role: string;
  isPrimary?: boolean;
}

export interface PermissionRule {
  topcoderRoles?: string[] | boolean;
  projectRoles?: (string | ProjectRoleRule)[] | boolean;
  scopes?: string[];
}

export interface Permission {
  allowRule?: PermissionRule;
  denyRule?: PermissionRule;
  topcoderRoles?: string[] | boolean;
  projectRoles?: (string | ProjectRoleRule)[] | boolean;
  scopes?: string[];
  meta?: {
    title?: string;
    group?: string;
    description?: string;
  };
}

export interface ProjectMember {
  id?: bigint | number | string;
  projectId?: bigint | number | string;
  userId: bigint | number | string;
  role: string;
  isPrimary?: boolean;
  deletedAt?: Date | null;
}

export interface ProjectInvite {
  id?: bigint | number | string;
  projectId?: bigint | number | string;
  userId?: bigint | number | string | null;
  email?: string | null;
  status: string;
  deletedAt?: Date | null;
}

export interface ProjectContext {
  projectId?: string;
  projectMembers: ProjectMember[];
  projectInvites?: ProjectInvite[];
}
