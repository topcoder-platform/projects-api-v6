import { Injectable, Logger } from "@nestjs/common";
import { M2MService } from "./m2m.service";
import { EventBusConfig } from "config/config";

const postEventPath = '/bus/events'

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly m2m: M2MService
  ) {}

  async postBusEvent(topic: string, payload: any) {
    const token = await this.m2m.getM2mToken();
    const url = EventBusConfig.url + postEventPath;
    const reqBody = {
      topic,
      originator: 'project-api',
      timestamp: new Date().toISOString(),
      'mime-type': 'application/json',
      payload
    }
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(reqBody)
      });
    } catch (err) {
      this.logger.error('Error occurs while sending data to bus event: ', err)
    }
  }
}


