import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { ProjectAttachmentController } from './project-attachment.controller';
import { ProjectAttachmentService } from './project-attachment.service';

@Module({
  imports: [HttpModule, GlobalProvidersModule],
  controllers: [ProjectAttachmentController],
  providers: [ProjectAttachmentService],
  exports: [ProjectAttachmentService],
})
/**
 * NestJS feature module for project attachments. Manages file and link
 * attachments, including async S3 transfer/delete via `FileService`.
 */
export class ProjectAttachmentModule {}
