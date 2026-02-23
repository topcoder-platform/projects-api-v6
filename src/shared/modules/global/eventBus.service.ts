import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LoggerService } from './logger.service';

import * as busApi from 'tc-bus-api-wrapper';

/**
 * Event bus integration for publishing project events.
 *
 * Wraps the tc bus API client and degrades gracefully when required runtime
 * configuration is unavailable.
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

const EVENT_BUS_REQUIRED_ENV_KEYS = [
  'BUSAPI_URL',
  'KAFKA_URL',
  'KAFKA_ERROR_TOPIC',
  'AUTH0_URL',
  'AUTH0_AUDIENCE',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',
] as const;

type EventBusRequiredEnvKey = (typeof EVENT_BUS_REQUIRED_ENV_KEYS)[number];
type EventBusConfigStatus = Record<EventBusRequiredEnvKey, 'set' | 'empty'>;

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
        `Event bus client unavailable for topic ${topic}. initReason=${this.clientInitReason}. configStatus=${this.serializeConfigStatus(this.buildConfigStatus())}`,
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
    } catch (error) {
      this.logger.error(
        `Failed to publish event to topic ${topic}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Failed to publish event to event bus.',
      );
    }
  }

  /**
   * Creates a bus API client from environment configuration.
   *
   * Returns null when configuration is insufficient or client initialization
   * fails, so callers can degrade gracefully.
   *
   * @returns {EventBusClient | null} Initialized client or null when unavailable.
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

    const missingAuthEnv = this.getMissingAuthEnv(configStatus);
    if (missingAuthEnv.length > 0) {
      this.clientInitReason = `missing-auth-env:${missingAuthEnv.join(',')}`;
      this.logger.warn(
        `Missing ${missingAuthEnv.join(', ')}. Event publishing disabled. configStatus=${this.serializeConfigStatus(configStatus)}`,
      );
      return null;
    }

    const missingRequiredEnv = this.getMissingRequiredEnv(configStatus);
    if (missingRequiredEnv.length > 0) {
      this.logger.warn(
        `Event bus config has empty required values: ${missingRequiredEnv.join(', ')}. Initialization may fail. configStatus=${this.serializeConfigStatus(configStatus)}`,
      );
    }

    try {
      // TODO (quality): TOKEN_CACHE_TIME is hardcoded to 900 seconds. Expose as an environment variable (e.g., AUTH0_TOKEN_CACHE_TIME) for operational flexibility.
      // TODO (security): KAFKA_CLIENT_CERT and KAFKA_CLIENT_CERT_KEY are passed directly from environment variables without validation. Ensure these are properly formatted PEM strings before passing to the client.
      const client = busApiFactory({
        BUSAPI_URL: process.env.BUSAPI_URL,
        KAFKA_URL: process.env.KAFKA_URL,
        KAFKA_ERROR_TOPIC: process.env.KAFKA_ERROR_TOPIC,
        KAFKA_CLIENT_CERT: process.env.KAFKA_CLIENT_CERT,
        KAFKA_CLIENT_CERT_KEY: process.env.KAFKA_CLIENT_CERT_KEY,
        AUTH0_URL: process.env.AUTH0_URL,
        AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
        AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
        AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL,
        TOKEN_CACHE_TIME: 900,
      });
      this.clientInitReason = 'initialized';
      return client;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.clientInitReason = `client-init-failed:${errorMessage}`;
      this.logger.warn(
        `Failed to initialize event bus client: ${errorMessage}. configStatus=${this.serializeConfigStatus(configStatus)}`,
      );
      return null;
    }
  }

  private buildConfigStatus(): EventBusConfigStatus {
    return {
      BUSAPI_URL: this.toConfigStatus(process.env.BUSAPI_URL),
      KAFKA_URL: this.toConfigStatus(process.env.KAFKA_URL),
      KAFKA_ERROR_TOPIC: this.toConfigStatus(process.env.KAFKA_ERROR_TOPIC),
      AUTH0_URL: this.toConfigStatus(process.env.AUTH0_URL),
      AUTH0_AUDIENCE: this.toConfigStatus(process.env.AUTH0_AUDIENCE),
      AUTH0_CLIENT_ID: this.toConfigStatus(process.env.AUTH0_CLIENT_ID),
      AUTH0_CLIENT_SECRET: this.toConfigStatus(process.env.AUTH0_CLIENT_SECRET),
    };
  }

  private toConfigStatus(value: string | undefined): 'set' | 'empty' {
    return typeof value === 'string' && value.trim().length > 0
      ? 'set'
      : 'empty';
  }

  private getMissingAuthEnv(status: EventBusConfigStatus): string[] {
    const authKeys: Array<EventBusRequiredEnvKey> = [
      'AUTH0_URL',
      'AUTH0_AUDIENCE',
    ];

    return authKeys.filter((key) => status[key] === 'empty');
  }

  private getMissingRequiredEnv(status: EventBusConfigStatus): string[] {
    return EVENT_BUS_REQUIRED_ENV_KEYS.filter((key) => status[key] === 'empty');
  }

  private serializeConfigStatus(status: EventBusConfigStatus): string {
    return JSON.stringify(status);
  }
}
