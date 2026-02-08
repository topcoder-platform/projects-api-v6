import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedProjectTypes() {
  console.log('Seeding project types...');

  await prisma.projectType.upsert({
    where: { key: 'development' },
    update: {
      displayName: 'Development',
      aliases: ['dev', 'software'],
      updatedBy: 1,
    },
    create: {
      key: 'development',
      displayName: 'Development',
      icon: 'https://cdn-apps.topcoder.com/icons/development.svg',
      question: 'What type of project do you need?',
      info: 'Software development project type.',
      aliases: ['dev', 'software'],
      metadata: {
        category: 'build',
      },
      createdBy: 1,
      updatedBy: 1,
    },
  });

  await prisma.projectType.upsert({
    where: { key: 'design' },
    update: {
      displayName: 'Design',
      aliases: ['uiux', 'ux'],
      updatedBy: 1,
    },
    create: {
      key: 'design',
      displayName: 'Design',
      icon: 'https://cdn-apps.topcoder.com/icons/design.svg',
      question: 'What type of project do you need?',
      info: 'Design and UX project type.',
      aliases: ['uiux', 'ux'],
      metadata: {
        category: 'design',
      },
      createdBy: 1,
      updatedBy: 1,
    },
  });
}

async function seedProjectTemplates() {
  console.log('Seeding project templates...');

  const existingTemplate = await prisma.projectTemplate.findFirst({
    where: {
      key: 'standard-development-template',
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!existingTemplate) {
    await prisma.projectTemplate.create({
      data: {
        name: 'Standard Development Template',
        key: 'standard-development-template',
        category: 'development',
        metadata: {
          version: 1,
          managed: true,
        },
        icon: 'https://cdn-apps.topcoder.com/icons/template-development.svg',
        question: 'How should this project be configured?',
        info: 'Default project template for development delivery.',
        aliases: ['default-dev-template'],
        scope: {
          track: 'development',
        },
        phases: {
          default: ['planning', 'execution', 'review'],
        },
        createdBy: BigInt(1),
        updatedBy: BigInt(1),
      },
    });
  }
}

async function seedProductCategories() {
  console.log('Seeding product categories...');

  await prisma.productCategory.upsert({
    where: { key: 'application' },
    update: {
      displayName: 'Application',
      updatedBy: 1,
    },
    create: {
      key: 'application',
      displayName: 'Application',
      icon: 'https://cdn-apps.topcoder.com/icons/application.svg',
      question: 'What product category do you need?',
      info: 'Application product category.',
      aliases: ['app', 'product'],
      createdBy: 1,
      updatedBy: 1,
    },
  });
}

async function main() {
  console.log('Starting Prisma seed...');

  await seedProjectTypes();
  await seedProjectTemplates();
  await seedProductCategories();

  console.log('Prisma seed completed.');
}

main()
  .catch((error) => {
    console.error('Prisma seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
