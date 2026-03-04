/**
 * Kafka topic registry.
 *
 * Topic names can be overridden through environment variables.
 */
export const KAFKA_TOPIC = {
  /**
   * Project created topic.
   * Env: `KAFKA_PROJECT_CREATED_TOPIC`, default: `project.created`.
   */
  PROJECT_CREATED: process.env.KAFKA_PROJECT_CREATED_TOPIC || 'project.created',
  /**
   * Project updated topic.
   * Env: `KAFKA_PROJECT_UPDATED_TOPIC`, default: `project.updated`.
   */
  PROJECT_UPDATED: process.env.KAFKA_PROJECT_UPDATED_TOPIC || 'project.updated',
  /**
   * Project deleted topic.
   * Env: `KAFKA_PROJECT_DELETED_TOPIC`, default: `project.deleted`.
   */
  PROJECT_DELETED: process.env.KAFKA_PROJECT_DELETED_TOPIC || 'project.deleted',
  /**
   * Project member added topic.
   * Env: `KAFKA_PROJECT_MEMBER_ADDED_TOPIC`, default: `project.member.added`.
   */
  PROJECT_MEMBER_ADDED:
    process.env.KAFKA_PROJECT_MEMBER_ADDED_TOPIC || 'project.member.added',
  /**
   * Project member removed topic.
   * Env: `KAFKA_PROJECT_MEMBER_REMOVED_TOPIC`, default: `project.member.removed`.
   */
  PROJECT_MEMBER_REMOVED:
    process.env.KAFKA_PROJECT_MEMBER_REMOVED_TOPIC || 'project.member.removed',
  /**
   * Project member invite created topic.
   * Env: `KAFKA_PROJECT_MEMBER_INVITE_CREATED_TOPIC`,
   * default: `project.member.invite.created`.
   */
  PROJECT_MEMBER_INVITE_CREATED:
    process.env.KAFKA_PROJECT_MEMBER_INVITE_CREATED_TOPIC ||
    'project.member.invite.created',
  /**
   * Project member invite updated topic.
   * Env: `KAFKA_PROJECT_MEMBER_INVITE_UPDATED_TOPIC`,
   * default: `project.member.invite.updated`.
   */
  PROJECT_MEMBER_INVITE_UPDATED:
    process.env.KAFKA_PROJECT_MEMBER_INVITE_UPDATED_TOPIC ||
    'project.member.invite.updated',
  /**
   * Project member invite removed topic.
   * Env: `KAFKA_PROJECT_MEMBER_INVITE_REMOVED_TOPIC`,
   * default: `project.member.invite.deleted`.
   */
  PROJECT_MEMBER_INVITE_REMOVED:
    process.env.KAFKA_PROJECT_MEMBER_INVITE_REMOVED_TOPIC ||
    'project.member.invite.deleted',
} as const;

/**
 * Union type of all topic names in `KAFKA_TOPIC`.
 */
export type KafkaTopic = (typeof KAFKA_TOPIC)[keyof typeof KAFKA_TOPIC];
