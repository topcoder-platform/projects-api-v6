import { Injectable } from '@nestjs/common';
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

  sendInviteEmail(
    projectId: string,
    invite: InviteEmailPayload,
    initiator: InviteEmailInitiator,
    projectName?: string,
  ): Promise<void> {
    if (!invite.email) {
      return Promise.resolve();
    }

    const templateId = process.env.SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED;
    if (!templateId) {
      this.logger.warn(
        'SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED is not configured.',
      );
      return Promise.resolve();
    }

    // Keep invite email hook as a no-op because only project.* topics remain active.
    void projectId;
    void initiator;
    void projectName;
    void templateId;
    this.logger.warn('Invite email Kafka publication is disabled.');
    return Promise.resolve();
  }
}
