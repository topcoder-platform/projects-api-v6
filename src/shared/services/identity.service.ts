import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { M2MService } from 'src/shared/modules/global/m2m.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';

export interface IdentityUser {
  id: string;
  handle?: string;
  email: string;
}

@Injectable()
export class IdentityService {
  private readonly logger = LoggerService.forRoot('IdentityService');
  private readonly identityApiUrl = process.env.IDENTITY_API_URL || '';

  constructor(
    private readonly httpService: HttpService,
    private readonly m2mService: M2MService,
  ) {}

  async lookupMultipleUserEmails(
    emails: string[] = [],
  ): Promise<IdentityUser[]> {
    if (!this.identityApiUrl || emails.length === 0) {
      return [];
    }

    const normalizedEmails = emails
      .map((email) =>
        String(email || '')
          .trim()
          .toLowerCase(),
      )
      .filter((email) => email.length > 0);

    if (normalizedEmails.length === 0) {
      return [];
    }

    try {
      const token = await this.m2mService.getM2MToken();

      const responses = await Promise.all(
        normalizedEmails.map((email) =>
          firstValueFrom(
            this.httpService.get(
              `${this.identityApiUrl.replace(/\/$/, '')}/users`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                params: {
                  fields: 'handle,id,email',
                  filter: `email=${email}`,
                },
                timeout: 15000,
              },
            ),
          ).catch(() => null),
        ),
      );

      const users = responses.flatMap((response) => {
        if (!response || !Array.isArray(response.data)) {
          return [];
        }

        return response.data as IdentityUser[];
      });

      const uniqueUsers = new Map<string, IdentityUser>();
      for (const user of users) {
        const key = `${String(user.id || '').trim()}::${String(user.email || '')
          .trim()
          .toLowerCase()}`;
        if (!key.trim()) {
          continue;
        }

        uniqueUsers.set(key, {
          id: String(user.id),
          handle: user.handle,
          email: String(user.email || '').toLowerCase(),
        });
      }

      return Array.from(uniqueUsers.values());
    } catch (error) {
      this.logger.warn(
        `Failed to lookup emails in identity service: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}
