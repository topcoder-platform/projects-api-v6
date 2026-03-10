import { Injectable } from '@nestjs/common';
import {
  CopilotApplication,
  CopilotOpportunity,
  CopilotOpportunityType,
  CopilotRequest,
} from '@prisma/client';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { MemberService } from 'src/shared/services/member.service';
import {
  getCopilotRequestData,
  getCopilotTypeLabel,
  readString,
} from './copilot.utils';

// TODO [CONFIG]: TEMPLATE_IDS are hardcoded SendGrid template ids; move these values to environment-based configuration.
const TEMPLATE_IDS = {
  APPLY_COPILOT: 'd-d7c1f48628654798a05c8e09e52db14f',
  CREATE_REQUEST: 'd-3efdc91da580479d810c7acd50a4c17f',
  INFORM_PM_COPILOT_APPLICATION_ACCEPTED: 'd-b35d073e302b4279a1bd208fcfe96f58',
  COPILOT_APPLICATION_ACCEPTED: 'd-eef5e7568c644940b250e76d026ced5b',
  COPILOT_ALREADY_PART_OF_PROJECT: 'd-003d41cdc9de4bbc9e14538e8f2e0585',
  COPILOT_OPPORTUNITY_COMPLETED: 'd-dc448919d11b4e7d8b4ba351c4b67b8b',
  COPILOT_OPPORTUNITY_CANCELED: 'd-2a67ba71e82f4d70891fe6989c3522a3',
} as const;
const EXTERNAL_ACTION_EMAIL_TOPIC = 'external.action.email';

type OpportunityWithRequest = CopilotOpportunity & {
  copilotRequest?: CopilotRequest | null;
};

type ApplicationWithMembership = CopilotApplication & {
  existingMembership?: {
    role?: string;
  };
};

type NotificationRecipient = {
  userId?: string | number | bigint | null;
  email?: string | null;
  handle?: string | null;
};

/**
 * Email notification dispatcher for copilot lifecycle events.
 */
@Injectable()
export class CopilotNotificationService {
  private readonly logger = LoggerService.forRoot('CopilotNotificationService');

  constructor(
    private readonly memberService: MemberService,
    private readonly eventBusService: EventBusService,
  ) {}

  async sendOpportunityPostedNotification(
    opportunity: CopilotOpportunity,
    copilotRequest?: CopilotRequest | null,
  ): Promise<void> {
    const roleSubjects = await this.memberService.getRoleSubjects(
      UserRole.TC_COPILOT,
    );

    const recipients = await this.deduplicateRecipientsByEmail(roleSubjects);
    const requestData = getCopilotRequestData(copilotRequest?.data);
    const opportunityType = this.resolveOpportunityType(
      opportunity,
      requestData,
    );
    const templateId =
      process.env.SENDGRID_TEMPLATE_COPILOT_REQUEST_CREATED ||
      TEMPLATE_IDS.CREATE_REQUEST;

    if (recipients.length > 0) {
      await Promise.all(
        recipients.map((recipient) =>
          this.publishEmail(templateId, [recipient.email], {
            user_name: recipient.handle || 'Copilot',
            opportunity_details_url: `${this.getCopilotPortalUrl()}/opportunity/${opportunity.id.toString()}`,
            work_manager_url: this.getWorkManagerUrl(),
            opportunity_type: getCopilotTypeLabel(opportunityType),
            opportunity_title:
              readString(requestData.opportunityTitle) ||
              `Opportunity ${opportunity.id.toString()}`,
            start_date: this.formatDate(requestData.startDate),
          }),
        ),
      );
    }

    if (recipients.length === 0) {
      this.logger.warn(
        `No copilot email recipients resolved for opportunity=${opportunity.id.toString()}. Only slack recipient (if configured) will be notified.`,
      );
    }

    const slackRecipient = String(process.env.COPILOTS_SLACK_EMAIL || '')
      .trim()
      .toLowerCase();

    if (slackRecipient) {
      await this.publishEmail(templateId, [slackRecipient], {
        user_name: 'Copilots',
        opportunity_details_url: `${this.getCopilotPortalUrl()}/opportunity/${opportunity.id.toString()}`,
        work_manager_url: this.getWorkManagerUrl(),
        opportunity_type: getCopilotTypeLabel(opportunityType),
        opportunity_title:
          readString(requestData.opportunityTitle) ||
          `Opportunity ${opportunity.id.toString()}`,
        start_date: this.formatDate(requestData.startDate),
      });
    }

    this.logger.log(
      `Sent new copilot opportunity notifications for opportunity=${opportunity.id.toString()} recipients=${recipients.length} slackRecipient=${slackRecipient ? 'yes' : 'no'}`,
    );
  }

  /**
   * Sends application notifications to all Project Manager role users and the
   * opportunity creator.
   * Recipient resolution: identity-role subjects for `Project Manager` plus
   * `opportunity.createdBy`, deduplicated by email.
   *
   * @param opportunity Opportunity that must include copilotRequest relation.
   * @param application Newly created application.
   * @returns Resolves after notifications are queued.
   */
  async sendCopilotApplicationNotification(
    opportunity: OpportunityWithRequest,
    application: CopilotApplication,
  ): Promise<void> {
    const [projectManagerUsers, opportunityCreatorUsers] = await Promise.all([
      this.memberService.getRoleSubjects(UserRole.PROJECT_MANAGER),
      this.memberService.getMemberDetailsByUserIds([opportunity.createdBy]),
    ]);

    const recipients = await this.deduplicateRecipientsByEmail([
      ...projectManagerUsers,
      ...opportunityCreatorUsers,
    ]);

    if (recipients.length === 0) {
      this.logger.warn(
        `No Project Manager recipients resolved for opportunity=${opportunity.id.toString()} application=${application.id.toString()}.`,
      );
      return;
    }

    const requestData = getCopilotRequestData(opportunity.copilotRequest?.data);
    const opportunityType = this.resolveOpportunityType(
      opportunity,
      requestData,
    );

    await Promise.all(
      recipients.map((recipient) =>
        this.publishEmail(TEMPLATE_IDS.APPLY_COPILOT, [recipient.email], {
          user_name: recipient.handle,
          opportunity_details_url: `${this.getCopilotPortalUrl()}/opportunity/${opportunity.id.toString()}#applications`,
          work_manager_url: this.getWorkManagerUrl(),
          opportunity_type: getCopilotTypeLabel(opportunityType),
          opportunity_title:
            readString(requestData.opportunityTitle) ||
            `Opportunity ${opportunity.id.toString()}`,
        }),
      ),
    );

    this.logger.log(
      `Sent copilot application notifications for opportunity=${opportunity.id.toString()} application=${application.id.toString()} recipients=${recipients.length}`,
    );
  }

  /**
   * Sends assigned notification to the accepted applicant.
   * Uses COPILOT_ALREADY_PART_OF_PROJECT when existing membership is copilot/manager,
   * otherwise uses COPILOT_APPLICATION_ACCEPTED.
   *
   * @param opportunity Assigned opportunity with optional request relation.
   * @param application Accepted application with optional existingMembership.
   * @param copilotRequest Optional request override.
   * @returns Resolves after notification dispatch.
   */
  async sendCopilotAssignedNotification(
    opportunity: OpportunityWithRequest,
    application: ApplicationWithMembership,
    copilotRequest?: CopilotRequest | null,
  ): Promise<void> {
    const [member] = await this.memberService.getMemberDetailsByUserIds([
      application.userId,
    ]);

    if (!member?.email) {
      return;
    }

    const requestData = getCopilotRequestData(
      copilotRequest?.data || opportunity.copilotRequest?.data,
    );
    const opportunityType = this.resolveOpportunityType(
      opportunity,
      requestData,
    );

    const membershipRole = String(
      application.existingMembership?.role || '',
    ).toLowerCase();

    const templateId = ['copilot', 'manager'].includes(membershipRole)
      ? TEMPLATE_IDS.COPILOT_ALREADY_PART_OF_PROJECT
      : TEMPLATE_IDS.COPILOT_APPLICATION_ACCEPTED;

    await this.publishEmail(templateId, [String(member.email)], {
      user_name: member.handle,
      opportunity_details_url: `${this.getCopilotPortalUrl()}/opportunity/${opportunity.id.toString()}`,
      work_manager_url: this.getWorkManagerUrl(),
      opportunity_type: getCopilotTypeLabel(opportunityType),
      opportunity_title:
        readString(requestData.opportunityTitle) ||
        `Opportunity ${opportunity.id.toString()}`,
      start_date: this.formatDate(requestData.startDate),
    });

    this.logger.log(
      `Sent copilot assignment notification for opportunity=${opportunity.id.toString()} application=${application.id.toString()}`,
    );
  }

  async sendCopilotInviteAcceptedNotification(
    opportunity: OpportunityWithRequest,
    application: CopilotApplication,
  ): Promise<void> {
    const [projectManagerUsers, opportunityCreatorUsers, inviteeUsers] =
      await Promise.all([
        this.memberService.getRoleSubjects(UserRole.PROJECT_MANAGER),
        this.memberService.getMemberDetailsByUserIds([opportunity.createdBy]),
        this.memberService.getMemberDetailsByUserIds([application.userId]),
      ]);

    const recipients = await this.deduplicateRecipientsByEmail([
      ...projectManagerUsers,
      ...opportunityCreatorUsers,
    ]);

    if (recipients.length === 0) {
      this.logger.warn(
        `No Project Manager recipients resolved for invite-accepted notification opportunity=${opportunity.id.toString()} application=${application.id.toString()}.`,
      );
      return;
    }

    const [invitee] = inviteeUsers;
    const requestData = getCopilotRequestData(opportunity.copilotRequest?.data);
    const opportunityType = this.resolveOpportunityType(
      opportunity,
      requestData,
    );
    const templateId =
      process.env.SENDGRID_TEMPLATE_INFORM_PM_COPILOT_APPLICATION_ACCEPTED ||
      TEMPLATE_IDS.INFORM_PM_COPILOT_APPLICATION_ACCEPTED;

    await Promise.all(
      recipients.map((recipient) =>
        this.publishEmail(templateId, [recipient.email], {
          user_name: recipient.handle || 'Project Manager',
          opportunity_details_url: `${this.getCopilotPortalUrl()}/opportunity/${opportunity.id.toString()}#applications`,
          work_manager_url: this.getWorkManagerUrl(),
          opportunity_type: getCopilotTypeLabel(opportunityType),
          opportunity_title:
            readString(requestData.opportunityTitle) ||
            `Opportunity ${opportunity.id.toString()}`,
          copilot_handle: invitee?.handle || '',
        }),
      ),
    );

    this.logger.log(
      `Sent copilot invite accepted notifications for opportunity=${opportunity.id.toString()} application=${application.id.toString()} recipients=${recipients.length}`,
    );
  }

  /**
   * Sends notifications to non-accepted applicants after assignment.
   * Uses COPILOT_OPPORTUNITY_COMPLETED template for all provided applications.
   *
   * @param opportunity Completed opportunity.
   * @param applications Non-accepted applications.
   * @param copilotRequest Optional request override.
   * @returns Resolves after notification dispatch.
   */
  async sendCopilotRejectedNotification(
    opportunity: OpportunityWithRequest,
    applications: CopilotApplication[],
    copilotRequest?: CopilotRequest | null,
  ): Promise<void> {
    if (applications.length === 0) {
      return;
    }

    const users = await this.memberService.getMemberDetailsByUserIds(
      applications.map((application) => application.userId),
    );

    const requestData = getCopilotRequestData(
      copilotRequest?.data || opportunity.copilotRequest?.data,
    );

    await Promise.all(
      users
        .filter((user) => Boolean(user.email))
        .map((user) =>
          this.publishEmail(
            TEMPLATE_IDS.COPILOT_OPPORTUNITY_COMPLETED,
            [String(user.email)],
            {
              user_name: user.handle,
              opportunity_details_url: this.getCopilotPortalUrl(),
              work_manager_url: this.getWorkManagerUrl(),
              opportunity_title:
                readString(requestData.opportunityTitle) ||
                `Opportunity ${opportunity.id.toString()}`,
            },
          ),
        ),
    );

    this.logger.log(
      `Sent copilot rejection notifications for opportunity=${opportunity.id.toString()} applications=${applications.length}`,
    );
  }

  /**
   * Sends canceled notifications to all applicants for an opportunity.
   *
   * @param opportunity Canceled opportunity.
   * @param applications Opportunity applications.
   * @returns Resolves after notification dispatch.
   */
  async sendOpportunityCanceledNotification(
    opportunity: OpportunityWithRequest,
    applications: CopilotApplication[],
  ): Promise<void> {
    if (applications.length === 0) {
      return;
    }

    const users = await this.memberService.getMemberDetailsByUserIds(
      applications.map((application) => application.userId),
    );

    const requestData = getCopilotRequestData(opportunity.copilotRequest?.data);

    await Promise.all(
      users
        .filter((user) => Boolean(user.email))
        .map((user) =>
          this.publishEmail(
            TEMPLATE_IDS.COPILOT_OPPORTUNITY_CANCELED,
            [String(user.email)],
            {
              user_name: user.handle,
              opportunity_details_url: this.getCopilotPortalUrl(),
              work_manager_url: this.getWorkManagerUrl(),
              opportunity_title:
                readString(requestData.opportunityTitle) ||
                `Opportunity ${opportunity.id.toString()}`,
            },
          ),
        ),
    );

    this.logger.log(
      `Sent copilot opportunity canceled notifications for opportunity=${opportunity.id.toString()} applications=${applications.length}`,
    );
  }

  /**
   * Publishes a template email notification.
   *
   * @param templateId Template identifier.
   * @param recipients Recipient emails.
   * @param data Template payload.
   * @returns Resolved promise when publish succeeds or fails.
   */
  private async publishEmail(
    templateId: string,
    recipients: string[],
    data: Record<string, unknown>,
  ): Promise<void> {
    const normalizedRecipients = recipients
      .map((recipient) =>
        String(recipient || '')
          .trim()
          .toLowerCase(),
      )
      .filter((recipient) => recipient.length > 0);

    if (normalizedRecipients.length === 0) {
      return;
    }

    try {
      await this.eventBusService.publishProjectEvent(
        EXTERNAL_ACTION_EMAIL_TOPIC,
        {
          data,
          sendgrid_template_id: templateId,
          recipients: normalizedRecipients,
          version: 'v3',
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish copilot email event to ${EXTERNAL_ACTION_EMAIL_TOPIC} for recipients=${normalizedRecipients.join(',')}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Deduplicates recipients by normalized email.
   *
   * @param recipients Potential recipients from role and creator lookups.
   * @returns Deduplicated recipients preserving first-seen handle values.
   */
  private async deduplicateRecipientsByEmail(
    recipients: NotificationRecipient[],
  ): Promise<Array<{ email: string; handle: string }>> {
    const recipientByEmail = new Map<
      string,
      { email: string; handle: string }
    >();
    const unresolvedUserIds = new Set<string>();

    recipients.forEach((recipient) => {
      const normalizedEmail = String(recipient.email || '')
        .trim()
        .toLowerCase();

      if (!normalizedEmail) {
        const normalizedUserId = this.normalizeNumericUserId(recipient.userId);
        if (normalizedUserId) {
          unresolvedUserIds.add(normalizedUserId);
        }
        return;
      }

      if (recipientByEmail.has(normalizedEmail)) {
        return;
      }

      recipientByEmail.set(normalizedEmail, {
        email: normalizedEmail,
        handle: String(recipient.handle || '').trim() || normalizedEmail,
      });
    });

    if (unresolvedUserIds.size > 0) {
      const fallbackUsers = await this.memberService.getMemberDetailsByUserIds(
        Array.from(unresolvedUserIds),
      );

      fallbackUsers.forEach((user) => {
        const normalizedEmail = String(user.email || '')
          .trim()
          .toLowerCase();

        if (!normalizedEmail || recipientByEmail.has(normalizedEmail)) {
          return;
        }

        recipientByEmail.set(normalizedEmail, {
          email: normalizedEmail,
          handle: String(user.handle || '').trim() || normalizedEmail,
        });
      });
    }

    return Array.from(recipientByEmail.values());
  }

  /**
   * Normalizes numeric user-id values.
   *
   * @param userId Candidate user id.
   * @returns Numeric user id string or undefined when invalid.
   */
  private normalizeNumericUserId(
    userId: string | number | bigint | null | undefined,
  ): string | undefined {
    const normalizedUserId = String(userId ?? '').trim();

    if (!/^\d+$/.test(normalizedUserId)) {
      return undefined;
    }

    return normalizedUserId;
  }

  /**
   * Returns the configured Work Manager base URL.
   *
   * @returns Work Manager URL string.
   */
  private getWorkManagerUrl(): string {
    // TODO [QUALITY]: No startup validation for WORK_MANAGER_URL; empty values can create broken notification links.
    return process.env.WORK_MANAGER_URL || '';
  }

  /**
   * Returns the configured Copilot portal URL with trailing slash removed.
   *
   * @returns Copilot portal URL string.
   */
  private getCopilotPortalUrl(): string {
    // TODO [QUALITY]: No startup validation for COPILOT_PORTAL_URL/WORK_MANAGER_URL fallback; empty values can create broken notification links.
    const value =
      process.env.COPILOT_PORTAL_URL || process.env.WORK_MANAGER_URL;

    return String(value || '').replace(/\/$/, '');
  }

  /**
   * Resolves opportunity type with fallback chain:
   * requestData.projectType -> opportunity.type.
   *
   * @param opportunity Opportunity entity.
   * @param requestData Parsed request data object.
   * @returns Resolved opportunity type enum.
   */
  private resolveOpportunityType(
    opportunity: CopilotOpportunity,
    requestData: Record<string, unknown>,
  ): CopilotOpportunityType {
    const projectType = (readString(requestData.projectType) || '')
      .toLowerCase()
      .trim();

    if (
      Object.values(CopilotOpportunityType).includes(
        projectType as CopilotOpportunityType,
      )
    ) {
      return projectType as CopilotOpportunityType;
    }

    return opportunity.type;
  }

  /**
   * Formats date-like values into UTC DD-MM-YYYY string.
   * Returns empty string when value is missing or invalid.
   *
   * @param value Date-like value.
   * @returns Formatted date string or empty string.
   */
  private formatDate(value: unknown): string {
    if (!value) {
      return '';
    }

    const normalizedValue = readString(value);

    if (!normalizedValue) {
      return '';
    }

    const date = new Date(normalizedValue);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = String(date.getUTCFullYear());

    return `${day}-${month}-${year}`;
  }
}
