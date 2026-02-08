import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { FormController } from './form.controller';
import { FormRevisionController } from './form-revision.controller';
import { FormVersionController } from './form-version.controller';
import { FormService } from './form.service';

@Module({
  imports: [GlobalProvidersModule],
  controllers: [FormController, FormVersionController, FormRevisionController],
  providers: [FormService],
  exports: [FormService],
})
export class FormModule {}
