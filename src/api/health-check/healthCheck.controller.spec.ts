import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { HealthCheckController } from './healthCheck.controller';

describe('HealthCheckController', () => {
  let controller: HealthCheckController;

  const prismaServiceMock = {
    project: {
      findFirst: jest.fn().mockResolvedValue({ id: BigInt(1) }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthCheckController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    controller = module.get<HealthCheckController>(HealthCheckController);
  });

  it('should return a checksRun counter', async () => {
    const result = await controller.healthCheck();

    expect(result).toEqual({ checksRun: 1 });
  });
});
