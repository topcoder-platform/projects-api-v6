import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getChallengesPrismaClient } from 'src/shared/global/external-prisma.client';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { BillingAccountService } from 'src/shared/services/billingAccount.service';
import {
  SALESFORCE_OPPORTUNITY_ID_PATTERN,
  SMU_VALUES,
  normalizeSmuValue,
} from 'src/shared/utils/showcase-metadata.utils';
import { SalesforceOpportunityResponseDto } from './dto/salesforce-opportunity-response.dto';
import { SalesforceClient } from './salesforce.client';

/**
 * Salesforce opportunity record shape returned by the SOQL projection below.
 */
interface OpportunityRecord {
  Id?: unknown;
  Name?: unknown;
  Description?: unknown;
  CloseDate?: unknown;
  StageName?: unknown;
  Reporting_SMU__c?: unknown;
  Subcontracting_End_Customer__r?: { Name?: unknown } | null;
}

/**
 * Fields read from `Opportunity` for the Work and Sales integrations.
 *
 * Only the attributes listed in PM-6363 are projected, so no additional
 * Salesforce data reaches the API surface.
 */
const OPPORTUNITY_FIELDS = [
  'Id',
  'Name',
  'Description',
  'CloseDate',
  'StageName',
  'Reporting_SMU__c',
  'Subcontracting_End_Customer__r.Name',
].join(',');

/**
 * Read-only Salesforce opportunity lookups.
 *
 * Backs the Work app's project-detail auto-population and the Sales app's
 * opportunity popup, including the matching project and its billing history.
 * Nothing is written back to Salesforce or the project/billing databases.
 */
@Injectable()
export class SalesforceOpportunityService {
  private readonly logger = LoggerService.forRoot(
    'SalesforceOpportunityService',
  );

  /**
   * @param client Shared read-only Salesforce REST client.
   * @param prisma Project database used to resolve the account's current project.
   * @param billingAccounts Billing Accounts API lookup and account metadata resolver.
   */
  constructor(
    private readonly client: SalesforceClient,
    private readonly prisma: PrismaService,
    private readonly billingAccounts: BillingAccountService,
  ) {}

  /**
   * Resolves an opportunity's current account and the project's lifetime accounts.
   * For multiple matches, uses the most recently updated non-deleted project;
   * without a project, uses the highest account ID from the filtered listing.
   * Challenge status and account active status do not restrict history.
   *
   * @param opportunityId Salesforce record ID returned by the opportunity query.
   * @returns Account, project ID, and unique challenge account summaries. Missing
   * historical metadata preserves an ID-only entry. No account yields nulls/[].
   * @throws BadGatewayException when billing, project, or challenge lookup fails;
   * failures are not presented as an empty history or a missing association.
   */
  private async getBillingContext(
    opportunityId: string,
  ): Promise<
    Pick<
      SalesforceOpportunityResponseDto,
      'billingAccount' | 'projectId' | 'relatedBillingAccounts'
    >
  > {
    const accounts =
      await this.billingAccounts.getBillingAccountsForOpportunity(
        opportunityId,
      );
    if (!accounts.length) {
      return {
        billingAccount: null,
        projectId: null,
        relatedBillingAccounts: [],
      };
    }
    try {
      const project = await this.prisma.project.findFirst({
        where: {
          billingAccountId: {
            in: accounts.map((account) => BigInt(account.id)),
          },
          deletedAt: null,
        },
        select: { id: true, billingAccountId: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });
      const billingAccount =
        accounts.find(
          (account) => account.id === project?.billingAccountId?.toString(),
        ) || accounts[0];
      if (!project) {
        return { billingAccount, projectId: null, relatedBillingAccounts: [] };
      }
      // Challenge.projectId is Int while Project.id is BigInt.
      const projectId = Number(project.id);
      const challenges =
        projectId > 0 && projectId <= 2147483647
          ? await getChallengesPrismaClient().challenge.findMany({
              where: { projectId },
              select: { billingRecord: { select: { billingAccountId: true } } },
            })
          : [];
      const relatedIds = new Set<string>();
      for (const challenge of challenges) {
        const rawId = challenge.billingRecord?.billingAccountId?.trim();
        if (!rawId || !/^\d+$/.test(rawId)) continue;
        const id = BigInt(rawId).toString();
        if (id !== '0') relatedIds.add(id);
      }
      const ids = [...relatedIds].sort((a, b) =>
        BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0,
      );
      const metadata = await this.billingAccounts.getBillingAccountsByIds(
        ids.filter((id) => id !== billingAccount.id),
      );
      return {
        billingAccount,
        projectId: project.id.toString(),
        relatedBillingAccounts: ids.map((id) =>
          id === billingAccount.id
            ? billingAccount
            : { id, name: metadata[id]?.name },
        ),
      };
    } catch {
      this.logger.warn(
        'Unable to load project billing history for opportunity.',
      );
      throw new BadGatewayException(
        'Unable to load opportunity project billing history.',
      );
    }
  }

  /**
   * Reads a string field, trimming it and discarding empty values.
   *
   * @param value raw Salesforce field value
   * @returns the trimmed string, or `undefined` when absent or blank
   */
  private readString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed || undefined;
  }

  /**
   * Maps a Salesforce Reporting SMU onto the SMU options accepted by
   * `Project.details`.
   *
   * Unrecognized codes (for example `INTERNAL`) are surfaced as `Others` with
   * the raw value in `smuOther`, so nothing is silently dropped.
   *
   * @param reportingSmu raw `Reporting_SMU__c` value
   * @returns the mapped option pair, or an empty object when unset
   */
  private mapSmu(reportingSmu: string | undefined): {
    smu?: string;
    smuOther?: string;
  } {
    if (!reportingSmu) {
      return {};
    }

    const normalized = normalizeSmuValue(reportingSmu);
    if (SMU_VALUES.includes(normalized) && normalized !== 'Others') {
      return { smu: normalized };
    }

    return { smu: 'Others', smuOther: reportingSmu.slice(0, 255) };
  }

  /**
   * Retrieves a single opportunity and its project billing context by record id.
   *
   * @param opportunityId 15 or 18 character Salesforce opportunity id
   * @returns the opportunity attributes, current account, project ID and unique
   * challenge billing accounts used by Work and Sales
   * @throws BadRequestException for a malformed id; NotFoundException when no
   * opportunity is visible to the integration user; ServiceUnavailableException
   * or BadGatewayException for configuration and upstream failures
   */
  async getOpportunity(
    opportunityId: string,
  ): Promise<SalesforceOpportunityResponseDto> {
    const id = (opportunityId || '').trim();
    if (!SALESFORCE_OPPORTUNITY_ID_PATTERN.test(id)) {
      throw new BadRequestException(
        'Enter a valid 15 or 18 character Salesforce opportunity id.',
      );
    }

    // SECURITY: `id` is constrained to [A-Za-z0-9] by the pattern above, so it
    // cannot terminate the quoted SOQL literal.
    const records = await this.client.query<OpportunityRecord>(
      `SELECT ${OPPORTUNITY_FIELDS} FROM Opportunity WHERE Id = '${id}' LIMIT 1`,
    );

    const record = records[0];
    if (!record) {
      throw new NotFoundException(
        'No Salesforce opportunity was found for that ID.',
      );
    }

    const resolvedId = this.readString(record.Id) || id;
    const reportingSmu = this.readString(record.Reporting_SMU__c);
    const billingContext = await this.getBillingContext(resolvedId);

    return {
      id: resolvedId,
      name: this.readString(record.Name) || '',
      description: this.readString(record.Description),
      customer: this.readString(record.Subcontracting_End_Customer__r?.Name),
      ...this.mapSmu(reportingSmu),
      reportingSmu,
      closeDate: this.readString(record.CloseDate),
      stageName: this.readString(record.StageName),
      url: `${this.client.instanceOrigin()}/${resolvedId}`,
      ...billingContext,
    };
  }
}
