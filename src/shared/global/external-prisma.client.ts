import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClientOptions } from '@prisma/client/runtime/client';
import { PrismaClient as ChallengesPrismaClient } from '@topcoder/challenge-api-v6/packages/challenge-prisma-client';
import { PrismaClient as MembersPrismaClient } from '@topcoder/member-api-v6/packages/member-prisma-client';
import { PrismaClient as ResourcesPrismaClient } from '@topcoder/resource-api-v6/packages/resources-prisma-client';
import { PrismaClient as SkillsPrismaClient } from '@topcoder/standardized-skills-api/packages/skills-prisma-client';

const clientOptions = {
  log: [
    { level: 'query', emit: 'event' },
    { level: 'info', emit: 'event' },
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ] as PrismaClientOptions['log'],
};

const DEFAULT_SUBMITTER_ROLE_ID =
  process.env.SUBMITTER_ROLE_ID || '732339e7-8e30-49d7-9198-cccf9451e221';

function ensureUrl(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} must be set for external Prisma client`);
  }
  return value;
}

function createPgAdapter(dbUrl: string) {
  const url = new URL(dbUrl);
  const schema = url.searchParams.get('schema');
  const connectionString = dbUrl;
  return schema
    ? new PrismaPg({ connectionString }, { schema })
    : new PrismaPg({ connectionString });
}

let challengesClient: ChallengesPrismaClient;
let membersClient: MembersPrismaClient;
let resourcesClient: ResourcesPrismaClient;
let skillsClient: SkillsPrismaClient;

export const getChallengesPrismaClient = (): ChallengesPrismaClient => {
  if (!challengesClient) {
    const url = ensureUrl(
      process.env.CHALLENGES_DB_URL || process.env.DATABASE_URL,
      'CHALLENGES_DB_URL or DATABASE_URL',
    );
    challengesClient = new ChallengesPrismaClient({
      ...clientOptions,
      datasources: { db: { url } },
    });
  }
  return challengesClient;
};

export const getMembersPrismaClient = (): MembersPrismaClient => {
  if (!membersClient) {
    const url = ensureUrl(
      process.env.MEMBERS_DB_URL || process.env.DATABASE_URL,
      'MEMBERS_DB_URL or DATABASE_URL',
    );
    membersClient = new MembersPrismaClient({
      ...clientOptions,
      datasources: { db: { url } },
    });
  }
  return membersClient;
};

export const getResourcesPrismaClient = (): ResourcesPrismaClient => {
  if (!resourcesClient) {
    const url = ensureUrl(
      process.env.RESOURCES_DB_URL || process.env.DATABASE_URL,
      'RESOURCES_DB_URL or DATABASE_URL',
    );
    resourcesClient = new ResourcesPrismaClient({
      ...clientOptions,
      datasources: { db: { url } },
    });
  }
  return resourcesClient;
};

export const getSkillsPrismaClient = (): SkillsPrismaClient => {
  if (!skillsClient) {
    const url = ensureUrl(
      process.env.SKILLS_DB_URL || process.env.DATABASE_URL,
      'SKILLS_DB_URL or DATABASE_URL',
    );
    skillsClient = new SkillsPrismaClient({
      ...clientOptions,
      datasources: { db: { url } },
    });
  }
  return skillsClient;
};

export const getSubmitterRoleId = (): string => DEFAULT_SUBMITTER_ROLE_ID;
