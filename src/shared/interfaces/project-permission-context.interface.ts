/**
 * Shared project-member shape used by permission checks.
 */
export interface ProjectPermissionMember {
  userId: bigint;
  role: string;
  deletedAt: Date | null;
}

/**
 * Base project permission context.
 */
export interface ProjectPermissionContextBase {
  id: bigint;
  members: ProjectPermissionMember[];
}

/**
 * Full project permission context used by phase/product services.
 */
export interface ProjectPermissionContext
  extends ProjectPermissionContextBase {
  directProjectId: bigint | null;
  billingAccountId: bigint | null;
}
