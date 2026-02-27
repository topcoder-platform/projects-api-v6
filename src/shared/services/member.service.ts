import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { M2MService } from 'src/shared/modules/global/m2m.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { MemberDetail } from 'src/shared/utils/member.utils';

export interface MemberRoleRecord {
  id?: string | number;
  roleName: string;
}

export interface RoleSubjectRecord {
  email?: string;
  handle?: string;
  subjectID?: string | number;
  userId?: string | number;
}

interface RoleSubjectsResponseRecord {
  subjects?: RoleSubjectRecord[];
}

@Injectable()
export class MemberService {
  private readonly logger = LoggerService.forRoot('MemberService');
  private readonly memberApiUrl = process.env.MEMBER_API_URL || '';
  private readonly identityApiUrl = process.env.IDENTITY_API_URL || '';

  constructor(
    private readonly httpService: HttpService,
    private readonly m2mService: M2MService,
  ) {}

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

  async getMemberDetailsByUserIds(
    userIds: Array<string | number | bigint>,
  ): Promise<MemberDetail[]> {
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

  async getUserRoles(userId: string | number | bigint): Promise<string[]> {
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

  async getRoleSubjectsByRoleName(
    roleName: string,
  ): Promise<RoleSubjectRecord[]> {
    if (!this.identityApiUrl) {
      this.logger.warn('IDENTITY_API_URL is not configured.');
      return [];
    }

    const normalizedRoleName = String(roleName || '').trim();
    if (!normalizedRoleName) {
      return [];
    }

    const identityUrl = this.identityApiUrl.replace(/\/$/, '');

    try {
      const token = await this.m2mService.getM2MToken();

      const rolesResponse = await firstValueFrom(
        this.httpService.get(`${identityUrl}/roles`, {
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
          (role) => String(role.roleName || '').trim() === normalizedRoleName,
        )
        .map((role) => String(role.id || '').trim())
        .filter((roleId) => roleId.length > 0);

      if (roleIds.length === 0) {
        return [];
      }

      const subjectLists = await Promise.all(
        roleIds.map(async (roleId) => {
          const roleResponse = await firstValueFrom(
            this.httpService.get(`${identityUrl}/roles/${roleId}`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              params: {
                fields: 'subjects',
              },
            }),
          );

          const payload = roleResponse.data as RoleSubjectsResponseRecord;
          return Array.isArray(payload?.subjects) ? payload.subjects : [];
        }),
      );

      const uniqueSubjects = new Map<string, RoleSubjectRecord>();

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

        uniqueSubjects.set(key, subject);
      });

      return Array.from(uniqueSubjects.values());
    } catch (error) {
      this.logger.warn(
        `Failed to fetch role subjects for role=${normalizedRoleName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}
