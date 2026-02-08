import { InviteStatus, ProjectMemberRole, ProjectStatus } from '@prisma/client';

const FIXTURE_TEMPLATE_ID = Number.parseInt(
  process.env.FIXTURE_TEMPLATE_ID ||
    process.env.PARITY_TEMPLATE_ID ||
    process.env.PROJECT_TEMPLATE_ID ||
    '67',
  10,
);

export const requestFixtures = {
  createProject: {
    name: 'fixture-v6-work-manager-project',
    description: 'Project created by integration fixture payload',
    type: 'app',
    status: ProjectStatus.draft,
    terms: ['standard'],
    groups: ['g1'],
    details: {
      useCase: 'migration-validation',
      budgetTier: 'standard',
    },
  },
  updateProject: {
    name: 'fixture-v6-work-manager-project-updated',
    description: 'Project updated by fixture payload',
    status: ProjectStatus.active,
    details: {
      useCase: 'migration-validation',
      stage: 'active',
    },
  },
  addMember: {
    role: ProjectMemberRole.manager,
  },
  updateMemberRole: {
    role: ProjectMemberRole.copilot,
    action: 'complete-copilot-requests',
  },
  inviteByHandle: {
    handles: ['copilotfixture'],
    role: ProjectMemberRole.copilot,
  },
  inviteByEmail: {
    emails: ['fixture.customer@example.com'],
    role: ProjectMemberRole.customer,
  },
  acceptInvite: {
    status: InviteStatus.accepted,
    source: 'work_manager',
  },
  createFileAttachment: {
    title: 'fixture-spec-archive',
    description: 'Fixture archive for migration validation',
    type: 'file',
    path: 'fixtures/specs/archive.zip',
    size: 2048,
    contentType: 'application/zip',
    s3Bucket: 'topcoder-fixtures',
    tags: ['spec', 'fixture'],
  },
  createLinkAttachment: {
    title: 'fixture-doc-link',
    type: 'link',
    path: 'https://example.com/specs',
    tags: ['reference'],
  },
  createPhase: {
    name: 'Discovery',
    status: ProjectStatus.active,
    description: 'Discovery phase created by fixture',
    details: {
      stage: 'discovery',
    },
  },
  updatePhase: {
    name: 'Discovery Updated',
    status: ProjectStatus.completed,
    details: {
      stage: 'closed',
    },
  },
  createPhaseProduct: {
    name: 'Generic Product',
    type: 'generic-product',
    templateId: Number.isNaN(FIXTURE_TEMPLATE_ID) ? 67 : FIXTURE_TEMPLATE_ID,
    estimatedPrice: 1,
    actualPrice: 1,
    details: {
      challengeGuid: 'fixture-challenge-guid',
    },
  },
  updatePhaseProduct: {
    name: 'Generic Product Updated',
    estimatedPrice: 2,
    actualPrice: 2,
  },
  createCopilotRequest: {
    data: {
      projectId: 1001,
      opportunityTitle: 'Need migration copilot',
      complexity: 'medium',
      requiresCommunication: 'yes',
      paymentType: 'standard',
      projectType: 'development',
      overview: 'Fixture copilot request for migration flow validation',
      skills: [
        {
          id: '1',
          name: 'Node.js',
        },
        {
          id: '2',
          name: 'Project Management',
        },
      ],
      startDate: '2026-01-01T00:00:00.000Z',
      numWeeks: 4,
      tzRestrictions: 'UTC-5 to UTC+2',
      numHoursPerWeek: 20,
    },
  },
};

export const queryFixtures = {
  projectList: {
    page: 1,
    perPage: 20,
    sort: 'lastActivityAt desc',
  },
  projectListWithFilter: {
    page: 1,
    perPage: 5,
    keyword: 'fixture-v6',
    status: 'active',
    memberOnly: false,
  },
  projectFields: {
    fields: 'members,invites,attachments,phases',
  },
  projectFieldsReduced: {
    fields: 'id,name,status',
  },
  members: {
    fields: 'handle,email',
  },
  invites: {
    fields: 'handle,email',
  },
  phases: {
    fields: 'id,name,status,products',
    sort: 'id desc',
    memberOnly: false,
  },
  copilotList: {
    page: 1,
    pageSize: 20,
    sort: 'createdAt desc',
  },
};

export type RequestFixtures = typeof requestFixtures;
export type QueryFixtures = typeof queryFixtures;
