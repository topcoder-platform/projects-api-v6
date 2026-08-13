import {
  CopilotApplicationStatus,
  CopilotOpportunityStatus,
  CopilotOpportunityType,
  Prisma,
} from '@prisma/client';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { CopilotOpportunityService } from './copilot-opportunity.service';

describe('CopilotOpportunityService', () => {
  const prismaMock = {
    $queryRaw: jest.fn(),
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
    prismaMock.$queryRaw.mockResolvedValue([{ ids: ['21'], total: BigInt(1) }]);
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
    prismaMock.copilotOpportunity.findFirst.mockResolvedValue({
      ...baseOpportunity,
      applications: [
        {
          id: BigInt(31),
          status: CopilotApplicationStatus.pending,
          createdAt: new Date('2026-03-03T00:00:00.000Z'),
          updatedAt: new Date('2026-03-03T01:00:00.000Z'),
        },
      ],
    });

    const response = await service.getOpportunity('21', regularUser);

    expect(response.projectId).toBeUndefined();
    expect(response.project).toBeUndefined();
    expect(response.members).toEqual(['3001']);
    expect(response.canApplyAsCopilot).toBe(false);
    expect(response.hasApplied).toBe(true);
    expect(response.currentUserApplication).toMatchObject({
      id: '31',
      status: CopilotApplicationStatus.pending,
    });
    expect(prismaMock.copilotOpportunity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          applications: expect.objectContaining({
            where: expect.objectContaining({ userId: BigInt(3001) }),
          }),
        }),
      }),
    );
  });

  it('includes nested project metadata in list results for project managers', async () => {
    prismaMock.copilotOpportunity.findMany.mockResolvedValue([baseOpportunity]);

    const response = await service.listOpportunities({}, pmUser);

    expect(response.data).toHaveLength(1);
    expect(response.data[0].projectId).toBe('100');
    expect(response.data[0].project).toEqual({
      name: 'Demo Project',
    });
    expect(response.total).toBe(1);
    expect(prismaMock.copilotOpportunity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [BigInt(21)] },
        }),
      }),
    );
  });

  it('filters, sorts, and paginates opportunity discovery in the database', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { ids: ['21'], total: BigInt(12) },
    ]);
    prismaMock.copilotOpportunity.findMany.mockResolvedValue([
      {
        ...baseOpportunity,
        applications: [
          {
            id: BigInt(31),
            status: CopilotApplicationStatus.pending,
            createdAt: new Date('2026-03-03T00:00:00.000Z'),
            updatedAt: new Date('2026-03-03T01:00:00.000Z'),
          },
        ],
      },
    ]);

    const response = await service.listOpportunities(
      {
        page: 2,
        pageSize: 5,
        search: 'Node_100%',
        status: [CopilotOpportunityStatus.active],
        projectId: '100',
        type: [CopilotOpportunityType.dev],
        skills: ['Node.js', 'React'],
        startDateFrom: '2026-03-01',
        startDateTo: '2026-04-30',
        createdAtFrom: '2026-02-01',
        createdAtTo: '2026-05-31',
        applied: true,
        applicationStatus: [CopilotApplicationStatus.pending],
        noGrouping: true,
        sort: 'projectName asc',
      },
      regularUser,
    );

    expect(response).toMatchObject({
      page: 2,
      perPage: 5,
      total: 12,
      data: [
        {
          id: '21',
          hasApplied: true,
          currentUserApplication: {
            id: '31',
            status: CopilotApplicationStatus.pending,
          },
        },
      ],
    });

    const sql = prismaMock.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.text).toContain('jsonb_array_elements');
    expect(sql.text).toContain('FROM "copilot_applications" a');
    expect(sql.text).toContain('ORDER BY NULLIF(LOWER(f."projectName"), \'\')');
    expect(sql.text).not.toContain('CASE f.status::text');
    expect(sql.values).toEqual(
      expect.arrayContaining([
        CopilotOpportunityStatus.active,
        CopilotOpportunityType.dev,
        BigInt(100),
        '%node\\_100\\%%',
        'node.js',
        'react',
        BigInt(3001),
        CopilotApplicationStatus.pending,
        5,
      ]),
    );
    expect(sql.values[sql.values.length - 1]).toBe(5);
  });

  it('retains default status grouping while accepting legacy aliases', async () => {
    prismaMock.copilotOpportunity.findMany.mockResolvedValue([baseOpportunity]);

    await service.listOpportunities(
      {
        perPage: 10,
        keyword: 'copilot',
        projectType: [CopilotOpportunityType.dev],
        skill: ['Node.js'],
        myApplications: true,
      },
      regularUser,
    );

    const sql = prismaMock.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.text).toContain('CASE f.status::text');
    expect(sql.values).toEqual(
      expect.arrayContaining(['%copilot%', 'node.js', BigInt(3001), 10]),
    );
  });

  it('requires authentication for current-user application filters', async () => {
    await expect(
      service.listOpportunities({ applied: true }, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('filters out the current user applications with applied=false', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ ids: [], total: BigInt(0) }]);

    const response = await service.listOpportunities(
      { applied: false },
      regularUser,
    );

    const sql = prismaMock.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.text).toContain('NOT (');
    expect(sql.text).toContain('FROM "copilot_applications" a');
    expect(sql.values).toContain(BigInt(3001));
    expect(response).toMatchObject({ data: [], total: 0 });
    expect(prismaMock.copilotOpportunity.findMany).not.toHaveBeenCalled();
  });

  it('rejects inverted date ranges before querying the database', async () => {
    await expect(
      service.listOpportunities(
        {
          startDateFrom: '2026-05-01',
          startDateTo: '2026-04-01',
        },
        regularUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});
