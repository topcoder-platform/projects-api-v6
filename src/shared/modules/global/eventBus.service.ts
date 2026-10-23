import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LoggerService } from './logger.service';

import * as busApi from 'tc-bus-api-wrapper';
import { auth } from 'tc-core-library-js';

/**
 * Event bus integration for publishing project events.
 *
 * Wraps the tc bus API client and degrades gracefully when required runtime
 * configuration is unavailable. Tokens come from the M2M provider selected by
 * `USE_KEYCLOAK`, the same rule `event.utils.ts` uses: `true` uses
 * `KEYCLOAK_TOKEN_URL`, `KEYCLOAK_AUDIENCE`, `KEYCLOAK_CLIENT_ID` and
 * `KEYCLOAK_CLIENT_SECRET`; unset or `false` uses `AUTH0_URL`, `AUTH0_AUDIENCE`,
 * `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` and `AUTH0_PROXY_SERVER_URL`. Either set is
 * passed to the wrapper under its `AUTH0_*` option names.
 */
/**
 * Event bus client contract used by this service.
 */
type EventBusClient = {
  /**
   * Publishes an event envelope to the bus.
   *
   * @param event Event envelope.
   * @param event.topic Kafka topic name.
   * @param event.originator Service identifier that emits the event.
   * @param event.timestamp ISO-8601 event timestamp.
   * @param event['mime-type'] MIME type of the payload body.
   * @param event.payload Serializable event payload.
   * @returns {Promise<unknown>} Result returned by the bus client.
   */
  postEvent: (event: {
    topic: string;
    originator: string;
    timestamp: string;
    'mime-type': string;
    payload: unknown;
  }) => Promise<unknown>;
};

/** Required settings shared by both M2M providers. */
const EVENT_BUS_COMMON_ENV_KEYS = ['BUSAPI_URL', 'KAFKA_ERROR_TOPIC'] as const;

/** Keycloak settings required when `USE_KEYCLOAK=true`: token URL, audience, client ID, secret. */
const EVENT_BUS_KEYCLOAK_ENV_KEYS = [
  'KEYCLOAK_TOKEN_URL',
  'KEYCLOAK_AUDIENCE',
  'KEYCLOAK_CLIENT_ID',
  'KEYCLOAK_CLIENT_SECRET',
] as const;

/** Auth0 settings required when `USE_KEYCLOAK` is unset or `false`: URL, audience, client ID, secret. */
const EVENT_BUS_AUTH0_ENV_KEYS = [
  'AUTH0_URL',
  'AUTH0_AUDIENCE',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',
] as const;

type EventBusRequiredEnvKey =
  | (typeof EVENT_BUS_COMMON_ENV_KEYS)[number]
  | (typeof EVENT_BUS_KEYCLOAK_ENV_KEYS)[number]
  | (typeof EVENT_BUS_AUTH0_ENV_KEYS)[number];
type EventBusConfigStatus = Partial<
  Record<EventBusRequiredEnvKey, 'set' | 'empty'>
>;

/**
 * Lists the settings the event bus needs for the active M2M provider.
 *
 * Takes no parameters. Returns the common keys followed by the Keycloak keys when
 * `USE_KEYCLOAK=true`, or the Auth0 keys otherwise. Used by `EventBusService` to
 * build its sanitized configuration status.
 *
 * @returns {readonly EventBusRequiredEnvKey[]} Required environment variable names.
 * @throws {TypeError} When `USE_KEYCLOAK` is not `true`/`false`.
 */
function eventBusRequiredEnvKeys(): readonly EventBusRequiredEnvKey[] {
  return [
    ...EVENT_BUS_COMMON_ENV_KEYS,
    ...(auth.useKeycloak()
      ? EVENT_BUS_KEYCLOAK_ENV_KEYS
      : EVENT_BUS_AUTH0_ENV_KEYS),
  ];
}

@Injectable()
/**
 * Service responsible for publishing events to Kafka through tc-bus-api-wrapper.
 */
export class EventBusService {
  private readonly logger = LoggerService.forRoot('EventBusService');
  private readonly client: EventBusClient | null;
  private clientInitReason = 'uninitialized';

  /**
   * Creates the event-bus client if the runtime supports it.
   */
  constructor() {
    this.client = this.createClient();
  }

  /**
   * Publishes a project event to the configured event bus topic.
   *
   * @param {string} topic Kafka topic string.
   * @param {unknown} payload Serializable event payload.
   * @returns {Promise<void>}
   * @throws {ServiceUnavailableException} When event bus client is not configured.
   * @throws {InternalServerErrorException} When event publishing fails.
   */
  async publishProjectEvent(topic: string, payload: unknown): Promise<void> {
    // TODO (security): The 'topic' parameter is not validated. A caller passing an untrusted or user-supplied topic string could publish to unintended Kafka topics. Validate against an allowlist of known topics.
    if (!this.client) {
      this.logger.error(
        `Event bus client unavailable. initReason=${this.clientInitReason}. configStatus=${this.serializeConfigStatus(this.buildConfigStatus())}`,
      );
      throw new ServiceUnavailableException(
        'Event bus client is not configured.',
      );
    }

    try {
      await this.client.postEvent({
        topic,
        originator: 'project-service-v6',
        timestamp: new Date().toISOString(),
        'mime-type': 'application/json',
        payload,
      });
    } catch {
      this.logger.error('Event bus publish failed.');
      throw new InternalServerErrorException(
        'Failed to publish event to event bus.',
      );
    }
  }

  /**
   * Creates a bus API client from environment configuration.
   *
   * `auth.wrapperSettings` fills the wrapper's option names (`AUTH0_URL`,
   * `AUTH0_AUDIENCE`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`,
   * `AUTH0_PROXY_SERVER_URL`) from the Keycloak settings when `USE_KEYCLOAK=true`
   * (the Keycloak core then reads its issuer, audience and token URL from the
   * environment and uses the explicit client credentials), or keeps the Auth0
   * settings of the same names otherwise.
   * Returns null when configuration is insufficient or client initialization
   * fails, so callers can degrade gracefully.
   *
   * @security `KEYCLOAK_CLIENT_SECRET` and `AUTH0_CLIENT_SECRET` must never be
   * logged; only set/empty status is reported.
   *
   * @returns {EventBusClient | null} Initialized client or null when unavailable.
   * @throws {TypeError} When `USE_KEYCLOAK` is not `true`/`false`.
   */
  private createClient(): EventBusClient | null {
    const busApiFactory = busApi as unknown as (
      config: Record<string, unknown>,
    ) => EventBusClient;
    const configStatus = this.buildConfigStatus();

    if (typeof busApiFactory !== 'function') {
      this.clientInitReason = 'bus-api-wrapper-unavailable';
      this.logger.warn(
        `tc-bus-api-wrapper is not available. Event publishing disabled. configStatus=${this.serializeConfigStatus(configStatus)}`,
      );
      return null;
    }

    if (this.hasMissingAuthConfig(configStatus)) {
      this.clientInitReason = 'missing-auth-env';
      this.logger.warn(
        `Event bus authentication configuration is incomplete. Event publishing disabled. configStatus=${this.serializeConfigStatus(configStatus)}`,
      );
      return null;
    }

    if (this.hasMissingRequiredConfig(configStatus)) {
      this.logger.warn(
        `Event bus configuration has empty required values. Initialization may fail. configStatus=${this.serializeConfigStatus(configStatus)}`,
      );
    }

    try {
      // TOKEN_CACHE_TIME satisfies the wrapper's schema; the core caches by token expiry.
      const client = busApiFactory({
        BUSAPI_URL: process.env.BUSAPI_URL,
        KAFKA_ERROR_TOPIC: process.env.KAFKA_ERROR_TOPIC,
        ...auth.wrapperSettings({
          AUTH0_URL: process.env.AUTH0_URL,
          AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
          AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
          AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
          AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL,
        }),
        TOKEN_CACHE_TIME: 900,
      });
      this.clientInitReason = 'initialized';
      return client;
    } catch {
      this.clientInitReason = 'client-init-failed';
      this.logger.warn(
        `Failed to initialize event bus client. configStatus=${this.serializeConfigStatus(configStatus)}`,
      );
      return null;
    }
  }

  /**
   * Builds the sanitized set/empty status of the settings the active provider needs.
   *
   * Takes no parameters. With `USE_KEYCLOAK=true` the map holds `BUSAPI_URL`,
   * `KAFKA_ERROR_TOPIC` and the `KEYCLOAK_*` settings; otherwise it holds the same
   * common keys and the `AUTH0_*` settings. Values are never included.
   *
   * @returns {EventBusConfigStatus} Required setting names mapped to `set`/`empty`.
   * @throws {TypeError} When `USE_KEYCLOAK` is not `true`/`false`.
   */
  private buildConfigStatus(): EventBusConfigStatus {
    const status: EventBusConfigStatus = {};
    for (const key of eventBusRequiredEnvKeys()) {
      status[key] = this.toConfigStatus(process.env[key]);
    }
    return status;
  }

  private toConfigStatus(value: string | undefined): 'set' | 'empty' {
    return typeof value === 'string' && value.trim().length > 0
      ? 'set'
      : 'empty';
  }

  /**
   * Determines whether required authentication settings are absent.
   *
   * The result is used for diagnostics without logging environment-derived
   * values or dynamically selected configuration keys.
   *
   * @param {EventBusConfigStatus} status Sanitized set/empty configuration map.
   * @returns {boolean} True when the active provider's token URL or audience
   * (`KEYCLOAK_TOKEN_URL`/`KEYCLOAK_AUDIENCE`, or `AUTH0_URL`/`AUTH0_AUDIENCE`) is missing.
   */
  private hasMissingAuthConfig(status: EventBusConfigStatus): boolean {
    return (
      status.KEYCLOAK_TOKEN_URL === 'empty' ||
      status.KEYCLOAK_AUDIENCE === 'empty' ||
      status.AUTH0_URL === 'empty' ||
      status.AUTH0_AUDIENCE === 'empty'
    );
  }

  /**
   * Determines whether any required event-bus setting is absent.
   *
   * @param {EventBusConfigStatus} status Sanitized set/empty configuration map.
   * @returns {boolean} True when at least one required setting is missing.
   */
  private hasMissingRequiredConfig(status: EventBusConfigStatus): boolean {
    return Object.values(status).some((value) => value === 'empty');
  }

  private serializeConfigStatus(status: EventBusConfigStatus): string {
    return JSON.stringify(status);
  }
}
