import { PrismaPg } from '@prisma/adapter-pg';
import {
  AttachmentType,
  CopilotOpportunityStatus,
  CopilotOpportunityType,
  CopilotRequestStatus,
  InviteStatus,
  PrismaClient,
  ProjectMemberRole,
  ProjectStatus,
  WorkStreamStatus,
} from '@prisma/client';

export const FIXTURE_PREFIX = 'fixture-v6';
export const FIXTURE_AUDIT_USER_ID = 910001;
export const FIXTURE_AUDIT_USER_ID_BIGINT = BigInt(FIXTURE_AUDIT_USER_ID);

export interface DatabaseSeedSummary {
  templateId: string;
  projectIds: string[];
  phaseIds: string[];
  workStreamIds: string[];
  copilotRequestIds: string[];
  copilotOpportunityIds: string[];
}

function getSchemaFromUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).searchParams.get('schema') ?? undefined;
  } catch {
    return undefined;
  }
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  const schema = getSchemaFromUrl(connectionString);
  const adapter = new PrismaPg(
    { connectionString },
    schema ? { schema } : undefined,
  );

  return new PrismaClient({ adapter });
}

async function ensureReferenceMetadata(prisma: PrismaClient): Promise<{
  templateId: bigint;
}> {
  await prisma.projectType.upsert({
    where: {
      key: 'app',
    },
    update: {
      displayName: 'Application',
      updatedBy: FIXTURE_AUDIT_USER_ID,
    },
    create: {
      key: 'app',
      displayName: 'Application',
      icon: 'app',
      question: 'What would you like to build?',
      info: 'Fixture project type for integration tests',
      aliases: ['application'],
      metadata: {
        source: 'fixtures',
      },
      createdBy: FIXTURE_AUDIT_USER_ID,
      updatedBy: FIXTURE_AUDIT_USER_ID,
    },
  });

  await prisma.productCategory.upsert({
    where: {
      key: 'generic',
    },
    update: {
      displayName: 'Generic Product',
      updatedBy: FIXTURE_AUDIT_USER_ID,
    },
    create: {
      key: 'generic',
      displayName: 'Generic Product',
      icon: 'generic',
      question: 'Pick product',
      info: 'Fixture product category',
      aliases: ['generic'],
      createdBy: FIXTURE_AUDIT_USER_ID,
      updatedBy: FIXTURE_AUDIT_USER_ID,
    },
  });

  const existingTemplate = await prisma.projectTemplate.findFirst({
    where: {
      key: 'fixture-template',
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (existingTemplate) {
    await prisma.workManagementPermission.upsert({
      where: {
        policy_projectTemplateId: {
          policy: 'manage_team',
          projectTemplateId: existingTemplate.id,
        },
      },
      update: {
        permission: {
          allow: {
            roles: ['manager'],
          },
        },
        updatedBy: FIXTURE_AUDIT_USER_ID,
      },
      create: {
        policy: 'manage_team',
        projectTemplateId: existingTemplate.id,
        permission: {
          allow: {
            roles: ['manager'],
          },
        },
        createdBy: FIXTURE_AUDIT_USER_ID,
        updatedBy: FIXTURE_AUDIT_USER_ID,
      },
    });

    return {
      templateId: existingTemplate.id,
    };
  }

  const createdTemplate = await prisma.projectTemplate.create({
    data: {
      name: 'Fixture Template',
      key: 'fixture-template',
      category: 'build',
      subCategory: 'integration',
      metadata: {
        source: 'fixtures',
      },
      icon: 'integration',
      question: 'Fixture template question',
      info: 'Fixture template info',
      aliases: ['fixture'],
      phases: [
        {
          name: 'Discovery',
          order: 1,
          products: [],
        },
      ],
      form: {
        key: 'fixture-form',
      },
      planConfig: {
        key: 'fixture-plan',
      },
      priceConfig: {
        key: 'fixture-price',
      },
      createdBy: FIXTURE_AUDIT_USER_ID_BIGINT,
      updatedBy: FIXTURE_AUDIT_USER_ID_BIGINT,
    },
    select: {
      id: true,
    },
  });

  await prisma.workManagementPermission.create({
    data: {
      policy: 'manage_team',
      projectTemplateId: createdTemplate.id,
      permission: {
        allow: {
          roles: ['manager'],
        },
      },
      createdBy: FIXTURE_AUDIT_USER_ID,
      updatedBy: FIXTURE_AUDIT_USER_ID,
    },
  });

  return {
    templateId: createdTemplate.id,
  };
}

export async function resetDatabaseFixtures(
  prisma: PrismaClient,
): Promise<void> {
  const projects = await prisma.project.findMany({
    where: {
      name: {
        startsWith: `${FIXTURE_PREFIX}-`,
      },
    },
    select: {
      id: true,
    },
  });

  if (projects.length === 0) {
    return;
  }

  const projectIds = projects.map((project) => project.id);
  const phases = await prisma.projectPhase.findMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
    select: {
      id: true,
    },
  });
  const phaseIds = phases.map((phase) => phase.id);

  const workStreams = await prisma.workStream.findMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
    select: {
      id: true,
    },
  });
  const workStreamIds = workStreams.map((workStream) => workStream.id);

  const requests = await prisma.copilotRequest.findMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
    select: {
      id: true,
    },
  });
  const requestIds = requests.map((request) => request.id);

  const opportunities = await prisma.copilotOpportunity.findMany({
    where: {
      OR: [
        {
          projectId: {
            in: projectIds,
          },
        },
        {
          copilotRequestId: {
            in: requestIds.length > 0 ? requestIds : [BigInt(-1)],
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });
  const opportunityIds = opportunities.map((opportunity) => opportunity.id);

  const estimations = await prisma.projectEstimation.findMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
    select: {
      id: true,
    },
  });
  const estimationIds = estimations.map((estimation) => estimation.id);

  if (phaseIds.length > 0 || workStreamIds.length > 0) {
    const phaseWorkStreamFilters = [] as Array<
      { phaseId: { in: bigint[] } } | { workStreamId: { in: bigint[] } }
    >;

    if (phaseIds.length > 0) {
      phaseWorkStreamFilters.push({
        phaseId: {
          in: phaseIds,
        },
      });
    }

    if (workStreamIds.length > 0) {
      phaseWorkStreamFilters.push({
        workStreamId: {
          in: workStreamIds,
        },
      });
    }

    await prisma.phaseWorkStream.deleteMany({
      where: {
        OR: phaseWorkStreamFilters,
      },
    });
  }

  if (phaseIds.length > 0) {
    await prisma.projectPhaseApproval.deleteMany({
      where: {
        phaseId: {
          in: phaseIds,
        },
      },
    });

    await prisma.projectPhaseMember.deleteMany({
      where: {
        phaseId: {
          in: phaseIds,
        },
      },
    });
  }

  await prisma.projectMemberInvite.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  if (opportunityIds.length > 0) {
    await prisma.copilotApplication.deleteMany({
      where: {
        opportunityId: {
          in: opportunityIds,
        },
      },
    });
  }

  if (requestIds.length > 0 || projectIds.length > 0) {
    await prisma.copilotOpportunity.deleteMany({
      where: {
        OR: [
          {
            projectId: {
              in: projectIds,
            },
          },
          {
            copilotRequestId: {
              in: requestIds.length > 0 ? requestIds : [BigInt(-1)],
            },
          },
        ],
      },
    });
  }

  await prisma.copilotRequest.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  if (estimationIds.length > 0) {
    await prisma.projectEstimationItem.deleteMany({
      where: {
        projectEstimationId: {
          in: estimationIds,
        },
      },
    });
  }

  await prisma.projectEstimation.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  if (phaseIds.length > 0) {
    await prisma.phaseProduct.deleteMany({
      where: {
        phaseId: {
          in: phaseIds,
        },
      },
    });
  }

  await prisma.projectAttachment.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectHistory.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  if (phaseIds.length > 0) {
    await prisma.projectPhase.deleteMany({
      where: {
        id: {
          in: phaseIds,
        },
      },
    });
  }

  await prisma.workStream.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectSetting.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectMember.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.project.deleteMany({
    where: {
      id: {
        in: projectIds,
      },
    },
  });
}

export async function seedDatabaseFixtures(
  prisma: PrismaClient,
): Promise<DatabaseSeedSummary> {
  await resetDatabaseFixtures(prisma);

  const { templateId } = await ensureReferenceMetadata(prisma);
  process.env.FIXTURE_TEMPLATE_ID = templateId.toString();

  const projectIds: bigint[] = [];
  const phaseIds: bigint[] = [];
  const workStreamIds: bigint[] = [];
  const copilotRequestIds: bigint[] = [];
  const copilotOpportunityIds: bigint[] = [];

  const projectStatuses: ProjectStatus[] = [
    ProjectStatus.draft,
    ProjectStatus.in_review,
    ProjectStatus.reviewed,
    ProjectStatus.active,
    ProjectStatus.completed,
    ProjectStatus.cancelled,
  ];

  for (const [index, status] of projectStatuses.entries()) {
    const project = await prisma.project.create({
      data: {
        name: `${FIXTURE_PREFIX}-${status}`,
        description: `Fixture project for status ${status}`,
        type: 'app',
        status,
        templateId,
        details: {
          seededBy: 'database-seed',
          index,
        },
        terms: ['standard'],
        groups: ['fixtures'],
        lastActivityAt: new Date(),
        lastActivityUserId: String(1000 + index),
        createdBy: FIXTURE_AUDIT_USER_ID,
        updatedBy: FIXTURE_AUDIT_USER_ID,
      },
      select: {
        id: true,
      },
    });

    projectIds.push(project.id);

    await prisma.projectHistory.create({
      data: {
        projectId: project.id,
        status,
        createdBy: FIXTURE_AUDIT_USER_ID,
        updatedBy: FIXTURE_AUDIT_USER_ID,
      },
    });

    await prisma.projectMember.createMany({
      data: [
        {
          projectId: project.id,
          userId: BigInt(1000 + index),
          role: ProjectMemberRole.manager,
          isPrimary: true,
          createdBy: FIXTURE_AUDIT_USER_ID,
          updatedBy: FIXTURE_AUDIT_USER_ID,
        },
        {
          projectId: project.id,
          userId: BigInt(2000 + index),
          role: ProjectMemberRole.copilot,
          isPrimary: true,
          createdBy: FIXTURE_AUDIT_USER_ID,
          updatedBy: FIXTURE_AUDIT_USER_ID,
        },
        {
          projectId: project.id,
          userId: BigInt(3000 + index),
          role: ProjectMemberRole.customer,
          isPrimary: true,
          createdBy: FIXTURE_AUDIT_USER_ID,
          updatedBy: FIXTURE_AUDIT_USER_ID,
        },
      ],
    });

    await prisma.projectMemberInvite.createMany({
      data: [
        {
          projectId: project.id,
          userId: BigInt(4000 + index),
          role: ProjectMemberRole.observer,
          status: InviteStatus.pending,
          createdBy: FIXTURE_AUDIT_USER_ID,
          updatedBy: FIXTURE_AUDIT_USER_ID,
        },
        {
          projectId: project.id,
          email: `fixture-requested-${index}@example.com`,
          role: ProjectMemberRole.copilot,
          status: InviteStatus.requested,
          createdBy: FIXTURE_AUDIT_USER_ID,
          updatedBy: FIXTURE_AUDIT_USER_ID,
        },
      ],
    });

    await prisma.projectAttachment.createMany({
      data: [
        {
          projectId: project.id,
          title: `Fixture file ${index}`,
          type: AttachmentType.file,
          path: `fixtures/${project.id.toString()}/spec-${index}.zip`,
          contentType: 'application/zip',
          size: 2048,
          tags: ['fixture', 'file'],
          allowedUsers: [1000 + index],
          createdBy: FIXTURE_AUDIT_USER_ID,
          updatedBy: FIXTURE_AUDIT_USER_ID,
        },
        {
          projectId: project.id,
          title: `Fixture link ${index}`,
          type: AttachmentType.link,
          path: `https://example.com/projects/${project.id.toString()}`,
          tags: ['fixture', 'link'],
          createdBy: FIXTURE_AUDIT_USER_ID,
          updatedBy: FIXTURE_AUDIT_USER_ID,
        },
      ],
    });

    const phase = await prisma.projectPhase.create({
      data: {
        projectId: project.id,
        name: `Phase-${index}`,
        status:
          status === ProjectStatus.completed
            ? ProjectStatus.completed
            : ProjectStatus.active,
        order: index + 1,
        details: {
          seededBy: 'database-seed',
        },
        createdBy: FIXTURE_AUDIT_USER_ID,
        updatedBy: FIXTURE_AUDIT_USER_ID,
      },
      select: {
        id: true,
      },
    });

    phaseIds.push(phase.id);

    await prisma.phaseProduct.createMany({
      data: [
        {
          phaseId: phase.id,
          projectId: project.id,
          name: `Product-${index}`,
          type: 'generic-product',
          templateId,
          estimatedPrice: 1,
          actualPrice: 1,
          details: {
            challengeGuid: `fixture-${index}`,
          },
          createdBy: FIXTURE_AUDIT_USER_ID,
          updatedBy: FIXTURE_AUDIT_USER_ID,
        },
      ],
    });

    const workStream = await prisma.workStream.create({
      data: {
        projectId: project.id,
        name: `Workstream-${index}`,
        type: 'default',
        status: WorkStreamStatus.active,
        createdBy: FIXTURE_AUDIT_USER_ID_BIGINT,
        updatedBy: FIXTURE_AUDIT_USER_ID_BIGINT,
      },
      select: {
        id: true,
      },
    });

    workStreamIds.push(workStream.id);

    await prisma.phaseWorkStream.create({
      data: {
        phaseId: phase.id,
        workStreamId: workStream.id,
      },
    });

    const request = await prisma.copilotRequest.create({
      data: {
        projectId: project.id,
        status:
          status === ProjectStatus.completed
            ? CopilotRequestStatus.fulfilled
            : CopilotRequestStatus.approved,
        data: {
          projectId: Number(project.id),
          opportunityTitle: `Fixture opportunity ${index}`,
          projectType: 'development',
        },
        createdBy: FIXTURE_AUDIT_USER_ID,
        updatedBy: FIXTURE_AUDIT_USER_ID,
      },
      select: {
        id: true,
      },
    });

    copilotRequestIds.push(request.id);

    const opportunity = await prisma.copilotOpportunity.create({
      data: {
        projectId: project.id,
        copilotRequestId: request.id,
        status:
          status === ProjectStatus.completed
            ? CopilotOpportunityStatus.completed
            : CopilotOpportunityStatus.active,
        type: CopilotOpportunityType.dev,
        createdBy: FIXTURE_AUDIT_USER_ID,
        updatedBy: FIXTURE_AUDIT_USER_ID,
      },
      select: {
        id: true,
      },
    });

    copilotOpportunityIds.push(opportunity.id);
  }

  return {
    templateId: templateId.toString(),
    projectIds: projectIds.map((id) => id.toString()),
    phaseIds: phaseIds.map((id) => id.toString()),
    workStreamIds: workStreamIds.map((id) => id.toString()),
    copilotRequestIds: copilotRequestIds.map((id) => id.toString()),
    copilotOpportunityIds: copilotOpportunityIds.map((id) => id.toString()),
  };
}

if (require.main === module) {
  const prisma = createPrismaClient();

  void seedDatabaseFixtures(prisma)
    .then((summary) => {
      console.log('Fixture seed complete', summary);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
