import { Global, Module } from '@nestjs/common';
import { PolicyService } from './permissions/policy.service';

@Module({
  imports: [],
  providers: [
    PolicyService,
  ],
  exports: [
    PolicyService,
  ],
})
export class AuthModule {}
