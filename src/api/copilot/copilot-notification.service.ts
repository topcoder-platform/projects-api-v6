import { Injectable } from '@nestjs/common';
import {
  CopilotApplication,
  CopilotOpportunity,
  CopilotOpportunityType,
  CopilotRequest,
  ProjectMemberRole,
} from '@prisma/client';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { MemberService } from 'src/shared/services/member.service';
import { getCopilotRequestData, getCopilotTypeLabel } from './copilot.utils';

// TODO [CONFIG]: TEMPLATE_IDS are hardcoded SendGrid template ids; move these values to environment-based configuration.
const TEMPLATE_IDS = {
  APPLY_COPILOT: 'd-d7c1f48628654798a05c8e09e52db14f',
  COPILOT_APPLICATION_ACCEPTED: 'd-eef5e7568c644940b250e76d026ced5b',
  COPILOT_ALREADY_PART_OF_PROJECT: 'd-003d41cdc9de4bbc9e14538e8f2e0585',
  COPILOT_OPPORTUNITY_COMPLETED: 'd-dc448919d11b4e7d8b4ba351c4b67b8b',
  COPILOT_OPPORTUNITY_CANCELED: 'd-2a67ba71e82f4d70891fe6989c3522a3',
} as const;

type OpportunityWithRequest = CopilotOpportunity & {
  copilotRequest?: CopilotRequest | null;
};

type ApplicationWithMembership = CopilotApplication & {
  existingMembership?: {
    role?: string;
  };
};

/**
 * Email notification dispatcher for copilot lifecycle events.
 * Email dispatch is currently disabled: publishEmail is a stub that logs and returns
 * without sending to Kafka/SendGrid.
 */
@Injectable()
export class CopilotNotificationService {
  private readonly logger = LoggerService.forRoot('CopilotNotificationService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly memberService: MemberService,
  ) {}

  /**
   * Sends application notifications to project managers and request creator.
   * Recipient resolution: manager/project_manager project members + request creator, deduplicated.
   *
   * @param opportunity Opportunity that must include copilotRequest relation.
   * @param application Newly created application.
   * @returns Resolves after notifications are queued.
   */
  async sendCopilotApplicationNotification(
    opportunity: OpportunityWithRequest,
    application: CopilotApplication,
  ): Promise<void> {
    if (!opportunity.projectId) {
      return;
    }

    const projectMembers = await this.prisma.projectMember.findMany({
      where: {
        projectId: opportunity.projectId,
        role: {
          in: [ProjectMemberRole.manager, ProjectMemberRole.project_manager],
        },
        deletedAt: null,
      },
      select: {
        userId: true,
      },
    });

    const requestCreatorId =
      typeof opportunity.copilotRequest?.createdBy === 'number'
        ? BigInt(opportunity.copilotRequest.createdBy)
        : null;

    const recipientIds = Array.from(
      new Set(
        [
          ...projectMembers.map((member) => member.userId),
          ...(requestCreatorId ? [requestCreatorId] : []),
        ].map((id) => id.toString()),
      ),
    );

    if (recipientIds.length === 0) {
      return;
    }

    const recipients =
      await this.memberService.getMemberDetailsByUserIds(recipientIds);

    const requestData = getCopilotRequestData(opportunity.copilotRequest?.data);
    const opportunityType = this.resolveOpportunityType(
      opportunity,
      requestData,
    );

    await Promise.all(
      recipients
        .filter((recipient) => Boolean(recipient.email))
        .map((recipient) =>
          this.publishEmail(
            TEMPLATE_IDS.APPLY_COPILOT,
            [String(recipient.email)],
            {
              user_name: recipient.handle,
              opportunity_details_url: `${this.getCopilotPortalUrl()}/opportunity/${opportunity.id.toString()}#applications`,
              work_manager_url: this.getWorkManagerUrl(),
              opportunity_type: getCopilotTypeLabel(opportunityType),
              opportunity_title:
                this.readString(requestData.opportunityTitle) ||
                `Opportunity ${opportunity.id.toString()}`,
            },
          ),
        ),
    );

    this.logger.log(
      `Sent copilot application notifications for opportunity=${opportunity.id.toString()} application=${application.id.toString()}`,
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
        this.readString(requestData.opportunityTitle) ||
        `Opportunity ${opportunity.id.toString()}`,
      start_date: this.formatDate(requestData.startDate),
    });

    this.logger.log(
      `Sent copilot assignment notification for opportunity=${opportunity.id.toString()} application=${application.id.toString()}`,
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
                this.readString(requestData.opportunityTitle) ||
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
                this.readString(requestData.opportunityTitle) ||
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
   * @returns Resolved promise (dispatch currently disabled).
   */
  private publishEmail(
    templateId: string,
    recipients: string[],
    data: Record<string, unknown>,
  ): Promise<void> {
    if (recipients.length === 0) {
      return Promise.resolve();
    }

    // TODO [SECURITY/FUNCTIONALITY]: Email dispatch is fully disabled; templateId and data are discarded and nothing is sent. Re-enable Kafka/SendGrid before production use.
    void templateId;
    void data;
    this.logger.warn(
      `Copilot email Kafka publication is disabled. Skipped ${recipients.length} recipient(s).`,
    );
    return Promise.resolve();
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
    const projectType = (this.readString(requestData.projectType) || '')
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

    const normalizedValue = this.readString(value);

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

  /**
   * Reads a string-like primitive value.
   *
   * @param value Input value.
   * @returns String value or undefined.
   */
  private readString(value: unknown): string | undefined {
    // TODO [DRY]: Identical readString exists in CopilotRequestService; extract to copilot.utils.ts.
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return `${value}`;
    }

    return undefined;
  }
}
