export const PROJECT_METADATA_EVENT_TOPIC = {
  PROJECT_METADATA_CREATE:
    process.env.KAFKA_PROJECT_METADATA_CREATE_TOPIC || 'project.action.create',
  PROJECT_METADATA_UPDATE:
    process.env.KAFKA_PROJECT_METADATA_UPDATE_TOPIC || 'project.action.update',
  PROJECT_METADATA_DELETE:
    process.env.KAFKA_PROJECT_METADATA_DELETE_TOPIC || 'project.action.delete',
} as const;

export type ProjectMetadataEventTopic =
  (typeof PROJECT_METADATA_EVENT_TOPIC)[keyof typeof PROJECT_METADATA_EVENT_TOPIC];

export const PROJECT_METADATA_RESOURCE = {
  PROJECT_TEMPLATE: 'project.template',
  PRODUCT_TEMPLATE: 'product.template',
  PROJECT_TYPE: 'project.type',
  PRODUCT_CATEGORY: 'product.category',
  ORG_CONFIG: 'project.orgConfig',
  FORM_VERSION: 'project.form.version',
  FORM_REVISION: 'project.form.revision',
  PLAN_CONFIG_VERSION: 'project.planConfig.version',
  PLAN_CONFIG_REVISION: 'project.planConfig.revision',
  PRICE_CONFIG_VERSION: 'project.priceConfig.version',
  PRICE_CONFIG_REVISION: 'project.priceConfig.revision',
  MILESTONE_TEMPLATE: 'milestone.template',
  WORK_MANAGEMENT_PERMISSION: 'project.workManagementPermission',
} as const;

export type ProjectMetadataResource =
  (typeof PROJECT_METADATA_RESOURCE)[keyof typeof PROJECT_METADATA_RESOURCE];
