import { Injectable } from '@nestjs/common';
import { getBusApiClient } from 'src/shared/utils/event.utils';
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

@Injectable()
export class EmailService {
  private readonly logger = LoggerService.forRoot('EmailService');

  async sendInviteEmail(
    projectId: string,
    invite: InviteEmailPayload,
    initiator: InviteEmailInitiator,
    projectName?: string,
  ): Promise<void> {
    if (!invite.email) {
      return;
    }

    const templateId = process.env.SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED;
    if (!templateId) {
      this.logger.warn(
        'SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED is not configured.',
      );
      return;
    }

    const workManagerUrl = process.env.WORK_MANAGER_URL || '';
    const accountsAppUrl = process.env.ACCOUNTS_APP_URL || '';
    const invitePath = `${workManagerUrl.replace(/\/$/, '')}/projects/${projectId}`;

    try {
      const client = await getBusApiClient();

      await client.postEvent({
        topic: 'external.action.email',
        originator: 'project-service-v6',
        timestamp: new Date().toISOString(),
        'mime-type': 'application/json',
        payload: {
          data: {
            workManagerUrl,
            accountsAppURL: accountsAppUrl,
            subject: process.env.INVITE_EMAIL_SUBJECT,
            projects: [
              {
                name: projectName || `Project ${projectId}`,
                projectId,
                sections: [
                  {
                    EMAIL_INVITES: true,
                    title: process.env.INVITE_EMAIL_SECTION_TITLE,
                    projectName: projectName || `Project ${projectId}`,
                    projectId,
                    inviteLink: invitePath,
                    role: invite.role,
                    initiator,
                  },
                ],
              },
            ],
          },
          sendgrid_template_id: templateId,
          recipients: [invite.email],
          version: 'v3',
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send invite email for projectId=${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
