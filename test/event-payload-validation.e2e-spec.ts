import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CopilotOpportunityStatus,
  CopilotOpportunityType,
  CopilotRequestStatus,
  InviteStatus,
  ProjectMemberRole,
  ProjectStatus,
} from '@prisma/client';
import * as request from 'supertest';
import { requestFixtures } from './fixtures/requests';

interface CapturedBusEvent {
  topic: string;
  originator: string;
  timestamp: string;
  'mime-type': string;
  payload: unknown;
}

interface ComparableEvent {
  topic: string;
  originator: string;
  payload: Record<string, unknown>;
}

const SNAPSHOT_DIR = path.join(
  __dirname,
  'fixtures',
  'event-payload-snapshots',
);
const RESOURCE_DATA_KEYS = [
  'id',
  'projectId',
  'status',
  'name',
  'role',
  'userId',
  'copilotRequestId',
];
const NOTIFICATION_KEYS = [
  'projectId',
  'projectName',
  'projectUrl',
  'userId',
  'initiatorUserId',
  'inviteId',
  'memberId',
  'role',
];

const tokenUsers: Record<string, Record<string, unknown>> = {
  'manager-token': {
    userId: '1001',
    roles: ['Project Manager'],
    isMachine: false,
  },
};

const capturedEvents: CapturedBusEvent[] = [];
const postEventMock = jest.fn((event: CapturedBusEvent) => {
  capturedEvents.push(event);
  return Promise.resolve({});
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toSerializable(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toSerializable(entry));
  }

  if (isRecord(value)) {
    const output: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      output[key] = toSerializable(entry);
    }

    return output;
  }

  return value;
}

function pickKeys(
  source: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      output[key] = source[key];
    }
  }

  return output;
}

function summarizePhasePayload(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return pickKeys(value, ['id', 'projectId', 'status', 'name']);
}

function summarizePayload(payload: unknown): Record<string, unknown> {
  const normalized = toSerializable(payload);

  if (!isRecord(normalized)) {
    return {
      value: normalized,
    };
  }

  if (typeof normalized.resource === 'string') {
    return {
      resource: normalized.resource,
      data: isRecord(normalized.data)
        ? pickKeys(normalized.data, RESOURCE_DATA_KEYS)
        : {},
    };
  }

  const output = pickKeys(normalized, NOTIFICATION_KEYS);

  const originalPhase = summarizePhasePayload(normalized.originalPhase);
  if (originalPhase) {
    output.originalPhase = originalPhase;
  }

  const updatedPhase = summarizePhasePayload(normalized.updatedPhase);
  if (updatedPhase) {
    output.updatedPhase = updatedPhase;
  }

  const phase = summarizePhasePayload(normalized.phase);
  if (phase) {
    output.phase = phase;
  }

  if (Object.keys(output).length > 0) {
    return output;
  }

  return normalized;
}

function normalizeEvents(events: CapturedBusEvent[]): ComparableEvent[] {
  return events.map((event) => ({
    topic: event.topic,
    originator: event.originator,
    payload: summarizePayload(event.payload),
  }));
}

function readSnapshot(fileName: string): ComparableEvent[] {
  const filePath = path.join(SNAPSHOT_DIR, fileName);
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as ComparableEvent[];
}

function assertSnapshot(fileName: string): void {
  expect(normalizeEvents(capturedEvents)).toEqual(readSnapshot(fileName));
}

function readId(payload: unknown): string {
  if (!isRecord(payload)) {
    throw new Error('Expected object response with id field.');
  }

  const id = payload.id;

  if (typeof id === 'string') {
    return id;
  }

  if (typeof id === 'number') {
    return String(id);
  }

  throw new Error('Expected id field in response payload.');
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForEventCount(expectedCount: number): Promise<void> {
  const startedAt = Date.now();
  const timeoutMs = 2000;

  while (Date.now() - startedAt < timeoutMs) {
    if (capturedEvents.length >= expectedCount) {
      return;
    }

    await delay(10);
  }

  throw new Error(
    `Timed out waiting for ${expectedCount} events. Captured ${capturedEvents.length}.`,
  );
}

function createPrismaServiceMock(): {
  prisma: Record<string, unknown>;
  reset: () => void;
} {
  const baseTimestamp = new Date('2026-01-01T00:00:00.000Z').getTime();

  let timeCursor = 0;
  let nextProjectId = BigInt(2001);
  let nextMemberId = BigInt(5002);
  let nextOpportunityId = BigInt(8101);

  let projects: Array<Record<string, any>> = [];
  let projectMembers: Array<Record<string, any>> = [];
  let projectInvites: Array<Record<string, any>> = [];
  let projectPhases: Array<Record<string, any>> = [];
  let copilotRequests: Array<Record<string, any>> = [];
  let copilotOpportunities: Array<Record<string, any>> = [];

  const nextDate = (): Date => {
    const value = new Date(baseTimestamp + timeCursor * 1000);
    timeCursor += 1;
    return value;
  };

  const toBigInt = (value: unknown): bigint | null => {
    if (typeof value === 'bigint') {
      return value;
    }

    if (typeof value === 'number' && Number.isInteger(value)) {
      return BigInt(value);
    }

    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return BigInt(value);
    }

    return null;
  };

  const clone = <T>(value: T): T => structuredClone(value);

  const enrichProject = (project: Record<string, any>): Record<string, any> => {
    return clone({
      ...project,
      members: projectMembers.filter(
        (member) =>
          member.projectId === project.id && member.deletedAt === null,
      ),
      invites: projectInvites.filter(
        (invite) =>
          invite.projectId === project.id && invite.deletedAt === null,
      ),
      attachments: [],
      phases: projectPhases.filter(
        (phase) => phase.projectId === project.id && phase.deletedAt === null,
      ),
    });
  };

  const enrichPhase = (phase: Record<string, any>): Record<string, any> => {
    return clone({
      ...phase,
      products: [],
      members: [],
      approvals: [],
    });
  };

  const findProjectById = (
    idValue: unknown,
  ): Record<string, any> | undefined => {
    const parsedId = toBigInt(idValue);

    if (parsedId === null) {
      return undefined;
    }

    return projects.find((project) => project.id === parsedId);
  };

  const findInviteById = (
    idValue: unknown,
  ): Record<string, any> | undefined => {
    const parsedId = toBigInt(idValue);

    if (parsedId === null) {
      return undefined;
    }

    return projectInvites.find((invite) => invite.id === parsedId);
  };

  const findPhaseById = (idValue: unknown): Record<string, any> | undefined => {
    const parsedId = toBigInt(idValue);

    if (parsedId === null) {
      return undefined;
    }

    return projectPhases.find((phase) => phase.id === parsedId);
  };

  const findCopilotRequestById = (
    idValue: unknown,
  ): Record<string, any> | undefined => {
    const parsedId = toBigInt(idValue);

    if (parsedId === null) {
      return undefined;
    }

    return copilotRequests.find((entry) => entry.id === parsedId);
  };

  const reset = (): void => {
    timeCursor = 0;
    nextProjectId = BigInt(2001);
    nextMemberId = BigInt(5002);
    nextOpportunityId = BigInt(8101);

    projects = [
      {
        id: BigInt(1001),
        name: 'fixture-v6-existing-project',
        description: 'Existing project for event validation flow',
        type: 'app',
        status: ProjectStatus.draft,
        billingAccountId: null,
        directProjectId: null,
        estimatedPrice: null,
        actualPrice: null,
        terms: ['standard'],
        groups: ['fixtures'],
        external: null,
        bookmarks: null,
        utm: null,
        details: {
          seededBy: 'event-validation',
        },
        challengeEligibility: null,
        templateId: BigInt(67),
        version: 'v3',
        lastActivityAt: nextDate(),
        lastActivityUserId: '1001',
        createdAt: nextDate(),
        updatedAt: nextDate(),
        deletedAt: null,
        deletedBy: null,
        createdBy: 1001,
        updatedBy: 1001,
      },
    ];

    projectMembers = [
      {
        id: BigInt(5001),
        projectId: BigInt(1001),
        userId: BigInt(1001),
        role: ProjectMemberRole.manager,
        isPrimary: true,
        createdAt: nextDate(),
        updatedAt: nextDate(),
        deletedAt: null,
        deletedBy: null,
        createdBy: 1001,
        updatedBy: 1001,
      },
    ];

    projectInvites = [
      {
        id: BigInt(7001),
        projectId: BigInt(1001),
        userId: BigInt(2001),
        email: null,
        role: ProjectMemberRole.copilot,
        status: InviteStatus.pending,
        applicationId: null,
        createdAt: nextDate(),
        updatedAt: nextDate(),
        deletedAt: null,
        deletedBy: null,
        createdBy: 1001,
        updatedBy: 1001,
      },
    ];

    projectPhases = [
      {
        id: BigInt(5001),
        projectId: BigInt(1001),
        name: 'Discovery',
        description: 'Discovery phase',
        requirements: null,
        status: ProjectStatus.active,
        startDate: null,
        endDate: null,
        duration: null,
        budget: null,
        spentBudget: null,
        progress: null,
        details: {
          stage: 'discovery',
        },
        order: 1,
        createdAt: nextDate(),
        updatedAt: nextDate(),
        deletedAt: null,
        deletedBy: null,
        createdBy: 1001,
        updatedBy: 1001,
      },
    ];

    copilotRequests = [
      {
        id: BigInt(9001),
        projectId: BigInt(1001),
        status: CopilotRequestStatus.new,
        data: {
          projectId: 1001,
          projectType: CopilotOpportunityType.dev,
          opportunityTitle: 'Need migration copilot',
        },
        createdAt: nextDate(),
        updatedAt: nextDate(),
        deletedAt: null,
        deletedBy: null,
        createdBy: 1001,
        updatedBy: 1001,
      },
    ];

    copilotOpportunities = [];
  };

  reset();

  const projectModel = {
    findFirst: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const project =
        typeof where.id !== 'undefined'
          ? findProjectById(where.id)
          : projects.find((entry) => entry.deletedAt === null);

      if (!project) {
        return null;
      }

      if (where.deletedAt === null && project.deletedAt !== null) {
        return null;
      }

      return enrichProject(project);
    }),
    create: jest.fn((args: Record<string, any>) => {
      const data = args?.data || {};

      const created = {
        id: nextProjectId,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        status: data.status,
        billingAccountId: data.billingAccountId ?? null,
        directProjectId: data.directProjectId ?? null,
        estimatedPrice: data.estimatedPrice ?? null,
        actualPrice: data.actualPrice ?? null,
        terms: data.terms ?? [],
        groups: data.groups ?? [],
        external: data.external ?? null,
        bookmarks: data.bookmarks ?? null,
        utm: data.utm ?? null,
        details: data.details ?? null,
        challengeEligibility: data.challengeEligibility ?? null,
        templateId: data.templateId ?? null,
        version: data.version || 'v3',
        lastActivityAt: data.lastActivityAt || nextDate(),
        lastActivityUserId: data.lastActivityUserId || '1001',
        createdAt: nextDate(),
        updatedAt: nextDate(),
        deletedAt: null,
        deletedBy: null,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      };

      projects.push(created);
      nextProjectId += BigInt(1);

      return clone(created);
    }),
    update: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const data = args?.data || {};
      const project = findProjectById(where.id);

      if (!project) {
        throw new Error('Project not found');
      }

      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'undefined') {
          project[key] = value;
        }
      }

      project.updatedAt = nextDate();

      return clone(project);
    }),
  };

  const projectTypeModel = {
    findFirst: jest.fn((args: Record<string, any>) => {
      const key = args?.where?.key;
      if (key === 'app') {
        return { key: 'app' };
      }

      return null;
    }),
  };

  const projectTemplateModel = {
    findFirst: jest.fn(() => null),
  };

  const projectHistoryModel = {
    create: jest.fn(() => ({ id: BigInt(1) })),
  };

  const projectMemberModel = {
    findMany: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const projectId = toBigInt(where.projectId);
      const userId = toBigInt(where.userId);

      return clone(
        projectMembers.filter((member) => {
          if (projectId !== null && member.projectId !== projectId) {
            return false;
          }

          if (userId !== null && member.userId !== userId) {
            return false;
          }

          if (where.deletedAt === null && member.deletedAt !== null) {
            return false;
          }

          return true;
        }),
      );
    }),
    findFirst: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const projectId = toBigInt(where.projectId);
      const userId = toBigInt(where.userId);

      const found =
        projectMembers.find((member) => {
          if (projectId !== null && member.projectId !== projectId) {
            return false;
          }

          if (userId !== null && member.userId !== userId) {
            return false;
          }

          if (where.deletedAt === null && member.deletedAt !== null) {
            return false;
          }

          return true;
        }) || null;

      return clone(found);
    }),
    create: jest.fn((args: Record<string, any>) => {
      const data = args?.data || {};

      const created = {
        id: nextMemberId,
        projectId: data.projectId,
        userId: data.userId,
        role: data.role,
        isPrimary: Boolean(data.isPrimary),
        createdAt: nextDate(),
        updatedAt: nextDate(),
        deletedAt: null,
        deletedBy: null,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      };

      projectMembers.push(created);
      nextMemberId += BigInt(1);

      return clone(created);
    }),
    createMany: jest.fn((args: Record<string, any>) => {
      const data = Array.isArray(args?.data) ? args.data : [];

      for (const entry of data) {
        projectMembers.push({
          id: nextMemberId,
          projectId: entry.projectId,
          userId: entry.userId,
          role: entry.role,
          isPrimary: Boolean(entry.isPrimary),
          createdAt: nextDate(),
          updatedAt: nextDate(),
          deletedAt: null,
          deletedBy: null,
          createdBy: entry.createdBy,
          updatedBy: entry.updatedBy,
        });

        nextMemberId += BigInt(1);
      }

      return {
        count: data.length,
      };
    }),
  };

  const projectMemberInviteModel = {
    findMany: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const projectId = toBigInt(where.projectId);

      return clone(
        projectInvites.filter((invite) => {
          if (projectId !== null && invite.projectId !== projectId) {
            return false;
          }

          if (where.deletedAt === null && invite.deletedAt !== null) {
            return false;
          }

          return true;
        }),
      );
    }),
    findFirst: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const inviteId = toBigInt(where.id);
      const projectId = toBigInt(where.projectId);
      const allowedStatuses = Array.isArray(where.status?.in)
        ? where.status.in
        : undefined;

      const found =
        projectInvites.find((invite) => {
          if (inviteId !== null && invite.id !== inviteId) {
            return false;
          }

          if (projectId !== null && invite.projectId !== projectId) {
            return false;
          }

          if (where.deletedAt === null && invite.deletedAt !== null) {
            return false;
          }

          if (allowedStatuses && !allowedStatuses.includes(invite.status)) {
            return false;
          }

          return true;
        }) || null;

      return clone(found);
    }),
    update: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const data = args?.data || {};
      const invite = findInviteById(where.id);

      if (!invite) {
        throw new Error('Invite not found');
      }

      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'undefined') {
          invite[key] = value;
        }
      }

      invite.updatedAt = nextDate();

      return clone(invite);
    }),
    updateMany: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const data = args?.data || {};
      const applicationIds = Array.isArray(where.applicationId?.in)
        ? where.applicationId.in.map((value: unknown) => toBigInt(value))
        : [];
      const statusFilter = Array.isArray(where.status?.in)
        ? where.status.in
        : undefined;

      let count = 0;

      for (const invite of projectInvites) {
        if (
          applicationIds.length > 0 &&
          !applicationIds.some(
            (id) => id !== null && invite.applicationId === id,
          )
        ) {
          continue;
        }

        if (statusFilter && !statusFilter.includes(invite.status)) {
          continue;
        }

        for (const [key, value] of Object.entries(data)) {
          if (typeof value !== 'undefined') {
            invite[key] = value;
          }
        }

        invite.updatedAt = nextDate();
        count += 1;
      }

      return {
        count,
      };
    }),
  };

  const projectPhaseModel = {
    findFirst: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const phaseId = toBigInt(where.id);
      const projectId = toBigInt(where.projectId);

      const found =
        projectPhases.find((phase) => {
          if (phaseId !== null && phase.id !== phaseId) {
            return false;
          }

          if (projectId !== null && phase.projectId !== projectId) {
            return false;
          }

          if (where.deletedAt === null && phase.deletedAt !== null) {
            return false;
          }

          return true;
        }) || null;

      return clone(found);
    }),
    update: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const data = args?.data || {};
      const phase = findPhaseById(where.id);

      if (!phase) {
        throw new Error('Phase not found');
      }

      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'undefined') {
          phase[key] = value;
        }
      }

      phase.updatedAt = nextDate();

      return enrichPhase(phase);
    }),
  };

  const copilotRequestModel = {
    findFirst: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};

      if (typeof where.id !== 'undefined') {
        const request = findCopilotRequestById(where.id);
        if (!request) {
          return null;
        }

        if (where.deletedAt === null && request.deletedAt !== null) {
          return null;
        }

        return clone(request);
      }

      return null;
    }),
    findMany: jest.fn(() => []),
    update: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const data = args?.data || {};
      const requestEntry = findCopilotRequestById(where.id);

      if (!requestEntry) {
        throw new Error('Copilot request not found');
      }

      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'undefined') {
          requestEntry[key] = value;
        }
      }

      requestEntry.updatedAt = nextDate();

      return clone(requestEntry);
    }),
    updateMany: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const data = args?.data || {};
      const ids = Array.isArray(where.id?.in)
        ? where.id.in.map((value: unknown) => toBigInt(value))
        : [];

      let count = 0;

      for (const requestEntry of copilotRequests) {
        if (ids.length > 0 && !ids.some((id) => id === requestEntry.id)) {
          continue;
        }

        for (const [key, value] of Object.entries(data)) {
          if (typeof value !== 'undefined') {
            requestEntry[key] = value;
          }
        }

        requestEntry.updatedAt = nextDate();
        count += 1;
      }

      return {
        count,
      };
    }),
  };

  const copilotOpportunityModel = {
    findFirst: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const id = toBigInt(where.id);
      const projectId = toBigInt(where.projectId);

      const found =
        copilotOpportunities.find((opportunity) => {
          if (id !== null && opportunity.id !== id) {
            return false;
          }

          if (projectId !== null && opportunity.projectId !== projectId) {
            return false;
          }

          if (where.type && opportunity.type !== where.type) {
            return false;
          }

          if (where.status && opportunity.status !== where.status) {
            return false;
          }

          if (where.deletedAt === null && opportunity.deletedAt !== null) {
            return false;
          }

          return true;
        }) || null;

      return clone(found);
    }),
    findMany: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const requestIds = Array.isArray(where.copilotRequestId?.in)
        ? where.copilotRequestId.in.map((value: unknown) => toBigInt(value))
        : [];

      return clone(
        copilotOpportunities.filter((opportunity) => {
          if (
            requestIds.length > 0 &&
            !requestIds.some(
              (requestId) =>
                requestId !== null &&
                opportunity.copilotRequestId === requestId,
            )
          ) {
            return false;
          }

          return true;
        }),
      );
    }),
    create: jest.fn((args: Record<string, any>) => {
      const data = args?.data || {};

      const created = {
        id: nextOpportunityId,
        projectId: data.projectId,
        copilotRequestId: data.copilotRequestId,
        status: data.status || CopilotOpportunityStatus.active,
        type: data.type,
        createdAt: nextDate(),
        updatedAt: nextDate(),
        deletedAt: null,
        deletedBy: null,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      };

      copilotOpportunities.push(created);
      nextOpportunityId += BigInt(1);

      return clone(created);
    }),
    updateMany: jest.fn((args: Record<string, any>) => {
      const where = args?.where || {};
      const data = args?.data || {};
      const ids = Array.isArray(where.id?.in)
        ? where.id.in.map((value: unknown) => toBigInt(value))
        : [];

      let count = 0;

      for (const opportunity of copilotOpportunities) {
        if (ids.length > 0 && !ids.some((id) => id === opportunity.id)) {
          continue;
        }

        for (const [key, value] of Object.entries(data)) {
          if (typeof value !== 'undefined') {
            opportunity[key] = value;
          }
        }

        opportunity.updatedAt = nextDate();
        count += 1;
      }

      return {
        count,
      };
    }),
  };

  const copilotApplicationModel = {
    findFirst: jest.fn(() => null),
    findMany: jest.fn(() => []),
    updateMany: jest.fn(() => ({ count: 0 })),
    update: jest.fn(() => ({ id: BigInt(1) })),
  };

  const phaseProductModel = {
    createMany: jest.fn(() => ({ count: 0 })),
  };

  const projectAttachmentModel = {
    createMany: jest.fn(() => ({ count: 0 })),
  };

  const txClient = {
    project: projectModel,
    projectMember: projectMemberModel,
    projectMemberInvite: projectMemberInviteModel,
    projectPhase: projectPhaseModel,
    projectHistory: projectHistoryModel,
    projectAttachment: projectAttachmentModel,
    phaseProduct: phaseProductModel,
    copilotRequest: copilotRequestModel,
    copilotOpportunity: copilotOpportunityModel,
    copilotApplication: copilotApplicationModel,
  };

  const prisma = {
    project: projectModel,
    projectType: projectTypeModel,
    projectTemplate: projectTemplateModel,
    projectHistory: projectHistoryModel,
    projectMember: projectMemberModel,
    projectMemberInvite: projectMemberInviteModel,
    projectPhase: projectPhaseModel,
    projectAttachment: projectAttachmentModel,
    phaseProduct: phaseProductModel,
    copilotRequest: copilotRequestModel,
    copilotOpportunity: copilotOpportunityModel,
    copilotApplication: copilotApplicationModel,
    $transaction: jest.fn((callback: (tx: typeof txClient) => unknown) =>
      Promise.resolve(callback(txClient)),
    ),
  };

  return {
    prisma,
    reset,
  };
}

describe('Event payload parity against v5 fixture snapshots', () => {
  let app: INestApplication;
  let prismaMockBundle: ReturnType<typeof createPrismaServiceMock>;

  const jwtServiceMock = {
    validateToken: jest.fn((token: string) => {
      const user = tokenUsers[token];

      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }

      return user;
    }),
  };

  const m2mServiceMock = {
    validateMachineToken: jest.fn(() => ({
      isMachine: false,
      scopes: [],
    })),
    hasRequiredScopes: jest.fn(() => true),
  };

  const permissionServiceMock = {
    hasNamedPermission: jest.fn(() => true),
    hasPermission: jest.fn(() => true),
    hasIntersection: jest.fn(() => true),
    isNamedPermissionRequireProjectMembers: jest.fn(() => false),
    isNamedPermissionRequireProjectInvites: jest.fn(() => false),
    isPermissionRequireProjectMembers: jest.fn(() => false),
  };

  const memberServiceMock = {
    getMemberDetailsByUserIds: jest.fn().mockResolvedValue([]),
    getUserRoles: jest
      .fn()
      .mockResolvedValue(['Project Manager', 'Topcoder User']),
  };

  beforeAll(async () => {
    process.env.AUTH0_URL = process.env.AUTH0_URL || 'https://auth.example.com';
    process.env.AUTH0_AUDIENCE =
      process.env.AUTH0_AUDIENCE || 'https://api.example.com';

    jest.doMock('tc-bus-api-wrapper', () => {
      return jest.fn(() => ({
        postEvent: postEventMock,
      }));
    });

    prismaMockBundle = createPrismaServiceMock();

    const [
      { AppModule },
      { JwtService },
      { M2MService },
      { PrismaService },
      { PermissionService },
      { MemberService },
    ] = await Promise.all([
      import('../src/app.module'),
      import('../src/shared/modules/global/jwt.service'),
      import('../src/shared/modules/global/m2m.service'),
      import('../src/shared/modules/global/prisma.service'),
      import('../src/shared/services/permission.service'),
      import('../src/shared/services/member.service'),
    ]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(JwtService)
      .useValue(jwtServiceMock)
      .overrideProvider(M2MService)
      .useValue(m2mServiceMock)
      .overrideProvider(PrismaService)
      .useValue(prismaMockBundle.prisma)
      .overrideProvider(PermissionService)
      .useValue(permissionServiceMock)
      .overrideProvider(MemberService)
      .useValue(memberServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v6');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prismaMockBundle.reset();
    capturedEvents.length = 0;
    postEventMock.mockClear();
  });

  it('matches project create event snapshot from v5 parity fixtures', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects')
      .set('Authorization', 'Bearer manager-token')
      .send(requestFixtures.createProject)
      .expect(201);

    await waitForEventCount(2);
    assertSnapshot('project-create.json');
  });

  it('matches project update event snapshot from v5 parity fixtures', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/v6/projects')
      .set('Authorization', 'Bearer manager-token')
      .send(requestFixtures.createProject)
      .expect(201);

    const createdProjectId = readId(createResponse.body);

    await waitForEventCount(2);
    capturedEvents.length = 0;
    postEventMock.mockClear();

    await request(app.getHttpServer())
      .patch(`/v6/projects/${createdProjectId}`)
      .set('Authorization', 'Bearer manager-token')
      .send(requestFixtures.updateProject)
      .expect(200);

    await waitForEventCount(4);
    assertSnapshot('project-update.json');
  });

  it('matches invite accept event snapshot from v5 parity fixtures', async () => {
    await request(app.getHttpServer())
      .patch('/v6/projects/1001/invites/7001')
      .set('Authorization', 'Bearer manager-token')
      .send(requestFixtures.acceptInvite)
      .expect(200);

    await waitForEventCount(3);
    assertSnapshot('invite-accept.json');
  });

  it('matches phase transition event snapshot from v5 parity fixtures', async () => {
    await request(app.getHttpServer())
      .patch('/v6/projects/1001/phases/5001')
      .set('Authorization', 'Bearer manager-token')
      .send({
        status: ProjectStatus.completed,
      })
      .expect(200);

    await waitForEventCount(5);
    assertSnapshot('phase-transition.json');
  });

  it('matches copilot approve event snapshot from v5 parity fixtures', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects/1001/copilots/requests/9001/approve')
      .set('Authorization', 'Bearer manager-token')
      .send({
        type: CopilotOpportunityType.dev,
      })
      .expect(201);

    await delay(100);
    assertSnapshot('copilot-approve.json');
  });
});
