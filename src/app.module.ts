import { Module } from '@nestjs/common';
import { ApiModule } from './api/api.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule, ApiModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
