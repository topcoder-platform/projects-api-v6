export const KAFKA_TOPIC = {
  // Core project resource events
  PROJECT_DRAFT_CREATED:
    process.env.KAFKA_PROJECT_DRAFT_CREATED_TOPIC || 'project.draft.created',
  PROJECT_UPDATED: process.env.KAFKA_PROJECT_UPDATED_TOPIC || 'project.updated',
  PROJECT_DELETED: process.env.KAFKA_PROJECT_DELETED_TOPIC || 'project.deleted',
  PROJECT_STATUS_CHANGED:
    process.env.KAFKA_PROJECT_STATUS_CHANGED_TOPIC || 'project.status.changed',

  // Project member resource events
  PROJECT_MEMBER_ADDED:
    process.env.KAFKA_PROJECT_MEMBER_ADDED_TOPIC || 'project.member.added',
  PROJECT_MEMBER_UPDATED:
    process.env.KAFKA_PROJECT_MEMBER_UPDATED_TOPIC || 'project.member.updated',
  PROJECT_MEMBER_REMOVED:
    process.env.KAFKA_PROJECT_MEMBER_REMOVED_TOPIC || 'project.member.removed',

  // Project invite resource events
  PROJECT_MEMBER_INVITE_CREATED:
    process.env.KAFKA_PROJECT_MEMBER_INVITE_CREATED_TOPIC ||
    'project.member.invite.created',
  PROJECT_MEMBER_INVITE_UPDATED:
    process.env.KAFKA_PROJECT_MEMBER_INVITE_UPDATED_TOPIC ||
    'project.member.invite.updated',
  PROJECT_MEMBER_INVITE_REMOVED:
    process.env.KAFKA_PROJECT_MEMBER_INVITE_REMOVED_TOPIC ||
    'project.member.invite.deleted',

  // Project attachment resource events
  PROJECT_ATTACHMENT_ADDED:
    process.env.KAFKA_PROJECT_ATTACHMENT_ADDED_TOPIC ||
    'project.attachment.added',
  PROJECT_ATTACHMENT_UPDATED:
    process.env.KAFKA_PROJECT_ATTACHMENT_UPDATED_TOPIC ||
    'project.attachment.updated',
  PROJECT_ATTACHMENT_REMOVED:
    process.env.KAFKA_PROJECT_ATTACHMENT_REMOVED_TOPIC ||
    'project.attachment.removed',

  // Project phase resource events
  PROJECT_PHASE_ADDED:
    process.env.KAFKA_PROJECT_PHASE_ADDED_TOPIC || 'project.phase.added',
  PROJECT_PHASE_UPDATED:
    process.env.KAFKA_PROJECT_PHASE_UPDATED_TOPIC || 'project.phase.updated',
  PROJECT_PHASE_REMOVED:
    process.env.KAFKA_PROJECT_PHASE_REMOVED_TOPIC || 'project.phase.removed',

  // Project phase-product resource events
  PROJECT_PHASE_PRODUCT_ADDED:
    process.env.KAFKA_PROJECT_PHASE_PRODUCT_ADDED_TOPIC ||
    'project.phase.product.added',
  PROJECT_PHASE_PRODUCT_UPDATED:
    process.env.KAFKA_PROJECT_PHASE_PRODUCT_UPDATED_TOPIC ||
    'project.phase.product.updated',
  PROJECT_PHASE_PRODUCT_REMOVED:
    process.env.KAFKA_PROJECT_PHASE_PRODUCT_REMOVED_TOPIC ||
    'project.phase.product.removed',

  // Timeline and milestone resource events
  TIMELINE_ADDED: process.env.KAFKA_TIMELINE_ADDED_TOPIC || 'timeline.added',
  TIMELINE_UPDATED:
    process.env.KAFKA_TIMELINE_UPDATED_TOPIC || 'timeline.updated',
  TIMELINE_REMOVED:
    process.env.KAFKA_TIMELINE_REMOVED_TOPIC || 'timeline.removed',
  MILESTONE_ADDED: process.env.KAFKA_MILESTONE_ADDED_TOPIC || 'milestone.added',
  MILESTONE_UPDATED:
    process.env.KAFKA_MILESTONE_UPDATED_TOPIC || 'milestone.updated',
  MILESTONE_REMOVED:
    process.env.KAFKA_MILESTONE_REMOVED_TOPIC || 'milestone.removed',

  // Workstream/work/workitem resource events
  PROJECT_WORKSTREAM_ADDED:
    process.env.KAFKA_PROJECT_WORKSTREAM_ADDED_TOPIC ||
    'project.workstream.added',
  PROJECT_WORKSTREAM_UPDATED:
    process.env.KAFKA_PROJECT_WORKSTREAM_UPDATED_TOPIC ||
    'project.workstream.updated',
  PROJECT_WORKSTREAM_REMOVED:
    process.env.KAFKA_PROJECT_WORKSTREAM_REMOVED_TOPIC ||
    'project.workstream.removed',
  PROJECT_WORK_ADDED:
    process.env.KAFKA_PROJECT_WORK_ADDED_TOPIC || 'project.work.added',
  PROJECT_WORK_UPDATED:
    process.env.KAFKA_PROJECT_WORK_UPDATED_TOPIC || 'project.work.updated',
  PROJECT_WORK_REMOVED:
    process.env.KAFKA_PROJECT_WORK_REMOVED_TOPIC || 'project.work.removed',
  PROJECT_WORKITEM_ADDED:
    process.env.KAFKA_PROJECT_WORKITEM_ADDED_TOPIC || 'project.workitem.added',
  PROJECT_WORKITEM_UPDATED:
    process.env.KAFKA_PROJECT_WORKITEM_UPDATED_TOPIC ||
    'project.workitem.updated',
  PROJECT_WORKITEM_REMOVED:
    process.env.KAFKA_PROJECT_WORKITEM_REMOVED_TOPIC ||
    'project.workitem.removed',

  // Project setting resource events
  PROJECT_SETTING_CREATED:
    process.env.KAFKA_PROJECT_SETTING_CREATED_TOPIC ||
    'project.setting.created',
  PROJECT_SETTING_UPDATED:
    process.env.KAFKA_PROJECT_SETTING_UPDATED_TOPIC ||
    'project.setting.updated',
  PROJECT_SETTING_DELETED:
    process.env.KAFKA_PROJECT_SETTING_DELETED_TOPIC ||
    'project.setting.deleted',

  // Project lifecycle notifications
  PROJECT_CREATED:
    process.env.KAFKA_PROJECT_CREATED_TOPIC ||
    'connect.notification.project.created',
  PROJECT_UPDATED_NOTIFICATION:
    process.env.KAFKA_PROJECT_UPDATED_NOTIFICATION_TOPIC ||
    'connect.notification.project.updated',
  PROJECT_SUBMITTED_FOR_REVIEW:
    process.env.KAFKA_PROJECT_SUBMITTED_FOR_REVIEW_TOPIC ||
    'connect.notification.project.submittedForReview',
  PROJECT_APPROVED:
    process.env.KAFKA_PROJECT_APPROVED_TOPIC ||
    'connect.notification.project.approved',
  PROJECT_PAUSED:
    process.env.KAFKA_PROJECT_PAUSED_TOPIC ||
    'connect.notification.project.paused',
  PROJECT_COMPLETED:
    process.env.KAFKA_PROJECT_COMPLETED_TOPIC ||
    'connect.notification.project.completed',
  PROJECT_CANCELED:
    process.env.KAFKA_PROJECT_CANCELED_TOPIC ||
    'connect.notification.project.canceled',
  PROJECT_ACTIVE:
    process.env.KAFKA_PROJECT_ACTIVE_TOPIC ||
    'connect.notification.project.active',
  PROJECT_SPECIFICATION_MODIFIED:
    process.env.KAFKA_PROJECT_SPECIFICATION_MODIFIED_TOPIC ||
    'connect.notification.project.updated.spec',
  PROJECT_LINK_CREATED:
    process.env.KAFKA_PROJECT_LINK_CREATED_TOPIC ||
    'connect.notification.project.linkCreated',
  PROJECT_PLAN_UPDATED:
    process.env.KAFKA_PROJECT_PLAN_UPDATED_TOPIC ||
    'connect.notification.project.plan.updated',
  PROJECT_PLAN_READY:
    process.env.KAFKA_PROJECT_PLAN_READY_TOPIC ||
    'connect.notification.project.plan.ready',
  PROJECT_BILLING_ACCOUNT_UPDATED:
    process.env.KAFKA_PROJECT_BILLING_ACCOUNT_UPDATED_TOPIC ||
    'connect.notification.project.billingAccount.updated',

  // Project member notifications
  MEMBER_JOINED:
    process.env.KAFKA_MEMBER_JOINED_TOPIC ||
    'connect.notification.project.member.joined',
  MEMBER_JOINED_COPILOT:
    process.env.KAFKA_MEMBER_JOINED_COPILOT_TOPIC ||
    'connect.notification.project.member.copilotJoined',
  MEMBER_JOINED_MANAGER:
    process.env.KAFKA_MEMBER_JOINED_MANAGER_TOPIC ||
    'connect.notification.project.member.managerJoined',
  MEMBER_LEFT:
    process.env.KAFKA_MEMBER_LEFT_TOPIC ||
    'connect.notification.project.member.left',
  MEMBER_REMOVED:
    process.env.KAFKA_MEMBER_REMOVED_TOPIC ||
    'connect.notification.project.member.removed',
  MEMBER_ASSIGNED_AS_OWNER:
    process.env.KAFKA_MEMBER_ASSIGNED_AS_OWNER_TOPIC ||
    'connect.notification.project.member.assignedAsOwner',
  PROJECT_TEAM_UPDATED:
    process.env.KAFKA_PROJECT_TEAM_UPDATED_TOPIC ||
    'connect.notification.project.team.updated',
  PROJECT_MEMBER_INVITE_SENT:
    process.env.KAFKA_PROJECT_MEMBER_INVITE_SENT_TOPIC ||
    'connect.notification.project.member.invite.sent',
  PROJECT_MEMBER_INVITE_ACCEPTED:
    process.env.KAFKA_PROJECT_MEMBER_INVITE_ACCEPTED_TOPIC ||
    'connect.notification.project.member.invite.accepted',

  // Project attachment notifications
  PROJECT_FILE_UPLOADED:
    process.env.KAFKA_PROJECT_FILE_UPLOADED_TOPIC ||
    'connect.notification.project.fileUploaded',
  PROJECT_ATTACHMENT_UPDATED_NOTIFICATION:
    process.env.KAFKA_PROJECT_ATTACHMENT_UPDATED_NOTIFICATION_TOPIC ||
    'connect.notification.project.attachment.updated',

  // Project phase notifications
  PROJECT_PHASE_TRANSITION_ACTIVE:
    process.env.KAFKA_PROJECT_PHASE_TRANSITION_ACTIVE_TOPIC ||
    'connect.notification.project.phase.transition.active',
  PROJECT_PHASE_TRANSITION_COMPLETED:
    process.env.KAFKA_PROJECT_PHASE_TRANSITION_COMPLETED_TOPIC ||
    'connect.notification.project.phase.transition.completed',
  PROJECT_PHASE_UPDATE_PAYMENT:
    process.env.KAFKA_PROJECT_PHASE_UPDATE_PAYMENT_TOPIC ||
    'connect.notification.project.phase.update.payment',
  PROJECT_PHASE_UPDATE_PROGRESS:
    process.env.KAFKA_PROJECT_PHASE_UPDATE_PROGRESS_TOPIC ||
    'connect.notification.project.phase.update.progress',
  PROJECT_PHASE_UPDATE_SCOPE:
    process.env.KAFKA_PROJECT_PHASE_UPDATE_SCOPE_TOPIC ||
    'connect.notification.project.phase.update.scope',
  PROJECT_PRODUCT_SPECIFICATION_MODIFIED:
    process.env.KAFKA_PROJECT_PRODUCT_SPECIFICATION_MODIFIED_TOPIC ||
    'connect.notification.project.product.update.spec',

  // Project work notifications
  PROJECT_WORK_TRANSITION_ACTIVE:
    process.env.KAFKA_PROJECT_WORK_TRANSITION_ACTIVE_TOPIC ||
    'connect.notification.project.work.transition.active',
  PROJECT_WORK_TRANSITION_COMPLETED:
    process.env.KAFKA_PROJECT_WORK_TRANSITION_COMPLETED_TOPIC ||
    'connect.notification.project.work.transition.completed',
  PROJECT_WORK_UPDATE_PAYMENT:
    process.env.KAFKA_PROJECT_WORK_UPDATE_PAYMENT_TOPIC ||
    'connect.notification.project.work.update.payment',
  PROJECT_WORK_UPDATE_PROGRESS:
    process.env.KAFKA_PROJECT_WORK_UPDATE_PROGRESS_TOPIC ||
    'connect.notification.project.work.update.progress',
  PROJECT_WORK_UPDATE_SCOPE:
    process.env.KAFKA_PROJECT_WORK_UPDATE_SCOPE_TOPIC ||
    'connect.notification.project.work.update.scope',
  PROJECT_WORKITEM_SPECIFICATION_MODIFIED:
    process.env.KAFKA_PROJECT_WORKITEM_SPECIFICATION_MODIFIED_TOPIC ||
    'connect.notification.project.workitem.update.spec',

  // Timeline and milestone notifications
  TIMELINE_ADJUSTED:
    process.env.KAFKA_TIMELINE_ADJUSTED_TOPIC ||
    'connect.notification.project.timeline.adjusted',
  MILESTONE_NOTIFICATION_ADDED:
    process.env.KAFKA_MILESTONE_NOTIFICATION_ADDED_TOPIC ||
    'connect.notification.project.timeline.milestone.added',
  MILESTONE_NOTIFICATION_UPDATED:
    process.env.KAFKA_MILESTONE_NOTIFICATION_UPDATED_TOPIC ||
    'connect.notification.project.timeline.milestone.updated',
  MILESTONE_NOTIFICATION_REMOVED:
    process.env.KAFKA_MILESTONE_NOTIFICATION_REMOVED_TOPIC ||
    'connect.notification.project.timeline.milestone.removed',
  MILESTONE_TRANSITION_ACTIVE:
    process.env.KAFKA_MILESTONE_TRANSITION_ACTIVE_TOPIC ||
    'connect.notification.project.timeline.milestone.transition.active',
  MILESTONE_TRANSITION_COMPLETED:
    process.env.KAFKA_MILESTONE_TRANSITION_COMPLETED_TOPIC ||
    'connect.notification.project.timeline.milestone.transition.completed',
  MILESTONE_TRANSITION_PAUSED:
    process.env.KAFKA_MILESTONE_TRANSITION_PAUSED_TOPIC ||
    'connect.notification.project.timeline.milestone.transition.paused',
  MILESTONE_WAITING_CUSTOMER:
    process.env.KAFKA_MILESTONE_WAITING_CUSTOMER_TOPIC ||
    'connect.notification.project.timeline.milestone.waiting.customer',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPIC)[keyof typeof KAFKA_TOPIC];
