import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { M2MService } from 'src/shared/modules/global/m2m.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { MemberDetail } from 'src/shared/utils/member.utils';

export interface MemberRoleRecord {
  roleName: string;
}

/**
 * Member and identity enrichment service.
 *
 * Fetches profile details from the Topcoder Member API and user roles from the
 * Identity API using M2M tokens.
 *
 * Used by project invite/member flows to enrich responses with `handle`,
 * `email`, `firstName`, `lastName`, and to validate Topcoder roles while
 * managing project membership.
 */
@Injectable()
export class MemberService {
  private readonly logger = LoggerService.forRoot('MemberService');
  // TODO: validate required env vars at startup (e.g., in onModuleInit).
  private readonly memberApiUrl = process.env.MEMBER_API_URL || '';
  // TODO: DRY violation - consider a shared config constant or ConfigService.
  // TODO: validate required env vars at startup (e.g., in onModuleInit).
  private readonly identityApiUrl = process.env.IDENTITY_API_URL || '';

  constructor(
    private readonly httpService: HttpService,
    private readonly m2mService: M2MService,
  ) {}

  /**
   * Looks up member details by handles through the Member API.
   *
   * Returns an empty array when the API is not configured, input is empty, or
   * network/API errors occur.
   *
   * @param handles handles to resolve
   * @returns member detail records matched by handle
   */
  async getMemberDetailsByHandles(
    handles: string[] = [],
  ): Promise<MemberDetail[]> {
    if (!this.memberApiUrl || handles.length === 0) {
      return [];
    }

    const normalizedHandles = handles
      .map((handle) =>
        String(handle || '')
          .trim()
          .toLowerCase(),
      )
      .filter((handle) => handle.length > 0);

    if (normalizedHandles.length === 0) {
      return [];
    }

    try {
      const token = await this.m2mService.getM2MToken();
      const quotedHandles = normalizedHandles.map((handle) => `"${handle}"`);

      // TODO: verify Member API treats this as a safe list parameter, not a raw query string.
      const response = await firstValueFrom(
        this.httpService.get(`${this.memberApiUrl}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          params: {
            handles: `[${quotedHandles.join(',')}]`,
            fields: 'userId,handle,firstName,lastName,email,handleLower',
          },
        }),
      );

      const payload = Array.isArray(response.data) ? response.data : [];

      return payload.filter((user) =>
        normalizedHandles.includes(
          String(user.handleLower || user.handle || '').toLowerCase(),
        ),
      ) as MemberDetail[];
    } catch (error) {
      this.logger.warn(
        `Failed to fetch member details by handles: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Looks up member details by numeric user ids through the Member API.
   *
   * Returns an empty array when the API is not configured, input is empty, or
   * network/API errors occur.
   *
   * @param userIds member user ids to resolve
   * @returns member detail records returned by the Member API
   */
  async getMemberDetailsByUserIds(
    userIds: Array<string | number | bigint>,
  ): Promise<MemberDetail[]> {
    // TODO: extract shared HTTP fetch logic into a private fetchFromMemberApi(params) helper.
    if (!this.memberApiUrl || userIds.length === 0) {
      return [];
    }

    const normalizedUserIds = userIds
      .map((userId) => String(userId || '').trim())
      .filter((userId) => /^\d+$/.test(userId));

    if (normalizedUserIds.length === 0) {
      return [];
    }

    try {
      const token = await this.m2mService.getM2MToken();

      const response = await firstValueFrom(
        this.httpService.get(`${this.memberApiUrl}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          params: {
            userIds: `[${normalizedUserIds.join(',')}]`,
            fields: 'userId,handle,firstName,lastName,email',
          },
        }),
      );

      return Array.isArray(response.data)
        ? (response.data as MemberDetail[])
        : [];
    } catch (error) {
      this.logger.warn(
        `Failed to fetch member details by user ids: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Looks up Identity API role names for a user id.
   *
   * Queries `IDENTITY_API_URL/roles` with `filter=subjectID=<userId>`.
   *
   * @param userId Topcoder user id
   * @returns role name list or empty array on errors/misconfiguration
   */
  async getUserRoles(userId: string | number | bigint): Promise<string[]> {
    // TODO: consider moving getUserRoles into IdentityService to consolidate identity API calls.
    if (!this.identityApiUrl) {
      this.logger.warn('IDENTITY_API_URL is not configured.');
      return [];
    }

    const normalizedUserId = String(userId || '').trim();
    if (!/^\d+$/.test(normalizedUserId)) {
      return [];
    }

    try {
      const token = await this.m2mService.getM2MToken();

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.identityApiUrl.replace(/\/$/, '')}/roles`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            params: {
              filter: `subjectID=${normalizedUserId}`,
            },
          },
        ),
      );

      const roles = Array.isArray(response.data) ? response.data : [];

      return roles
        .map((role) => String((role as MemberRoleRecord).roleName || '').trim())
        .filter((roleName) => roleName.length > 0);
    } catch (error) {
      this.logger.warn(
        `Failed to fetch roles for userId=${normalizedUserId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}
