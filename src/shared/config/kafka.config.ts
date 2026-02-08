export const KAFKA_TOPIC = {
  PROJECT_CREATED: process.env.KAFKA_PROJECT_CREATED_TOPIC || 'project.created',
  PROJECT_UPDATED: process.env.KAFKA_PROJECT_UPDATED_TOPIC || 'project.updated',
  PROJECT_DELETED: process.env.KAFKA_PROJECT_DELETED_TOPIC || 'project.deleted',
  PROJECT_MEMBER_ADDED:
    process.env.KAFKA_PROJECT_MEMBER_ADDED_TOPIC || 'project.member.added',
  PROJECT_MEMBER_REMOVED:
    process.env.KAFKA_PROJECT_MEMBER_REMOVED_TOPIC || 'project.member.removed',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPIC)[keyof typeof KAFKA_TOPIC];
