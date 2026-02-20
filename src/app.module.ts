import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiModule } from './api/api.module';
import { TokenRolesGuard } from './shared/guards/tokenRoles.guard';
import { ProjectContextInterceptor } from './shared/interceptors/projectContext.interceptor';
import { GlobalProvidersModule } from './shared/modules/global/globalProviders.module';

/**
 * Root application module for the Topcoder Project API v6.
 *
 * Responsibilities:
 * - Imports GlobalProvidersModule to register all shared, globally-scoped
 *   providers (Prisma, JWT, M2M, Logger, EventBus, shared services).
 * - Imports ApiModule which aggregates every feature module (Project,
 *   ProjectMember, ProjectInvite, ProjectPhase, PhaseProduct,
 *   ProjectAttachment, ProjectSetting, Copilot, Metadata, HealthCheck).
 * - Registers TokenRolesGuard as the application-wide AUTH guard via
 *   APP_GUARD, so every route is protected unless decorated with @Public().
 * - Registers ProjectContextInterceptor as the application-wide interceptor
 *   via APP_INTERCEPTOR to enrich request context with resolved project data.
 *
 * Usage: passed directly to NestFactory.create() in main.ts.
 */
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
