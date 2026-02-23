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

export interface InviteEmailOptions {
  isSSO?: boolean;
}

const EXTERNAL_ACTION_EMAIL_TOPIC = 'external.action.email';
const DEFAULT_INVITE_EMAIL_SUBJECT = 'You are invited to Topcoder';
const DEFAULT_INVITE_EMAIL_SECTION_TITLE = 'Project Invitation';

/**
 * Project-invite email publisher.
 *
 * Publishes invite email events to the Topcoder event bus, which forwards
 * them to `tc-email-service` for SendGrid delivery.
 *
 * Used by the project-invite service after an invite is created.
 */
@Injectable()
export class EmailService {
  private readonly logger = LoggerService.forRoot('EmailService');

  constructor(private readonly eventBusService: EventBusService) {}

  /**
   * Publishes a project invite email event.
   *
   * No-ops when `invite.email` is empty or when
   * `SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED` is unset.
   *
   * Publishes payload to `external.action.email`.
   *
   * @param projectId project id for context and payload
   * @param invite invite payload containing recipient info
   * @param initiator invite initiator details
   * @param projectName optional project display name
   * @param options additional invite-email options
   * @returns resolved promise when publish succeeds or is skipped
   */
  async sendInviteEmail(
    projectId: string,
    invite: InviteEmailPayload,
    initiator: InviteEmailInitiator,
    projectName?: string,
    options?: InviteEmailOptions,
  ): Promise<void> {
    const recipient = invite.email?.trim().toLowerCase();
    // TODO: add basic email format validation before publishing the event.

    if (!recipient) {
      this.logger.warn(
        `Skipping invite email publish for projectId=${projectId}: recipient email is missing.`,
      );
      return;
    }

    // TODO: validate this env var at startup and throw if missing, rather than silently skipping.
    // TODO: cache these values as private readonly fields in the constructor, consistent with other services.
    const templateId = process.env.SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED;
    if (!templateId) {
      this.logger.warn(
        `Skipping invite email publish for projectId=${projectId} recipient=${recipient}: SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED is not configured.`,
      );
      return;
    }

    const normalizedProjectName = projectName?.trim() || `Project ${projectId}`;
    const payload = {
      data: {
        // TODO: cache these values as private readonly fields in the constructor, consistent with other services.
        workManagerUrl: process.env.WORK_MANAGER_URL || '',
        // TODO: cache these values as private readonly fields in the constructor, consistent with other services.
        accountsAppURL: process.env.ACCOUNTS_APP_URL || '',
        subject:
          // TODO: cache these values as private readonly fields in the constructor, consistent with other services.
          process.env.INVITE_EMAIL_SUBJECT || DEFAULT_INVITE_EMAIL_SUBJECT,
        projects: [
          {
            name: normalizedProjectName,
            projectId,
            sections: [
              {
                EMAIL_INVITES: true,
                title:
                  // TODO: cache these values as private readonly fields in the constructor, consistent with other services.
                  process.env.INVITE_EMAIL_SECTION_TITLE ||
                  DEFAULT_INVITE_EMAIL_SECTION_TITLE,
                projectName: normalizedProjectName,
                projectId,
                initiator: this.normalizeInitiator(initiator),
                isSSO: options?.isSSO ?? false,
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
      this.logger.log(
        `Publishing invite email event to ${EXTERNAL_ACTION_EMAIL_TOPIC} for projectId=${projectId} recipient=${recipient}`,
      );
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

  /**
   * Normalizes initiator details and applies display-name defaults.
   *
   * @param initiator initiator details from API/service context
   * @returns normalized initiator with `'Connect'/'User'` defaults
   */
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
