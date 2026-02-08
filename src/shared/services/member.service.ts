import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { M2MService } from 'src/shared/modules/global/m2m.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { MemberDetail } from 'src/shared/utils/member.utils';

export interface MemberRoleRecord {
  roleName: string;
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
}
