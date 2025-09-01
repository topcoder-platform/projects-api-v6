/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { EventBusConfig, Auth0Config } from 'config/config';
import * as busApi from 'topcoder-bus-api-wrapper';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  // Bus API Client
  private busApiClient;

  constructor() {
    this.busApiClient = busApi({
      AUTH0_URL: Auth0Config.url,
      AUTH0_AUDIENCE: Auth0Config.audience,
      TOKEN_CACHE_TIME: Auth0Config.tokenCacheTime,
      AUTH0_CLIENT_ID: Auth0Config.clientId,
      AUTH0_CLIENT_SECRET: Auth0Config.clientSecret,
      AUTH0_PROXY_SERVER_URL: Auth0Config.proxyServerUrl,
      BUSAPI_URL: EventBusConfig.url,
      KAFKA_ERROR_TOPIC: EventBusConfig.kafkaErrorTopic,
    });
  }

  async postBusEvent(topic: string, payload: any) {
    await this.busApiClient.postEvent({
      topic,
      originator: 'project-api',
      timestamp: new Date().toISOString(),
      'mime-type': 'application/json',
      payload,
    });

    this.logger.debug(`Success sending event to Kafka with topic ${topic}`);
  }
}
