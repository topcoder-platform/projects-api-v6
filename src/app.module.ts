import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiModule } from './api/api.module';
import { TokenRolesGuard } from './shared/guards/tokenRoles.guard';
import { ProjectContextInterceptor } from './shared/interceptors/projectContext.interceptor';
import { GlobalProvidersModule } from './shared/modules/global/globalProviders.module';

@Module({
  imports: [GlobalProvidersModule, ApiModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: TokenRolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ProjectContextInterceptor,
    },
  ],
})
export class AppModule {}
