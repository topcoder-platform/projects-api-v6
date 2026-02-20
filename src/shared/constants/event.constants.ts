/**
 * Kafka event resource-type registry used in event payload envelopes.
 */
export const PROJECT_METADATA_RESOURCE = {
  /** Project template metadata updates from project-template module. */
  PROJECT_TEMPLATE: 'project.template',
  /** Product template metadata updates from product-template module. */
  PRODUCT_TEMPLATE: 'product.template',
  /** Project type metadata updates from project-type module. */
  PROJECT_TYPE: 'project.type',
  /** Product category metadata updates from product-category module. */
  PRODUCT_CATEGORY: 'product.category',
  /** Organization config metadata updates from org-config module. */
  ORG_CONFIG: 'project.orgConfig',
  /** Form-version metadata updates from project form module. */
  FORM_VERSION: 'project.form.version',
  /** Form-revision metadata updates from project form module. */
  FORM_REVISION: 'project.form.revision',
  /** Plan-config version metadata updates from planning config module. */
  PLAN_CONFIG_VERSION: 'project.planConfig.version',
  /** Plan-config revision metadata updates from planning config module. */
  PLAN_CONFIG_REVISION: 'project.planConfig.revision',
  /** Price-config version metadata updates from pricing config module. */
  PRICE_CONFIG_VERSION: 'project.priceConfig.version',
  /** Price-config revision metadata updates from pricing config module. */
  PRICE_CONFIG_REVISION: 'project.priceConfig.revision',
  /** Milestone template metadata updates from milestone-template module. */
  MILESTONE_TEMPLATE: 'milestone.template',
  /** Work-management permission metadata updates from work settings module. */
  WORK_MANAGEMENT_PERMISSION: 'project.workManagementPermission',
} as const;

/**
 * Union type of all `PROJECT_METADATA_RESOURCE` values.
 */
export type ProjectMetadataResource =
  (typeof PROJECT_METADATA_RESOURCE)[keyof typeof PROJECT_METADATA_RESOURCE];
