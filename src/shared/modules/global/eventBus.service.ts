import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LoggerService } from './logger.service';

import * as busApi from 'tc-bus-api-wrapper';

type EventBusClient = {
  postEvent: (event: {
    topic: string;
    originator: string;
    timestamp: string;
    'mime-type': string;
    payload: unknown;
  }) => Promise<unknown>;
};

@Injectable()
export class EventBusService {
  private readonly logger = LoggerService.forRoot('EventBusService');
  private readonly client: EventBusClient | null;

  constructor() {
    this.client = this.createClient();
  }

  async publishProjectEvent(topic: string, payload: unknown): Promise<void> {
    if (!this.client) {
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

  private createClient(): EventBusClient | null {
    const busApiFactory = busApi as unknown as (
      config: Record<string, unknown>,
    ) => EventBusClient;

    if (typeof busApiFactory !== 'function') {
      this.logger.warn(
        'tc-bus-api-wrapper is not available. Event publishing disabled.',
      );
      return null;
    }

    if (!process.env.AUTH0_URL || !process.env.AUTH0_AUDIENCE) {
      this.logger.warn(
        'Missing AUTH0_URL or AUTH0_AUDIENCE. Event publishing disabled.',
      );
      return null;
    }

    try {
      return busApiFactory({
        BUSAPI_URL: process.env.BUSAPI_URL,
        KAFKA_URL: process.env.KAFKA_URL,
        KAFKA_CLIENT_CERT: process.env.KAFKA_CLIENT_CERT,
        KAFKA_CLIENT_CERT_KEY: process.env.KAFKA_CLIENT_CERT_KEY,
        AUTH0_URL: process.env.AUTH0_URL,
        AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
        AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
        AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL,
        TOKEN_CACHE_TIME: 900,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to initialize event bus client: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
