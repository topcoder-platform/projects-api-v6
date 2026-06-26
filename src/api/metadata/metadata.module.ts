import { Module } from '@nestjs/common';
import { FormModule } from './form/form.module';
import { MilestoneTemplateModule } from './milestone-template/milestone-template.module';
import { MetadataListController } from './metadata-list.controller';
import { MetadataListService } from './metadata-list.service';
import { OrgConfigModule } from './org-config/org-config.module';
import { PlanConfigModule } from './plan-config/plan-config.module';
import { PriceConfigModule } from './price-config/price-config.module';
import { ProductCategoryModule } from './product-category/product-category.module';
import { ProductTemplateModule } from './product-template/product-template.module';
import { ProjectTemplateModule } from './project-template/project-template.module';
import { ProjectTypeModule } from './project-type/project-type.module';
import { WorkManagementPermissionModule } from './work-management-permission/work-management-permission.module';

/**
 * Aggregates all metadata sub-modules used by the projects API.
 *
 * Imported modules:
 * - `ProjectTemplateModule`: project-level template definitions.
 * - `ProductTemplateModule`: product/work-item template definitions.
 * - `ProjectTypeModule`: project type catalogs.
 * - `ProductCategoryModule`: product category catalogs.
 * - `MilestoneTemplateModule`: milestone template catalogs.
 * - `OrgConfigModule`: organization-level config entries.
 * - `FormModule`: versioned form definitions.
 * - `PlanConfigModule`: versioned plan configuration definitions.
 * - `PriceConfigModule`: versioned pricing configuration definitions.
 * - `WorkManagementPermissionModule`: permission policy records by template.
 *
 * It also registers `MetadataListController` and `MetadataListService` for the
 * consolidated metadata list endpoint.
 */
@Module({
  imports: [
    ProjectTemplateModule,
    ProductTemplateModule,
    ProjectTypeModule,
    ProductCategoryModule,
    MilestoneTemplateModule,
    OrgConfigModule,
    FormModule,
    PlanConfigModule,
    PriceConfigModule,
    WorkManagementPermissionModule,
  ],
  controllers: [MetadataListController],
  providers: [MetadataListService],
})
export class MetadataModule {}
