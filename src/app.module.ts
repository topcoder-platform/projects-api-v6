import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ApiModule } from './api/api.module';
import { SharedModule } from './shared/shared.module';
import { AuthMiddleware } from './auth/auth.middleware';

@Module({
  imports: [SharedModule, ApiModule],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
