import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { SERVICE_ENDPOINTS } from 'src/shared/config/service-endpoints.config';
import { M2MService } from 'src/shared/modules/global/m2m.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { MemberDetail } from 'src/shared/utils/member.utils';

export interface MemberRoleRecord {
  id?: string | number;
  roleName: string;
}

type RoleSubjectRecord = {
  subjectID?: string | number;
  userId?: string | number;
  handle?: string;
  email?: string;
};

type RoleDetailResponse = {
  subjects?: RoleSubjectRecord[];
};

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
  private readonly memberApiUrl = SERVICE_ENDPOINTS.memberApiUrl;
  // TODO: validate required env vars at startup (e.g., in onModuleInit).
  private readonly identityApiUrl = SERVICE_ENDPOINTS.identityApiUrl;

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

  /**
   * Looks up role members from Identity API by role name.
   *
   * Resolves `/roles?filter=roleName=<roleName>` and then
   * `/roles/:id?fields=subjects`, returning the merged `subjects` list
   * normalized to `MemberDetail` shape.
   *
   * Role-detail lookups are tolerant to partial failures; one failing role id
   * does not prevent subjects from other matching roles from being returned.
   *
   * @param roleName identity role name (for example `Project Manager`)
   * @returns role subject list with optional `userId`, `handle`, and `email`
   */
  async getRoleSubjects(roleName: string): Promise<MemberDetail[]> {
    if (!this.identityApiUrl) {
      this.logger.warn('IDENTITY_API_URL is not configured.');
      return [];
    }

    const normalizedRoleName = String(roleName || '').trim();
    if (!normalizedRoleName) {
      return [];
    }

    try {
      const token = await this.m2mService.getM2MToken();
      const identityApiBaseUrl = this.identityApiUrl.replace(/\/$/, '');

      const rolesResponse = await firstValueFrom(
        this.httpService.get(`${identityApiBaseUrl}/roles`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          params: {
            filter: `roleName=${normalizedRoleName}`,
          },
        }),
      );

      const roles = Array.isArray(rolesResponse.data)
        ? (rolesResponse.data as MemberRoleRecord[])
        : [];

      const roleIds = roles
        .filter(
          (role) =>
            String(role.roleName || '').toLowerCase() ===
            normalizedRoleName.toLowerCase(),
        )
        .map((role) => String(role.id || '').trim())
        .filter((roleId) => roleId.length > 0);

      if (roleIds.length === 0) {
        return [];
      }

      const settledRoleDetails = await Promise.allSettled(
        roleIds.map(async (roleId) => {
          const roleResponse = await firstValueFrom(
            this.httpService.get(`${identityApiBaseUrl}/roles/${roleId}`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              params: {
                fields: 'subjects',
              },
            }),
          );

          const payload = roleResponse.data as RoleDetailResponse;
          return Array.isArray(payload?.subjects) ? payload.subjects : [];
        }),
      );

      const subjectLists = settledRoleDetails
        .filter(
          (result): result is PromiseFulfilledResult<RoleSubjectRecord[]> =>
            result.status === 'fulfilled',
        )
        .map((result) => result.value);

      settledRoleDetails.forEach((result, index) => {
        if (result.status === 'rejected') {
          const roleId = roleIds[index];
          this.logger.warn(
            `Failed to fetch subjects for roleId=${roleId}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
          );
        }
      });

      const uniqueSubjects = new Map<string, MemberDetail>();

      subjectLists.flat().forEach((subject) => {
        const email = String(subject.email || '')
          .trim()
          .toLowerCase();
        const subjectId = String(
          subject.subjectID || subject.userId || '',
        ).trim();

        const key = email || subjectId;
        if (!key || uniqueSubjects.has(key)) {
          return;
        }

        uniqueSubjects.set(key, {
          userId: subject.subjectID || subject.userId || null,
          handle: subject.handle || null,
          email,
        });
      });

      return Array.from(uniqueSubjects.values());
    } catch (error) {
      this.logger.warn(
        `Failed to fetch role subjects for roleName=${normalizedRoleName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async getRoleSubjectsByRoleName(roleName: string): Promise<MemberDetail[]> {
    return this.getRoleSubjects(roleName);
  }
}
