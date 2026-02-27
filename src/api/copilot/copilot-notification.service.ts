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
import {
  MemberService,
  RoleSubjectRecord,
} from 'src/shared/services/member.service';
import { getCopilotRequestData, getCopilotTypeLabel } from './copilot.utils';

const EXTERNAL_ACTION_EMAIL_TOPIC = 'external.action.email';

const TEMPLATE_IDS = {
  APPLY_COPILOT: 'd-d7c1f48628654798a05c8e09e52db14f',
  CREATE_REQUEST: 'd-3efdc91da580479d810c7acd50a4c17f',
  INFORM_PM_COPILOT_APPLICATION_ACCEPTED: 'd-b35d073e302b4279a1bd208fcfe96f58',
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

type EmailRecipient = {
  email?: string | null;
  handle?: string | null;
};

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
    const roleSubjects = await this.memberService.getRoleSubjectsByRoleName(
      UserRole.TC_COPILOT,
    );

    const recipients = this.mergeRecipients(roleSubjects);
    const requestData = getCopilotRequestData(copilotRequest?.data);
    const opportunityType = this.resolveOpportunityType(
      opportunity,
      requestData,
    );

    if (recipients.length > 0) {
      await Promise.all(
        recipients.map((recipient) =>
          this.publishEmail(
            process.env.SENDGRID_TEMPLATE_COPILOT_REQUEST_CREATED ||
              TEMPLATE_IDS.CREATE_REQUEST,
            [recipient.email],
            {
              user_name: recipient.handle || 'Copilot',
              opportunity_details_url: `${this.getCopilotPortalUrl()}/opportunity/${opportunity.id.toString()}`,
              work_manager_url: this.getWorkManagerUrl(),
              opportunity_type: getCopilotTypeLabel(opportunityType),
              opportunity_title:
                this.readString(requestData.opportunityTitle) ||
                `Opportunity ${opportunity.id.toString()}`,
              start_date: this.formatDate(requestData.startDate),
            },
          ),
        ),
      );
    }

    const slackRecipient = String(process.env.COPILOTS_SLACK_EMAIL || '')
      .trim()
      .toLowerCase();

    if (slackRecipient) {
      await this.publishEmail(
        process.env.SENDGRID_TEMPLATE_COPILOT_REQUEST_CREATED ||
          TEMPLATE_IDS.CREATE_REQUEST,
        [slackRecipient],
        {
          user_name: 'Copilots',
          opportunity_details_url: `${this.getCopilotPortalUrl()}/opportunity/${opportunity.id.toString()}`,
          work_manager_url: this.getWorkManagerUrl(),
          opportunity_type: getCopilotTypeLabel(opportunityType),
          opportunity_title:
            this.readString(requestData.opportunityTitle) ||
            `Opportunity ${opportunity.id.toString()}`,
          start_date: this.formatDate(requestData.startDate),
        },
      );
    }

    this.logger.log(
      `Sent new copilot opportunity notifications for opportunity=${opportunity.id.toString()}`,
    );
  }

  async sendCopilotApplicationNotification(
    opportunity: OpportunityWithRequest,
    application: CopilotApplication,
  ): Promise<void> {
    const pmRoleRecipients = await this.memberService.getRoleSubjectsByRoleName(
      UserRole.PROJECT_MANAGER,
    );
    const creatorRecipients =
      await this.memberService.getMemberDetailsByUserIds([
        opportunity.createdBy,
      ]);
    const normalizedRecipients = this.mergeRecipients(
      pmRoleRecipients,
      creatorRecipients,
    );

    if (normalizedRecipients.length === 0) {
      return;
    }

    const requestData = getCopilotRequestData(opportunity.copilotRequest?.data);
    const opportunityType = this.resolveOpportunityType(
      opportunity,
      requestData,
    );

    await Promise.all(
      normalizedRecipients.map((recipient) =>
        this.publishEmail(TEMPLATE_IDS.APPLY_COPILOT, [recipient.email], {
          user_name: recipient.handle || 'Project Manager',
          opportunity_details_url: `${this.getCopilotPortalUrl()}/opportunity/${opportunity.id.toString()}#applications`,
          work_manager_url: this.getWorkManagerUrl(),
          opportunity_type: getCopilotTypeLabel(opportunityType),
          opportunity_title:
            this.readString(requestData.opportunityTitle) ||
            `Opportunity ${opportunity.id.toString()}`,
        }),
      ),
    );

    this.logger.log(
      `Sent copilot application notifications for opportunity=${opportunity.id.toString()} application=${application.id.toString()}`,
    );
  }

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

    const templateId = application.existingMembership
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

  async sendCopilotInviteAcceptedNotification(
    opportunity: OpportunityWithRequest,
    application: CopilotApplication,
  ): Promise<void> {
    const pmRoleRecipients = await this.memberService.getRoleSubjectsByRoleName(
      UserRole.PROJECT_MANAGER,
    );
    const creatorRecipients =
      await this.memberService.getMemberDetailsByUserIds([
        opportunity.createdBy,
      ]);
    const normalizedRecipients = this.mergeRecipients(
      pmRoleRecipients,
      creatorRecipients,
    );

    if (normalizedRecipients.length === 0) {
      return;
    }

    const [invitee] = await this.memberService.getMemberDetailsByUserIds([
      application.userId,
    ]);
    const requestData = getCopilotRequestData(opportunity.copilotRequest?.data);
    const opportunityType = this.resolveOpportunityType(
      opportunity,
      requestData,
    );
    const templateId =
      process.env.SENDGRID_TEMPLATE_INFORM_PM_COPILOT_APPLICATION_ACCEPTED ||
      TEMPLATE_IDS.INFORM_PM_COPILOT_APPLICATION_ACCEPTED;

    await Promise.all(
      normalizedRecipients.map((recipient) =>
        this.publishEmail(templateId, [recipient.email], {
          user_name: recipient.handle || 'Project Manager',
          opportunity_details_url: `${this.getCopilotPortalUrl()}/opportunity/${opportunity.id.toString()}#applications`,
          work_manager_url: this.getWorkManagerUrl(),
          opportunity_type: getCopilotTypeLabel(opportunityType),
          opportunity_title:
            this.readString(requestData.opportunityTitle) ||
            `Opportunity ${opportunity.id.toString()}`,
          copilot_handle: invitee?.handle || '',
        }),
      ),
    );

    this.logger.log(
      `Sent copilot invite accepted notifications for opportunity=${opportunity.id.toString()} application=${application.id.toString()}`,
    );
  }

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
        `Failed to publish copilot email event for recipients=${normalizedRecipients.join(',')}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private getWorkManagerUrl(): string {
    return process.env.WORK_MANAGER_URL || '';
  }

  private getCopilotPortalUrl(): string {
    const value =
      process.env.COPILOT_PORTAL_URL || process.env.WORK_MANAGER_URL;

    return String(value || '').replace(/\/$/, '');
  }

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

  private readString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return `${value}`;
    }

    return undefined;
  }

  private mergeRecipients(
    ...sources: Array<Array<EmailRecipient | RoleSubjectRecord>>
  ): Array<{ email: string; handle?: string }> {
    const recipients = new Map<string, { email: string; handle?: string }>();

    sources.flat().forEach((recipient) => {
      const email = String(recipient.email || '')
        .trim()
        .toLowerCase();
      if (!email) {
        return;
      }

      const handle = String(recipient.handle || '').trim();
      const existing = recipients.get(email);

      if (!existing) {
        recipients.set(email, { email, ...(handle ? { handle } : {}) });
        return;
      }

      if (!existing.handle && handle) {
        recipients.set(email, { ...existing, handle });
      }
    });

    return Array.from(recipients.values());
  }
}
