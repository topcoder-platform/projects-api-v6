import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const projectTypeData: Prisma.ProjectTypeCreateManyInput[] = [{
  id: 1001,
  key: 'generic',
  displayName: 'generic',
  icon: 'icon1',
  question: 'question1',
  info: 'info1',
  aliases: {},
  disabled: false,
  hidden: false,
  metadata: {},
  createdBy: 40152856,
}, {
  id: 1002,
  key: 'scoped-solutions',
  displayName: 'scoped-solutions',
  icon: 'icon2',
  question: 'question2',
  info: 'info2',
  aliases: {},
  disabled: false,
  hidden: false,
  metadata: {},
  createdBy: 40152856,
}]

const productTemplateData: Prisma.ProductTemplateCreateManyInput[] = [{
  id: 101,
  name: 'name 1',
  productKey: 'productKey 1',
  category: 'category1',
  subCategory: 'category1',
  icon: 'http://example.com/icon1.ico',
  brief: 'brief 1',
  details: 'details 1',
  aliases: {},
  createdBy: 40152856,
}, {
  id: 102,
  name: 'name 2',
  productKey: 'productKey 2',
  category: 'category2',
  subCategory: 'category2',
  icon: 'http://example.com/icon1.ico',
  brief: 'brief 2',
  details: 'details 2',
  aliases: {},
  createdBy: 40152856,
}]

const planConfigData: Prisma.PlanConfigCreateManyInput[] = [{
  id: 1001,
  key: 'key1',
  version: 1,
  revision: 1,
  config: {
    values: [{
      name: 'workstream3',
      products: [{
        templateId: 101,
        type: 'type1',
        name: 'product1',
      }]
    }],
  },
  createdBy: 40152856,
  createdAt: '2020-05-05T10:10:47.007Z',
  updatedBy: 40152856,
  updatedAt: '2020-05-05T10:10:47.008Z',
  deletedBy: null,
  deletedAt: null,
}, {
  id: 1002,
  key: 'key1',
  version: 1,
  revision: 2,
  config: {
    values: [{
      name: 'workstream4',
      products: [{
        templateId: 102,
        type: 'type2',
        name: 'product2',
      }]
    }],
  },
  createdBy: 40152856,
  createdAt: '2020-05-05T10:10:47.007Z',
  updatedBy: 40152856,
  updatedAt: '2020-05-05T10:10:47.008Z',
  deletedBy: null,
  deletedAt: null,
}]


const projectTemplateData1: Prisma.ProjectTemplateCreateInput = {
  id: 2001,
  name: 'Subtitle',
  key: 'subtitle',
  category: 'app',
  icon: 'product-app-app',
  question: 'What do you need to develop?',
  info: 'Build apps for mobile, web, or wearables',
  aliases: {name: 'subtitle'},
  phases: {
    values: [{
      name: 'workstream1',
      products: [{
        templateId: 101,
        type: 'type1',
        name: 'product1',
      }]
    }, {
      name: 'workstream2',
      products: [{
        templateId: 102,
        type: 'type2',
        name: 'product2',
      }]
    }],
    workstreamsConfig: {
      name: 'workstream9',
      type: 'test',
    },
  },
  planConfig: {
    key: 'key1',
    version: 1,
  },
  createdBy: 40152856,
  createdAt: '2020-05-05T10:10:47.007Z',
  updatedBy: 40152856,
  updatedAt: '2020-05-05T10:10:47.008Z',
  deletedBy: null,
  deletedAt: null,
}

const projectTemplateData2: Prisma.ProjectTemplateCreateInput = {
  id: 2002,
  name: 'Subtitle',
  key: 'subtitle',
  category: 'app',
  icon: 'product-app-app',
  question: 'What do you need to develop?',
  info: 'Build apps for mobile, web, or wearables',
  aliases: {name: 'subtitle'},
  planConfig: {
    key: 'key1',
    version: 1,
  },
  createdBy: 40152856,
  createdAt: '2020-05-05T10:10:47.007Z',
  updatedBy: 40152856,
  updatedAt: '2020-05-05T10:10:47.008Z',
  deletedBy: null,
  deletedAt: null,
}


const projectData1: Prisma.ProjectCreateInput = {
  id: 101,
  status: 'in_review',
  name: 'App New1',
  description: 'We will ask you several questions in order to determine your project’s scope. All estimates are based on our 15 years of experience and thousands of projects. Final prices will be determined after our team completes a final scope review.',
  projectFullText: 'full text 1',
  billingAccountId: null,
  directProjectId: 1001,
  type: 'generic',
  version: 'v3',
  templateId: 2001,
  estimatedPrice: null,
  actualPrice: null,
  cancelReason: null,
  terms: [],
  groups: [],
  projectUrl: 'http://project.example.com',
  details: {
    create: {
      products: ['product1', 'product2'],
      intakePurpose: 'demo-test-other',
      hideDiscussions: false,
      createdBy: 40152856,
      utm: {
        create: {
          code: 'code123',
          createdBy: 40152856,
        }
      },
      setting: {
        create: {
          workstreams: true,
          createdBy: 40152856,
        }
      },
      appDefinition: {
        create: {
          budget:34.56,
          deliverables: ['deployment'],
          expectedOutcome: [],
          designGoal: [],
          needAdditionalScreens: 'Yes',
          targetDevices: [],
          webBrowserBehaviour : 'View',
          webBrowsersSupported: [],
          hasBrandGuidelines: 'Yes',
          needSpecificFonts: 'Yes',
          needSpecificColors: 'Yes',
          securityRequirements: {
            containsSecurityInfo: 'no'
          },
          userRequirements: {},
          addons: {
            design: [
              {
                id: 39,
                productKey: 'ui-prototype'
              }
            ],
            development: [
              {
                id: 48,
                productKey: 'resp-design-impl'
              }
            ]
          },
          createdBy: 40152856,
        }
      },
      projectData: {
        create: {
          customerProject: 'customerProject1',
          executionHub: 'executionHub1',
          groupCustomerName: 'groupCustomer1',
          projectCode: 'project123',
          groupName: 'group1',
          costCenter: 'costCenter1',
          wbsCode: 'wbs123',
          onsiteEfforts: '0',
          offshoreEfforts: '0',
          plannedStartDate: '2025-05-05T10:10:47.007Z',
          plannedEndDate: '2025-05-05T10:10:47.007Z',
          partOfNg3: 'partOfNg345',
          companyCode: 'company123',
          approvedAmount: '12.3',
          projectClassificationCode: 'projectClassification123',
          invoiceType: 'invoiceType1',
          sowNumber: '1234567',
          sector: 'sector1',
          smu: 'smu1',
          subExecutionHub: 'subExecutionHub1',
          initiatorEmail: 'initiator@tc.com',
          createdBy: 40152856,
        }
      },
      techstack: {
        create: {
          languages: ['java', 'nodejs'],
          frameworks: ['spring', 'nestjs'],
          database: 'postgresql',
          hosting: 'localhost',
          others: 'other1',
          createdBy: 40152856,
        }
      },
      apiDefinition: {
        create: {
          addons: ['addon1', 'addon2'],
          deliverables: ['development'],
          deploymentTargets: ['Amazon'],
          createdBy: 40152856,
        }
      },
    },
  },
  utm: {
    create: {
      source: 'source1',
      medium: 'medium1',
      campaign: 'campaign2',
      createdBy: 40152856,
    }
  },
  external: {
    create: {
      extId: 'extId123',
      type: 'github',
      data: 'extData',
      createdBy: 40152856,
    }
  },
  challengeEligibility: {
    create: [{
      role: 'reviewer',
      users: [],
      groups: [],
      createdBy: 40152856,
    }]
  },
  estimation: {
    create: [{
      conditions: 'conditions1',
      price: 12.34,
      quantity: 90,
      minTime: 20,
      maxTime: 40,
      buildingBlockKey: 'key1',
      metadata: {
        create: {
          deliverable: 'deliverable1',
          priceFormula: 3200,
          createdBy: 40152856,
        }
      },
      createdBy: 40152856,
    }]
  },
  attachments: {
    create: [{
      title: 'file1',
      type: 'file',
      tags: ['tag1', 'tag2'],
      size: 100,
      category: 'category1',
      description: 'description1',
      path: 'path1',
      contentType: 'doc',
      allowedUsers: [],
      createdBy: 40152856,
    }]
  },
  bookmarks: {
    create: [{
      title: 'bookmark1',
      address: 'address1',
      createdBy: 40152856,
    }]
  },
  members: {
    create: [{
      userId: 8547899,
      role: 'customer',
      isPrimary: true,
      handle: 'TonyJ',
      email: 'tonyj@tc.com',
      firstName: 'tony',
      lastName: 'j',
      createdBy: 40152856,
    }, {
      userId: 22742764,
      role: 'copilot',
      isPrimary: true,
      handle: 'phead',
      email: 'pheadc@tc.com',
      firstName: 'pheadC',
      lastName: 'pc',
      createdBy: 40152856,
    }]
  },
  memberInvites: {
    create: [{
      userId: 8547866,
      email: 'tonyj@tc.com',
      applicationId: 20001,
      role: 'manager',
      status: 'pending',
      createdBy: 40152856,
    },
    {
      userId: 22742765,
      email: 'pheadj@tc.com',
      applicationId: 20001,
      role: 'copilot',
      status: 'requested',
      createdBy: 40152856,
    },
    {
      userId: 22742755,
      email: 'pheadc@tc.com',
      applicationId: 20001,
      role: 'customer',
      status: 'pending',
      createdBy: 40152856,
    }]
  },
  phases: {
    create: [
      {
        name: 'UI/UX ',
        status: 'active',
        spentBudget: 0,
        requirements: null,
        details: {},
        startDate: '2025-01-30T00:00:00.000Z',
        endDate: '2025-02-19T00:00:00.000Z',
        description: 'UI of responsive minisite design',
        duration: null,
        budget: 0,
        order: null,
        progress: 0,
        products: {
          create: [
            {
              actualPrice: 0,
              billingAccountId: null,
              templateId: 67,
              type: 'generic-product',
              estimatedPrice: 0,
              name: 'Generic Product',
              details: {},
              directProjectId: null,
              projectId: 1000336,
              createdBy: 22736560,
              createdAt: '2025-01-30T00:59:36.696Z',
              updatedBy: 22736560,
              updatedAt: '2025-01-30T00:59:36.696Z'
            },
            {

              actualPrice: 1,
              billingAccountId: 80004243,
              type: 'generic-product',
              templateId: 67,
              estimatedPrice: 1,
              name: 'Generic Product',
              details: {
                challengeGuid: '8371596f-8c9a-4b47-b562-0842d1dc3a77'
              },
              directProjectId: 42781,
              projectId: 1000336,
              createdBy: 22736560,
              createdAt: '2025-02-01T01:33:19.234Z',
              updatedBy: 22736560,
              updatedAt: '2025-02-01T01:33:19.234Z',
            },
            {
              actualPrice: 1,
              billingAccountId: 80004243,
              type: 'generic-product',
              templateId: 67,
              estimatedPrice: 1,
              name: 'Generic Product',
              details: {
                challengeGuid: '159040f5-a3ca-435f-9d97-8db7e9472440'
              },
              directProjectId: 42781,
              projectId: 1000336,
              createdAt: '2025-03-03T00:02:42.668Z',
              createdBy: 22736560,
              updatedAt: '2025-03-03T00:02:42.669Z',
              updatedBy: 22736560,
            }
          ],
        },
        members: {
          create: [
            {
              userId: 22736560,
              createdBy: 22736560,
              createdAt: '2025-01-30T00:59:36.719Z',
              updatedBy: 22736560,
              updatedAt: '2025-01-30T00:59:36.720Z'
            }
          ]
        },
        createdAt: '2025-01-30T00:59:36.673Z',
        createdBy: 22736560,
        updatedAt: '2025-01-30T00:59:36.674Z',
        updatedBy: 22736560,

      }
   ],
  },
  createdBy: 40152856,
  createdAt: '2020-05-05T10:10:47.007Z',
  updatedBy: 40152856,
  updatedAt: '2020-05-05T10:10:47.008Z',
  deletedBy: null,
  deletedAt: null,
  lastActivityAt: '2020-05-05T10:10:46.988Z',
  lastActivityUserId: 40152856
}

const projectData2: Prisma.ProjectCreateInput = {
  id: 102,
  status: 'active',
  name: 'App New2',
  description: null,
  projectFullText: null,
  billingAccountId: null,
  directProjectId: 1002,
  type: 'scoped-solutions',
  version: null,
  templateId: null,
  estimatedPrice: null,
  actualPrice: null,
  cancelReason: null,
  terms: [],
  groups: [],
  projectUrl: 'http://project.example.com',
  members: {
    create: [{
      userId: 8547899,
      role: 'copilot',
      isPrimary: true,
      handle: 'bill',
      email: 'bill@tc.com',
      firstName: 'bill',
      lastName: 'j',
      createdBy: 40152856,
    }, {
      userId: 22742764,
      role: 'copilot',
      isPrimary: true,
      handle: 'phead',
      email: 'pheadc@tc.com',
      firstName: 'pheadB',
      lastName: 'pb',
      createdBy: 40152856,
    }]
  },
  createdBy: 40152856,
  createdAt: '2020-05-06T10:10:47.007Z',
  updatedBy: 40152856,
  updatedAt: '2020-05-06T10:10:47.008Z',
  deletedBy: null,
  deletedAt: null,
  lastActivityAt: '2020-05-06T10:10:46.988Z',
  lastActivityUserId: 40152856
}

const projectData3: Prisma.ProjectCreateInput = {
  id: 103,
  status: 'paused',
  name: 'App Deleted 1',
  description: null,
  projectFullText: 'project full text all',
  billingAccountId: 1003,
  directProjectId: 1001,
  type: 'scoped-solutions',
  version: null,
  templateId: null,
  estimatedPrice: null,
  actualPrice: null,
  cancelReason: null,
  terms: [],
  groups: [],
  projectUrl: 'http://project.example.com',
  details: {
    create: {
      products: ['product3', 'product4'],
      intakePurpose: 'demo-test-other',
      hideDiscussions: false,
      createdBy: 40152856,
      utm: {
        create: {
          code: 'code123',
          createdBy: 40152856,
        }
      },
    }
  },
  members: {
    create: [{
      userId: 8547899,
      role: 'customer',
      isPrimary: true,
      handle: 'TonyJ',
      email: 'tonyj@tc.com',
      firstName: 'tony',
      lastName: 'j',
      createdBy: 40152856,
    }, {
      userId: 22742764,
      role: 'copilot',
      isPrimary: true,
      handle: 'phead',
      email: 'pheadc@tc.com',
      firstName: 'pheadC',
      lastName: 'pc',
      createdBy: 40152856,
    }]
  },
  createdBy: 40152856,
  createdAt: '2020-05-07T10:10:47.007Z',
  updatedBy: 40152856,
  updatedAt: '2020-05-07T10:10:47.008Z',
  deletedBy: 40152856,
  deletedAt: '2025-05-07T10:10:47.008Z',
  lastActivityAt: '2020-05-07T10:10:46.988Z',
  lastActivityUserId: 40152856
}

const projectData4: Prisma.ProjectCreateInput = {
  id: 104,
  status: 'active',
  name: 'App New 4',
  type: 'generic',
  terms: [],
  groups: [],
  members: {
    create: [{
      userId: 8547899,
      role: 'customer',
      isPrimary: true,
      handle: 'TonyJ',
      email: 'tonyj@tc.com',
      firstName: 'tony',
      lastName: 'j',
      createdBy: 40152856,
    }, {
      userId: 22742764,
      role: 'copilot',
      isPrimary: true,
      handle: 'phead',
      email: 'pheadc@tc.com',
      firstName: 'pheadC',
      lastName: 'pc',
      createdBy: 40152856,
    }]
  },
  createdBy: 40152856,
  createdAt: '2020-05-14T10:10:47.007Z',
  updatedBy: 40152856,
  updatedAt: '2020-05-14T10:10:47.008Z',
  deletedBy: null,
  deletedAt: null,
  lastActivityAt: '2020-05-14T10:10:46.988Z',
  lastActivityUserId: 40152856
}

const projectData5: Prisma.ProjectCreateInput = {
  id: 105,
  status: 'active',
  name: 'App New 5',
  type: 'generic',
  terms: [],
  groups: [],
  members: {
    create: [{
      userId: 8547899,
      role: 'customer',
      isPrimary: true,
      handle: 'TonyJ',
      email: 'tonyj@tc.com',
      firstName: 'tony',
      lastName: 'j',
      createdBy: 40152856,
    }, {
      userId: 22742764,
      role: 'copilot',
      isPrimary: true,
      handle: 'phead',
      email: 'pheadc@tc.com',
      firstName: 'pheadC',
      lastName: 'pc',
      createdBy: 40152856,
    }]
  },
  createdBy: 40152856,
  createdAt: '2020-05-15T10:10:47.007Z',
  updatedBy: 40152856,
  updatedAt: '2020-05-15T10:10:47.008Z',
  deletedBy: null,
  deletedAt: null,
  lastActivityAt: '2020-05-14T10:10:46.988Z',
  lastActivityUserId: 40152856
}

const projectData6: Prisma.ProjectCreateInput = {
  id: 106,
  status: 'active',
  name: 'App New 6',
  type: 'generic',
  terms: [],
  groups: [],
  members: {
    create: [{
      userId: 8547899,
      role: 'customer',
      isPrimary: true,
      handle: 'TonyJ',
      email: 'tonyj@tc.com',
      firstName: 'tony',
      lastName: 'j',
      createdBy: 40152856,
    }, {
      userId: 22742764,
      role: 'copilot',
      isPrimary: true,
      handle: 'phead',
      email: 'pheadc@tc.com',
      firstName: 'pheadC',
      lastName: 'pc',
      createdBy: 40152856,
    }]
  },
  createdBy: 40152856,
  createdAt: '2020-05-16T10:10:47.007Z',
  updatedBy: 40152856,
  updatedAt: '2020-05-16T10:10:47.008Z',
  deletedBy: null,
  deletedAt: null,
  lastActivityAt: '2020-05-16T10:10:46.988Z',
  lastActivityUserId: 40152856
}


async function clearDB() {
  await prisma.productTemplate.deleteMany();
  await prisma.planConfig.deleteMany();
  await prisma.projectHistory.deleteMany();
  await prisma.projectTemplate.deleteMany();
  await prisma.projectDetailUtm.deleteMany();
  await prisma.projectDetailSetting.deleteMany();
  await prisma.projectDetailAppDefinition.deleteMany();
  await prisma.projectDetailProjectData.deleteMany();
  await prisma.projectDetailTechstack.deleteMany();
  await prisma.projectDetailApiDefinition.deleteMany();
  await prisma.projectDetail.deleteMany();
  await prisma.projectUtm.deleteMany();
  await prisma.projectExternal.deleteMany();
  await prisma.challengeEligibility.deleteMany();
  await prisma.projectEstimationMetadata.deleteMany();
  await prisma.projectEstimation.deleteMany();
  await prisma.projectAttachment.deleteMany();
  await prisma.projectBookmark.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.projectMemberInvite.deleteMany();
  await prisma.projectPhaseMember.deleteMany();
  await prisma.projectPhaseProduct.deleteMany();
  await prisma.projectPhase.deleteMany();
  await prisma.project.deleteMany();
  await prisma.projectType.deleteMany();
}

async function main() {
  console.log(`Clear DB data ...`);

  await clearDB();

  console.log(`Start seeding ...`);

  await prisma.projectType.createMany({
    data: projectTypeData,
  });
  console.log(`Created project type data`);

  await prisma.productTemplate.createMany({
    data: productTemplateData,
  });
  console.log(`Created product template data`);

  await prisma.planConfig.createMany({
    data: planConfigData,
  });
  console.log(`Created plan config data`);

  const projectTemplate1 = await prisma.projectTemplate.create({
    data: projectTemplateData1,
  });
  console.log(`Created project template data with id: `, projectTemplate1.id);

  const projectTemplate2 = await prisma.projectTemplate.create({
    data: projectTemplateData2,
  });
  console.log(`Created project template data with id: `, projectTemplate2.id);

  const project1 = await prisma.project.create({
    data: projectData1,
  });
  console.log(`Created project data with id: `, project1.id);

  const project2 = await prisma.project.create({
    data: projectData2,
  });
  console.log(`Created project data with id: `, project2.id);

  const project3 = await prisma.project.create({
    data: projectData3,
  });
  console.log(`Created project data with id: `, project3.id);

  const project4 = await prisma.project.create({
    data: projectData4,
  });
  console.log(`Created project data with id: `, project4.id);

  const project5 = await prisma.project.create({
    data: projectData5,
  });
  console.log(`Created project data with id: `, project5.id);

  const project6 = await prisma.project.create({
    data: projectData6,
  });
  console.log(`Created project data with id: `, project6.id);
  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
