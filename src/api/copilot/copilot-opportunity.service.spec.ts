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

  const copilotUser: JwtUser = {
    userId: '4001',
    roles: [UserRole.TC_COPILOT],
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

  it('includes project metadata without member ids for project managers', async () => {
    prismaMock.copilotOpportunity.findFirst.mockResolvedValue(baseOpportunity);

    const response = await service.getOpportunity('21', pmUser);

    expect(response.projectId).toBe('100');
    expect(response.project).toEqual({
      name: 'Demo Project',
    });
    expect(response).not.toHaveProperty('members');
    expect(response.canApplyAsCopilot).toBe(false);
    expect(prismaMock.projectMember.findMany).not.toHaveBeenCalled();
  });

  it('omits project member ids and disables apply for non-copilot users', async () => {
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
    expect(response).not.toHaveProperty('members');
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
    expect(prismaMock.projectMember.findMany).not.toHaveBeenCalled();
  });

  it('disables apply for anonymous callers without loading membership data', async () => {
    prismaMock.copilotOpportunity.findFirst.mockResolvedValue(baseOpportunity);

    const response = await service.getOpportunity('21', undefined);

    expect(response.canApplyAsCopilot).toBe(false);
    expect(response).not.toHaveProperty('members');
    expect(response).not.toHaveProperty('hasApplied');
    expect(prismaMock.projectMember.findMany).not.toHaveBeenCalled();
    expect(prismaMock.copilotOpportunity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          project: false,
          applications: false,
        }),
      }),
    );
  });

  it('enables apply only for an eligible copilot without membership or an application', async () => {
    prismaMock.copilotOpportunity.findFirst.mockResolvedValue(baseOpportunity);

    const response = await service.getOpportunity('21', copilotUser);

    expect(response.canApplyAsCopilot).toBe(true);
    expect(response.hasApplied).toBe(false);
    expect(prismaMock.projectMember.findMany).toHaveBeenCalledWith({
      where: {
        userId: BigInt(4001),
        projectId: { in: [BigInt(100)] },
        deletedAt: null,
      },
      select: { projectId: true },
    });
  });

  it('disables apply for a copilot who is already a project member', async () => {
    prismaMock.copilotOpportunity.findFirst.mockResolvedValue(baseOpportunity);
    prismaMock.projectMember.findMany.mockResolvedValue([
      { projectId: BigInt(100) },
    ]);

    const response = await service.getOpportunity('21', copilotUser);

    expect(response.canApplyAsCopilot).toBe(false);
  });

  it('disables apply for a copilot who already has an application', async () => {
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

    const response = await service.getOpportunity('21', copilotUser);

    expect(response.canApplyAsCopilot).toBe(false);
    expect(response.hasApplied).toBe(true);
  });

  it('allow-lists request JSON and assigns trusted opportunity fields last', async () => {
    prismaMock.copilotOpportunity.findFirst.mockResolvedValue({
      ...baseOpportunity,
      copilotRequest: {
        data: {
          opportunityTitle: 'Safe public title',
          overview: 'Safe public overview',
          projectId: '999',
          id: 'spoofed-id',
          status: CopilotOpportunityStatus.completed,
          type: CopilotOpportunityType.design,
          createdAt: 'spoofed-date',
          canApplyAsCopilot: false,
          members: ['private-member-id'],
          project: { name: 'Spoofed project' },
          secretAccountId: 'private-account',
        },
      },
    });

    const response = await service.getOpportunity('21', copilotUser);

    expect(response).toMatchObject({
      id: '21',
      status: CopilotOpportunityStatus.active,
      type: CopilotOpportunityType.dev,
      createdAt: baseOpportunity.createdAt,
      opportunityTitle: 'Safe public title',
      overview: 'Safe public overview',
      canApplyAsCopilot: true,
    });
    expect(response).not.toHaveProperty('projectId');
    expect(response).not.toHaveProperty('members');
    expect(response).not.toHaveProperty('secretAccountId');
    expect(response).not.toHaveProperty('project');
  });

  it('includes nested project metadata in list results for project managers', async () => {
    prismaMock.copilotOpportunity.findMany.mockResolvedValue([baseOpportunity]);

    const response = await service.listOpportunities({}, pmUser);

    expect(response.data).toHaveLength(1);
    expect(response.data[0].projectId).toBe('100');
    expect(response.data[0].project).toEqual({
      name: 'Demo Project',
    });
    expect(response.data[0].canApplyAsCopilot).toBe(false);
    expect(response.data[0]).not.toHaveProperty('members');
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

  it('casts legacy JSON request data before search and skill JSONB operations', async () => {
    prismaMock.copilotOpportunity.findMany.mockResolvedValue([baseOpportunity]);

    await service.listOpportunities(
      {
        search: 'Cadence SKILL',
        skills: ['Cadence SKILL'],
      },
      regularUser,
    );

    const sql = prismaMock.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.text).toContain(
      "LOWER(COALESCE(r.data::jsonb -> 'skills', '[]'::jsonb)::text)",
    );
    expect(sql.text).toContain(
      "WHEN jsonb_typeof(r.data::jsonb -> 'skills') = 'array'",
    );
    expect(sql.text).toContain("THEN r.data::jsonb -> 'skills'");
    expect(sql.values).toEqual(
      expect.arrayContaining(['%cadence skill%', 'cadence skill']),
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
