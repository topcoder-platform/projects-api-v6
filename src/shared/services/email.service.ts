import { Injectable } from '@nestjs/common';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';

export interface InviteEmailPayload {
  id?: string | number | bigint;
  projectId?: string | number | bigint;
  role?: string;
  email?: string | null;
  status?: string;
  firstName?: string | null;
  lastName?: string | null;
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
const TOPCODER_PROD_ROOT_URL = 'topcoder.com';
const TOPCODER_DEV_ROOT_URL = 'topcoder-dev.com';
const DEFAULT_INVITE_EMAIL_SUBJECT = 'You are invited to Topcoder';
const DEFAULT_INVITE_EMAIL_SECTION_TITLE = 'Project Invitation';

type KnownUserInviteTemplatePayload = {
  projectName: string;
  firstName: string;
  lastName: string;
  projectId: string;
  joinProjectUrl: string;
  declineProjectUrl: string;
  initiatorFirstName: string;
  initiatorLastName: string;
};

type UnknownUserInviteTemplatePayload = {
  projectName: string;
  firstName: string;
  lastName: string;
  projectId: string;
  registerUrl: string;
  initiatorFirstName: string;
  initiatorLastName: string;
};

type LegacyInviteTemplatePayload = {
  workManagerUrl: string;
  accountsAppURL: string;
  subject: string;
  projects: Array<{
    name: string;
    projectId: string;
    sections: Array<{
      EMAIL_INVITES: boolean;
      title: string;
      projectName: string;
      projectId: string;
      initiator: InviteEmailInitiator;
      isSSO: boolean;
    }>;
  }>;
};

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
   * No-ops when `invite.email` is empty, `invite.id` is missing, or when
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

    const inviteId = this.normalizeId(invite.id);
    if (!inviteId) {
      this.logger.warn(
        `Skipping invite email publish for projectId=${projectId} recipient=${recipient}: invite id is missing.`,
      );
      return;
    }

    const isKnownUser = Boolean(options?.isSSO);
    const templateId = this.resolveInviteTemplateId(isKnownUser);
    if (!templateId) {
      this.logger.warn(
        `Skipping invite email publish for projectId=${projectId} recipient=${recipient}: no invite template id is configured for knownUser=${String(isKnownUser)}.`,
      );
      return;
    }

    const normalizedProjectId = String(projectId).trim();
    const normalizedProjectName = projectName?.trim() || `Project ${projectId}`;
    const rootUrl = this.resolveRootUrl();
    const joinProjectUrl = this.buildWorkInviteActionUrl(
      rootUrl,
      normalizedProjectId,
      inviteId,
      'accept',
    );
    const declineProjectUrl = this.buildWorkInviteActionUrl(
      rootUrl,
      normalizedProjectId,
      inviteId,
      'decline',
    );
    const registerUrl = this.buildRegisterUrl(rootUrl, joinProjectUrl);
    const normalizedInitiator = this.normalizeInitiator(initiator);
    const knownUserPayload: KnownUserInviteTemplatePayload = {
      projectName: normalizedProjectName,
      firstName: this.normalizeName(invite.firstName),
      lastName: this.normalizeName(invite.lastName),
      projectId: normalizedProjectId,
      joinProjectUrl,
      declineProjectUrl,
      initiatorFirstName: this.normalizeName(normalizedInitiator.firstName),
      initiatorLastName: this.normalizeName(normalizedInitiator.lastName),
    };
    const unknownUserPayload: UnknownUserInviteTemplatePayload = {
      projectName: normalizedProjectName,
      firstName: this.normalizeName(invite.firstName),
      lastName: this.normalizeName(invite.lastName),
      projectId: normalizedProjectId,
      registerUrl,
      initiatorFirstName: this.normalizeName(normalizedInitiator.firstName),
      initiatorLastName: this.normalizeName(normalizedInitiator.lastName),
    };
    const useLegacyPayload = this.isLegacyTemplateId(templateId);

    const payload = {
      data: useLegacyPayload
        ? this.buildLegacyInviteTemplatePayload(
            normalizedProjectName,
            normalizedProjectId,
            normalizedInitiator,
            isKnownUser,
          )
        : isKnownUser
          ? knownUserPayload
          : unknownUserPayload,
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
   * Checks whether selected template id maps to the legacy invite template.
   *
   * @param templateId Resolved template id.
   * @returns `true` when legacy template id is being used.
   */
  private isLegacyTemplateId(templateId: string): boolean {
    const legacyTemplateId =
      process.env.SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED;
    return Boolean(legacyTemplateId && templateId === legacyTemplateId);
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

  /**
   * Builds payload expected by legacy invite template.
   *
   * @param projectName Project display name.
   * @param projectId Project id.
   * @param initiator Normalized invite initiator.
   * @param isKnownUser Whether invite target already has a Topcoder account.
   * @returns Legacy invite payload data.
   */
  private buildLegacyInviteTemplatePayload(
    projectName: string,
    projectId: string,
    initiator: InviteEmailInitiator,
    isKnownUser: boolean,
  ): LegacyInviteTemplatePayload {
    return {
      workManagerUrl: process.env.WORK_MANAGER_URL || '',
      accountsAppURL: process.env.ACCOUNTS_APP_URL || '',
      subject: process.env.INVITE_EMAIL_SUBJECT || DEFAULT_INVITE_EMAIL_SUBJECT,
      projects: [
        {
          name: projectName,
          projectId,
          sections: [
            {
              EMAIL_INVITES: true,
              title:
                process.env.INVITE_EMAIL_SECTION_TITLE ||
                DEFAULT_INVITE_EMAIL_SECTION_TITLE,
              projectName,
              projectId,
              initiator,
              isSSO: isKnownUser,
            },
          ],
        },
      ],
    };
  }

  /**
   * Resolves the Topcoder root URL for invite links.
   *
   * `production` uses `topcoder.com`; all other environments use
   * `topcoder-dev.com`.
   *
   * @returns Root URL domain.
   */
  private resolveRootUrl(): string {
    return process.env.NODE_ENV === 'production'
      ? TOPCODER_PROD_ROOT_URL
      : TOPCODER_DEV_ROOT_URL;
  }

  /**
   * Builds a Work app invite action URL.
   *
   * @param rootUrl Root URL domain.
   * @param projectId Project id.
   * @param inviteId Invite id.
   * @param action URL action segment (`accept` or `decline`).
   * @returns Work invite action URL.
   */
  private buildWorkInviteActionUrl(
    rootUrl: string,
    projectId: string,
    inviteId: string,
    action: 'accept' | 'decline',
  ): string {
    return `https://work.${rootUrl}/projects/${projectId}/${action}/${inviteId}`;
  }

  /**
   * Builds accounts registration URL for unknown-user invites.
   *
   * @param rootUrl Root URL domain.
   * @param returnUrl Return URL after registration.
   * @returns Accounts sign-up URL including regSource and return URL.
   */
  private buildRegisterUrl(rootUrl: string, returnUrl: string): string {
    return `https://accounts.${rootUrl}/?mode=signUp&regSource=tcBusiness&retUrl=${returnUrl}`;
  }

  /**
   * Normalizes template name values to plain strings.
   *
   * @param value Raw name value.
   * @returns Trimmed string or empty string.
   */
  private normalizeName(value?: string | null): string {
    return String(value || '').trim();
  }

  /**
   * Converts id-like values to trimmed string.
   *
   * @param value Raw id-like value.
   * @returns Normalized id string or null when empty.
   */
  private normalizeId(value?: string | number | bigint | null): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
