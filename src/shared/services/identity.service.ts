import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { SERVICE_ENDPOINTS } from 'src/shared/config/service-endpoints.config';
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
 * `IdentityUser` records (`id`, `handle`, `email`) from Identity API and,
 * when needed, Member API fallback lookups.
 */
@Injectable()
export class IdentityService {
  private readonly logger = LoggerService.forRoot('IdentityService');
  private readonly identityApiUrl = SERVICE_ENDPOINTS.identityApiUrl;
  private readonly memberApiUrl = SERVICE_ENDPOINTS.memberApiUrl;

  constructor(
    private readonly httpService: HttpService,
    private readonly m2mService: M2MService,
  ) {}

  /**
   * Looks up identity users for multiple emails.
   *
   * Resolves users from the Identity API first. For any unresolved emails,
   * falls back to Member API email lookup before returning unique users.
   *
   * @param emails email addresses to resolve
   * @returns matched identity users
   */
  async lookupMultipleUserEmails(
    emails: string[] = [],
  ): Promise<IdentityUser[]> {
    if (emails.length === 0) {
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
      const identityUsers = await this.lookupUsersFromIdentityApi(
        normalizedEmails,
        token,
      );
      const resolvedEmails = new Set(identityUsers.map((user) => user.email));
      const unresolvedEmails = normalizedEmails.filter(
        (email) => !resolvedEmails.has(email),
      );

      const memberUsers =
        unresolvedEmails.length > 0
          ? await this.lookupUsersFromMemberApi(unresolvedEmails, token)
          : [];

      return this.deduplicateUsers(identityUsers.concat(memberUsers));
    } catch (error) {
      this.logger.warn(
        `Failed to lookup emails in identity service: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private async lookupUsersFromIdentityApi(
    emails: string[],
    token: string,
  ): Promise<IdentityUser[]> {
    if (!this.identityApiUrl || emails.length === 0) {
      return [];
    }

    const identityApiBaseUrl = this.identityApiUrl.replace(/\/$/, '');
    const responses = await Promise.all(
      emails.map((email) =>
        // TODO: URL-encode the email value in the filter param to prevent query string injection.
        firstValueFrom(
          this.httpService.get(`${identityApiBaseUrl}/users`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            params: {
              fields: 'handle,id,email',
              filter: `email=${email}`,
            },
            timeout: 15000,
          }),
        ).catch(() => null),
      ),
    );
    // TODO: consider batching or throttling parallel email lookups.

    return responses.flatMap((response) =>
      this.normalizeIdentityUsersFromIdentityResponse(response),
    );
  }

  private async lookupUsersFromMemberApi(
    emails: string[],
    token: string,
  ): Promise<IdentityUser[]> {
    if (!this.memberApiUrl || emails.length === 0) {
      return [];
    }

    const memberApiBaseUrl = this.memberApiUrl.replace(/\/$/, '');
    const responses = await Promise.all(
      emails.map((email) =>
        firstValueFrom(
          this.httpService.get(memberApiBaseUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            params: {
              email,
              fields: 'userId,handle,email',
              page: 1,
              perPage: 1,
            },
            timeout: 15000,
          }),
        ).catch(() => null),
      ),
    );

    return responses.flatMap((response, index) =>
      this.normalizeIdentityUsersFromMemberResponse(response, emails[index]),
    );
  }

  private normalizeIdentityUsersFromIdentityResponse(
    response: unknown,
  ): IdentityUser[] {
    if (
      !response ||
      typeof response !== 'object' ||
      !Array.isArray((response as { data?: unknown }).data)
    ) {
      return [];
    }

    return ((response as { data: unknown[] }).data || [])
      .map((user) => this.normalizeIdentityUser(user))
      .filter((user): user is IdentityUser => !!user);
  }

  private normalizeIdentityUsersFromMemberResponse(
    response: unknown,
    requestedEmail: string,
  ): IdentityUser[] {
    if (
      !response ||
      typeof response !== 'object' ||
      !Array.isArray((response as { data?: unknown }).data)
    ) {
      return [];
    }

    const normalizedRequestedEmail = this.asPrimitiveString(requestedEmail)
      .trim()
      .toLowerCase();

    const matchedEntry = (response as { data: unknown[] }).data.find(
      (entry) => {
        if (!entry || typeof entry !== 'object') {
          return false;
        }

        return (
          this.asPrimitiveString((entry as { email?: unknown }).email)
            .trim()
            .toLowerCase() === normalizedRequestedEmail
        );
      },
    );

    if (!matchedEntry || typeof matchedEntry !== 'object') {
      return [];
    }

    const normalizedUser = this.normalizeIdentityUser({
      id: (matchedEntry as { userId?: unknown }).userId,
      handle: (matchedEntry as { handle?: unknown }).handle,
      email: (matchedEntry as { email?: unknown }).email,
    });

    return normalizedUser ? [normalizedUser] : [];
  }

  private normalizeIdentityUser(value: unknown): IdentityUser | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const id = this.asPrimitiveString((value as { id?: unknown }).id).trim();
    const email = this.asPrimitiveString((value as { email?: unknown }).email)
      .trim()
      .toLowerCase();
    const handleValue = (value as { handle?: unknown }).handle;

    if (!id || !email) {
      return null;
    }

    return {
      id,
      handle:
        typeof handleValue === 'string' && handleValue.trim().length > 0
          ? handleValue
          : undefined,
      email,
    };
  }

  private deduplicateUsers(users: IdentityUser[]): IdentityUser[] {
    const uniqueUsers = new Map<string, IdentityUser>();

    for (const user of users) {
      const key = `${user.id}::${user.email}`;
      uniqueUsers.set(key, user);
    }

    return Array.from(uniqueUsers.values());
  }

  private asPrimitiveString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (
      typeof value === 'number' ||
      typeof value === 'bigint' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    return '';
  }
}
