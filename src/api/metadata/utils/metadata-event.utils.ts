import {
  PROJECT_METADATA_EVENT_TOPIC,
  PROJECT_METADATA_RESOURCE,
  ProjectMetadataResource,
} from 'src/shared/constants/event.constants';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';

export type MetadataEventAction =
  | 'PROJECT_METADATA_CREATE'
  | 'PROJECT_METADATA_UPDATE'
  | 'PROJECT_METADATA_DELETE';

export async function publishMetadataEvent(
  eventBus: EventBusService,
  action: MetadataEventAction,
  resource: ProjectMetadataResource,
  id: string | bigint | number,
  data: unknown,
  userId: bigint | number,
): Promise<void> {
  const topic = PROJECT_METADATA_EVENT_TOPIC[action];

  await eventBus.publishProjectEvent(topic, {
    resource,
    id: typeof id === 'bigint' ? id.toString() : String(id),
    data,
    userId: typeof userId === 'bigint' ? userId.toString() : userId,
    timestamp: new Date(),
  });
}

export { PROJECT_METADATA_RESOURCE };
