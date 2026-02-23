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
  /**
   * Indicates invite target already has a Topcoder account.
   *
   * `true` uses the known-user invite template and Join/Decline flow.
   * `false` uses the unknown-user invite template and Register flow.
   */
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
   * no invite template id env var can be resolved.
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

    const templateId = this.resolveInviteTemplateId(Boolean(options?.isSSO));
    if (!templateId) {
      this.logger.warn(
        `Skipping invite email publish for projectId=${projectId} recipient=${recipient}: no invite template id is configured for knownUser=${String(Boolean(options?.isSSO))}.`,
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
   * Resolves invite email template id by target account state.
   *
   * Prefers dedicated known/unknown template env vars and falls back to the
   * legacy `SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED` for compatibility.
   *
   * @param isKnownUser Whether the invite target is an existing Topcoder user.
   * @returns SendGrid template id, or `null` when no compatible env var exists.
   */
  private resolveInviteTemplateId(isKnownUser: boolean): string | null {
    const knownTemplateId =
      process.env.SENDGRID_PROJECT_INVITATION_KNOWN_USER_TEMPLATE_ID;
    const unknownTemplateId =
      process.env.SENDGRID_PROJECT_INVITATION_UNKNOWN_USER_TEMPLATE_ID;
    const legacyTemplateId =
      process.env.SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED;

    if (isKnownUser) {
      return knownTemplateId || legacyTemplateId || null;
    }

    return unknownTemplateId || legacyTemplateId || null;
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
