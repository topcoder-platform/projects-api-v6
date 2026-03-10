import {
  CopilotOpportunityStatus,
  CopilotOpportunityType,
} from '@prisma/client';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { CopilotOpportunityService } from './copilot-opportunity.service';

describe('CopilotOpportunityService', () => {
  const prismaMock = {
    copilotOpportunity: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    projectMember: {
      findMany: jest.fn(),
    },
  };

  const permissionServiceMock = {};
  const notificationServiceMock = {};

  const pmUser: JwtUser = {
    userId: '1001',
    roles: [UserRole.PROJECT_MANAGER],
    isMachine: false,
  };

  const regularUser: JwtUser = {
    userId: '3001',
    roles: [UserRole.TOPCODER_USER],
    isMachine: false,
  };

  const baseOpportunity = {
    id: BigInt(21),
    projectId: BigInt(100),
    copilotRequestId: BigInt(11),
    status: CopilotOpportunityStatus.active,
    type: CopilotOpportunityType.dev,
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-02T00:00:00.000Z'),
    copilotRequest: {
      data: {
        opportunityTitle: 'Need a dev copilot',
        projectType: 'dev',
      },
    },
    project: {
      id: BigInt(100),
      name: 'Demo Project',
      members: [
        {
          userId: BigInt(3001),
        },
      ],
    },
  };

  let service: CopilotOpportunityService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.projectMember.findMany.mockResolvedValue([]);
    service = new CopilotOpportunityService(
      prismaMock as any,
      permissionServiceMock as any,
      notificationServiceMock as any,
    );
  });

  it('includes nested project metadata for project managers when fetching one opportunity', async () => {
    prismaMock.copilotOpportunity.findFirst.mockResolvedValue(baseOpportunity);

    const response = await service.getOpportunity('21', pmUser);

    expect(response.projectId).toBe('100');
    expect(response.project).toEqual({
      name: 'Demo Project',
    });
    expect(response.members).toEqual(['3001']);
    expect(response.canApplyAsCopilot).toBe(true);
  });

  it('omits nested project metadata for regular users while preserving membership eligibility checks', async () => {
    prismaMock.copilotOpportunity.findFirst.mockResolvedValue(baseOpportunity);

    const response = await service.getOpportunity('21', regularUser);

    expect(response.projectId).toBeUndefined();
    expect(response.project).toBeUndefined();
    expect(response.members).toEqual(['3001']);
    expect(response.canApplyAsCopilot).toBe(false);
  });

  it('includes nested project metadata in list results for project managers', async () => {
    prismaMock.copilotOpportunity.findMany.mockResolvedValue([baseOpportunity]);

    const response = await service.listOpportunities({}, pmUser);

    expect(response.data).toHaveLength(1);
    expect(response.data[0].projectId).toBe('100');
    expect(response.data[0].project).toEqual({
      name: 'Demo Project',
    });
  });
});
