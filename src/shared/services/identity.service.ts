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

/**
 * Identity lookup service for resolving users by email.
 *
 * Used by project invite flows to map invite email addresses into
 * `IdentityUser` records (`id`, `handle`, `email`) from the Identity API.
 */
@Injectable()
export class IdentityService {
  private readonly logger = LoggerService.forRoot('IdentityService');
  // TODO: DRY violation - consider a shared config constant or ConfigService.
  private readonly identityApiUrl = process.env.IDENTITY_API_URL || '';

  constructor(
    private readonly httpService: HttpService,
    private readonly m2mService: M2MService,
  ) {}

  /**
   * Looks up identity users for multiple emails.
   *
   * Executes one request per email in parallel via `Promise.all`, swallows
   * per-email request failures with `.catch(() => null)`, and de-duplicates
   * successful responses by `id::email`.
   *
   * Returns an empty array when `IDENTITY_API_URL` is not configured.
   *
   * @param emails email addresses to resolve
   * @returns matched identity users
   */
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
          // TODO: URL-encode the email value in the filter param to prevent query string injection.
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
      // TODO: consider batching or throttling parallel email lookups.

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
        // TODO: strengthen deduplication guard - skip entries where id is empty.
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
