import { Injectable } from '@nestjs/common';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';

export interface InviteEmailPayload {
  id?: string | number | bigint;
  projectId?: string | number | bigint;
  role?: string;
  email?: string | null;
  status?: string;
}

export interface InviteEmailInitiator {
  userId?: string;
  handle?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

const EXTERNAL_ACTION_EMAIL_TOPIC = 'external.action.email';
const DEFAULT_INVITE_EMAIL_SUBJECT = 'You are invited to Topcoder';
const DEFAULT_INVITE_EMAIL_SECTION_TITLE = 'Project Invitation';

@Injectable()
export class EmailService {
  private readonly logger = LoggerService.forRoot('EmailService');

  constructor(private readonly eventBusService: EventBusService) {}

  async sendInviteEmail(
    projectId: string,
    invite: InviteEmailPayload,
    initiator: InviteEmailInitiator,
    projectName?: string,
  ): Promise<void> {
    const recipient = invite.email?.trim().toLowerCase();

    if (!recipient) {
      return;
    }

    const templateId = process.env.SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED;
    if (!templateId) {
      this.logger.warn(
        'SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED is not configured.',
      );
      return;
    }

    const normalizedProjectName = projectName?.trim() || `Project ${projectId}`;
    const payload = {
      data: {
        workManagerUrl: process.env.WORK_MANAGER_URL || '',
        accountsAppURL: process.env.ACCOUNTS_APP_URL || '',
        subject:
          process.env.INVITE_EMAIL_SUBJECT || DEFAULT_INVITE_EMAIL_SUBJECT,
        projects: [
          {
            name: normalizedProjectName,
            projectId,
            sections: [
              {
                EMAIL_INVITES: true,
                title:
                  process.env.INVITE_EMAIL_SECTION_TITLE ||
                  DEFAULT_INVITE_EMAIL_SECTION_TITLE,
                projectName: normalizedProjectName,
                projectId,
                initiator: this.normalizeInitiator(initiator),
                isSSO: false,
              },
            ],
          },
        ],
      },
      sendgrid_template_id: templateId,
      recipients: [recipient],
      version: 'v3',
    };

    try {
      await this.eventBusService.publishProjectEvent(
        EXTERNAL_ACTION_EMAIL_TOPIC,
        payload,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish invite email event to ${EXTERNAL_ACTION_EMAIL_TOPIC} for projectId=${projectId} recipient=${recipient}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private normalizeInitiator(
    initiator: InviteEmailInitiator,
  ): InviteEmailInitiator {
    return {
      userId: initiator.userId,
      handle: initiator.handle,
      firstName: initiator.firstName || 'Connect',
      lastName: initiator.lastName || 'User',
      email: initiator.email,
    };
  }
}
