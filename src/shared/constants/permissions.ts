/**
 * Named permission keys used with `@RequirePermission(Permission.X)`.
 *
 * These enum values are lookup keys for policies defined in
 * `permissions.constants.ts`. They are an alternative to inline permission
 * objects passed directly to the decorator.
 */
export enum Permission {
  /** Read any project even when the user is not a member. */
  READ_PROJECT_ANY = 'READ_PROJECT_ANY',
  /** View project details. */
  VIEW_PROJECT = 'VIEW_PROJECT',
  /** Create a project. */
  CREATE_PROJECT = 'CREATE_PROJECT',
  /** Edit project details. */
  EDIT_PROJECT = 'EDIT_PROJECT',
  /** Delete a project. */
  DELETE_PROJECT = 'DELETE_PROJECT',
  /** Read project members. */
  READ_PROJECT_MEMBER = 'READ_PROJECT_MEMBER',
  /** Add the current user as a project member. */
  CREATE_PROJECT_MEMBER_OWN = 'CREATE_PROJECT_MEMBER_OWN',
  /** Add another user as a project member. */
  CREATE_PROJECT_MEMBER_NOT_OWN = 'CREATE_PROJECT_MEMBER_NOT_OWN',
  /** Update non-customer project members. */
  UPDATE_PROJECT_MEMBER_NON_CUSTOMER = 'UPDATE_PROJECT_MEMBER_NON_CUSTOMER',
  /** Remove topcoder-role project members. */
  DELETE_PROJECT_MEMBER_TOPCODER = 'DELETE_PROJECT_MEMBER_TOPCODER',
  /** Remove customer project members. */
  DELETE_PROJECT_MEMBER_CUSTOMER = 'DELETE_PROJECT_MEMBER_CUSTOMER',
  /** Remove copilot project members. */
  DELETE_PROJECT_MEMBER_COPILOT = 'DELETE_PROJECT_MEMBER_COPILOT',
  /** Read own project invites. */
  READ_PROJECT_INVITE_OWN = 'READ_PROJECT_INVITE_OWN',
  /** Read project invites that belong to other users. */
  READ_PROJECT_INVITE_NOT_OWN = 'READ_PROJECT_INVITE_NOT_OWN',
  /** Create customer invites. */
  CREATE_PROJECT_INVITE_CUSTOMER = 'CREATE_PROJECT_INVITE_CUSTOMER',
  /** Create topcoder-member invites. */
  CREATE_PROJECT_INVITE_TOPCODER = 'CREATE_PROJECT_INVITE_TOPCODER',
  /** Create copilot invites. */
  CREATE_PROJECT_INVITE_COPILOT = 'CREATE_PROJECT_INVITE_COPILOT',
  /** Update own invites. */
  UPDATE_PROJECT_INVITE_OWN = 'UPDATE_PROJECT_INVITE_OWN',
  /** Update requested invites. */
  UPDATE_PROJECT_INVITE_REQUESTED = 'UPDATE_PROJECT_INVITE_REQUESTED',
  /** Update invites for other users. */
  UPDATE_PROJECT_INVITE_NOT_OWN = 'UPDATE_PROJECT_INVITE_NOT_OWN',
  /** Delete own invites. */
  DELETE_PROJECT_INVITE_OWN = 'DELETE_PROJECT_INVITE_OWN',
  /** Delete requested invites. */
  DELETE_PROJECT_INVITE_REQUESTED = 'DELETE_PROJECT_INVITE_REQUESTED',
  /** Delete non-own topcoder invites. */
  DELETE_PROJECT_INVITE_NOT_OWN_TOPCODER = 'DELETE_PROJECT_INVITE_NOT_OWN_TOPCODER',
  /** Delete non-own customer invites. */
  DELETE_PROJECT_INVITE_NOT_OWN_CUSTOMER = 'DELETE_PROJECT_INVITE_NOT_OWN_CUSTOMER',
  /** Delete non-own copilot invites. */
  DELETE_PROJECT_INVITE_NOT_OWN_COPILOT = 'DELETE_PROJECT_INVITE_NOT_OWN_COPILOT',
  /** Manage project billingAccountId assignment. */
  MANAGE_PROJECT_BILLING_ACCOUNT_ID = 'MANAGE_PROJECT_BILLING_ACCOUNT_ID',
  /** Manage project directProjectId value. */
  MANAGE_PROJECT_DIRECT_PROJECT_ID = 'MANAGE_PROJECT_DIRECT_PROJECT_ID',
  /** Read billing accounts available for a project. */
  READ_AVL_PROJECT_BILLING_ACCOUNTS = 'READ_AVL_PROJECT_BILLING_ACCOUNTS',
  /** Read details for the project's billing account. */
  READ_PROJECT_BILLING_ACCOUNT_DETAILS = 'READ_PROJECT_BILLING_ACCOUNT_DETAILS',
  /** Manage copilot request lifecycle. */
  MANAGE_COPILOT_REQUEST = 'MANAGE_COPILOT_REQUEST',
  /** Apply for copilot opportunity. */
  APPLY_COPILOT_OPPORTUNITY = 'APPLY_COPILOT_OPPORTUNITY',
  /** Assign copilot opportunity. */
  ASSIGN_COPILOT_OPPORTUNITY = 'ASSIGN_COPILOT_OPPORTUNITY',
  /** Cancel copilot opportunity. */
  CANCEL_COPILOT_OPPORTUNITY = 'CANCEL_COPILOT_OPPORTUNITY',
  /** Create a project as manager role. */
  CREATE_PROJECT_AS_MANAGER = 'CREATE_PROJECT_AS_MANAGER',
  /** View project attachments. */
  VIEW_PROJECT_ATTACHMENT = 'VIEW_PROJECT_ATTACHMENT',
  /** Create project attachments. */
  CREATE_PROJECT_ATTACHMENT = 'CREATE_PROJECT_ATTACHMENT',
  /** Edit project attachments. */
  EDIT_PROJECT_ATTACHMENT = 'EDIT_PROJECT_ATTACHMENT',
  /** Update attachments created by other users. */
  UPDATE_PROJECT_ATTACHMENT_NOT_OWN = 'UPDATE_PROJECT_ATTACHMENT_NOT_OWN',
  /** Delete project attachments. */
  DELETE_PROJECT_ATTACHMENT = 'DELETE_PROJECT_ATTACHMENT',
  /** Add project phases. */
  ADD_PROJECT_PHASE = 'ADD_PROJECT_PHASE',
  /** Update project phases. */
  UPDATE_PROJECT_PHASE = 'UPDATE_PROJECT_PHASE',
  /** Delete project phases. */
  DELETE_PROJECT_PHASE = 'DELETE_PROJECT_PHASE',
  /** Add phase products. */
  ADD_PHASE_PRODUCT = 'ADD_PHASE_PRODUCT',
  /** Update phase products. */
  UPDATE_PHASE_PRODUCT = 'UPDATE_PHASE_PRODUCT',
  /** Delete phase products. */
  DELETE_PHASE_PRODUCT = 'DELETE_PHASE_PRODUCT',
  /** Workstream create permission. */
  WORKSTREAM_CREATE = 'workStream.create',
  /** Workstream view permission. */
  WORKSTREAM_VIEW = 'workStream.view',
  /** Workstream edit permission. */
  WORKSTREAM_EDIT = 'workStream.edit',
  /** Workstream delete permission. */
  WORKSTREAM_DELETE = 'workStream.delete',
  /** Work create permission. */
  WORK_CREATE = 'work.create',
  /** Work view permission. */
  WORK_VIEW = 'work.view',
  /** Work edit permission. */
  WORK_EDIT = 'work.edit',
  /** Work delete permission. */
  WORK_DELETE = 'work.delete',
  /** Work item create permission. */
  WORKITEM_CREATE = 'workItem.create',
  /** Work item view permission. */
  WORKITEM_VIEW = 'workItem.view',
  /** Work item edit permission. */
  WORKITEM_EDIT = 'workItem.edit',
  /** Work item delete permission. */
  WORKITEM_DELETE = 'workItem.delete',
  /** View work-management permission settings. */
  WORK_MANAGEMENT_PERMISSION_VIEW = 'workManagementPermission.view',
  /** Edit work-management permission settings. */
  WORK_MANAGEMENT_PERMISSION_EDIT = 'workManagementPermission.edit',
}
