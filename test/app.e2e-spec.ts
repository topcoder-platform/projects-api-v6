import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/modules/global/prisma.service';

describe('Project Service (e2e)', () => {
  let app: INestApplication;

  const prismaServiceMock = {
    project: {
      findFirst: jest.fn().mockResolvedValue({ id: BigInt(1) }),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v6');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/v6/projects/health (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/v6/projects/health')
      .expect(200);

    expect(response.body).toHaveProperty('checksRun');
  });
});
