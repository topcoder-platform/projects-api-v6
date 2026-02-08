import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetadataReferenceSchema {
  @ApiProperty({ example: 'design' })
  key: string;

  @ApiProperty({ example: 1 })
  version: number;
}

export const METADATA_SWAGGER_EXAMPLES = {
  projectTemplateCreate: {
    name: 'Standard Development Project',
    key: 'dev_project',
    category: 'development',
    icon: 'https://cdn.example.com/icons/dev.svg',
    question: 'What do you want to build?',
    info: 'Template for software development projects',
    aliases: ['dev', 'software'],
    form: {
      key: 'dev_form',
      version: 2,
    },
    planConfig: {
      key: 'dev_plan',
      version: 1,
    },
    priceConfig: {
      key: 'dev_price',
      version: 1,
    },
  },
  productTemplateCreate: {
    name: 'Challenge Product',
    productKey: 'challenge_product',
    category: 'development',
    subCategory: 'challenge',
    icon: 'https://cdn.example.com/icons/challenge.svg',
    brief: 'Challenge delivery',
    details: 'Configures a challenge-based product setup',
    aliases: ['challenge'],
    form: {
      key: 'challenge_form',
      version: 3,
    },
  },
};

export const EVENT_SWAGGER_EXAMPLES = {
  resourceProjectUpdated: {
    summary: 'Resource event: project updated',
    value: {
      topic: 'project.updated',
      originator: 'project-service-v6',
      timestamp: '2026-02-07T12:00:00.000Z',
      'mime-type': 'application/json',
      payload: {
        resource: 'project',
        data: {
          id: '1001',
          name: 'Demo Project',
          status: 'active',
        },
      },
    },
  },
  resourceInviteCreated: {
    summary: 'Resource event: invite created',
    value: {
      topic: 'project.member.invite.created',
      originator: 'project-service-v6',
      timestamp: '2026-02-07T12:01:00.000Z',
      'mime-type': 'application/json',
      payload: {
        resource: 'project.member.invite',
        data: {
          id: '3001',
          projectId: '1001',
          role: 'customer',
          status: 'pending',
          email: 'member@topcoder.com',
          userId: '123',
        },
      },
    },
  },
  notificationProjectUpdated: {
    summary: 'Notification event: project updated',
    value: {
      topic: 'connect.notification.project.updated',
      originator: 'project-service-v6',
      timestamp: '2026-02-07T12:02:00.000Z',
      'mime-type': 'application/json',
      payload: {
        projectId: '1001',
        projectName: 'Demo Project',
        projectUrl: 'https://platform.topcoder.com/connect/projects/1001',
        userId: '123',
        initiatorUserId: '123',
      },
    },
  },
  notificationInviteSent: {
    summary: 'Notification event: invite sent',
    value: {
      topic: 'connect.notification.project.member.invite.sent',
      originator: 'project-service-v6',
      timestamp: '2026-02-07T12:03:00.000Z',
      'mime-type': 'application/json',
      payload: {
        projectId: '1001',
        inviteId: '3001',
        role: 'customer',
        email: 'member@topcoder.com',
        userId: '123',
        initiatorUserId: '99',
      },
    },
  },
  notificationInviteAccepted: {
    summary: 'Notification event: invite accepted',
    value: {
      topic: 'connect.notification.project.member.invite.accepted',
      originator: 'project-service-v6',
      timestamp: '2026-02-07T12:04:00.000Z',
      'mime-type': 'application/json',
      payload: {
        projectId: '1001',
        inviteId: '3001',
        memberId: '5001',
        role: 'customer',
        email: 'member@topcoder.com',
        userId: '123',
        initiatorUserId: '123',
      },
    },
  },
} as const;

export class ResourceEventPayloadSchema {
  @ApiProperty({ example: 'project' })
  resource: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      id: '1001',
      name: 'Demo Project',
      status: 'active',
    },
  })
  data: Record<string, unknown>;
}

export class ResourceEventSchema {
  @ApiProperty({ example: 'project.updated' })
  topic: string;

  @ApiProperty({ example: 'project-service-v6' })
  originator: string;

  @ApiProperty({ example: '2026-02-07T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 'application/json', name: 'mime-type' })
  'mime-type': string;

  @ApiProperty({
    type: ResourceEventPayloadSchema,
    example: EVENT_SWAGGER_EXAMPLES.resourceProjectUpdated.value.payload,
  })
  payload: ResourceEventPayloadSchema;
}

export class NotificationEventPayloadSchema {
  @ApiProperty({ example: '1001' })
  projectId: string;

  @ApiPropertyOptional({ example: 'Demo Project' })
  projectName?: string;

  @ApiPropertyOptional({
    example: 'https://platform.topcoder.com/connect/projects/1001',
  })
  projectUrl?: string;

  @ApiPropertyOptional({ example: '3001' })
  inviteId?: string;

  @ApiPropertyOptional({ example: '5001' })
  memberId?: string;

  @ApiPropertyOptional({ example: 'customer' })
  role?: string;

  @ApiPropertyOptional({ example: 'member@topcoder.com' })
  email?: string;

  @ApiPropertyOptional({ example: 'member' })
  handle?: string;

  @ApiPropertyOptional({ example: '123' })
  userId?: string;

  @ApiProperty({ example: '123' })
  initiatorUserId: string;

  @ApiPropertyOptional({ example: 'utm-spring-campaign' })
  refCode?: string;
}

export class NotificationEventSchema {
  @ApiProperty({ example: 'connect.notification.project.updated' })
  topic: string;

  @ApiProperty({ example: 'project-service-v6' })
  originator: string;

  @ApiProperty({ example: '2026-02-07T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 'application/json', name: 'mime-type' })
  'mime-type': string;

  @ApiProperty({
    type: NotificationEventPayloadSchema,
    example: EVENT_SWAGGER_EXAMPLES.notificationProjectUpdated.value.payload,
  })
  payload: NotificationEventPayloadSchema;
}

export const EVENT_SWAGGER_MODELS = [
  ResourceEventPayloadSchema,
  ResourceEventSchema,
  NotificationEventPayloadSchema,
  NotificationEventSchema,
] as const;
