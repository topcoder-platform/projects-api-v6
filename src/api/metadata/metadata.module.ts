import { Module } from '@nestjs/common';
import { FormModule } from './form/form.module';
import { MetadataListController } from './metadata-list.controller';
import { MetadataListService } from './metadata-list.service';
import { MilestoneTemplateModule } from './milestone-template/milestone-template.module';
import { OrgConfigModule } from './org-config/org-config.module';
import { PlanConfigModule } from './plan-config/plan-config.module';
import { PriceConfigModule } from './price-config/price-config.module';
import { ProductCategoryModule } from './product-category/product-category.module';
import { ProductTemplateModule } from './product-template/product-template.module';
import { ProjectTemplateModule } from './project-template/project-template.module';
import { ProjectTypeModule } from './project-type/project-type.module';
import { WorkManagementPermissionModule } from './work-management-permission/work-management-permission.module';

@Module({
  imports: [
    ProjectTemplateModule,
    ProductTemplateModule,
    ProjectTypeModule,
    ProductCategoryModule,
    OrgConfigModule,
    FormModule,
    PlanConfigModule,
    PriceConfigModule,
    MilestoneTemplateModule,
    WorkManagementPermissionModule,
  ],
  controllers: [MetadataListController],
  providers: [MetadataListService],
})
export class MetadataModule {}
