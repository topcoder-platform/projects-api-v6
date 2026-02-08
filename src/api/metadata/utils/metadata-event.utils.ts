import {
  PROJECT_METADATA_RESOURCE,
  ProjectMetadataResource,
} from 'src/shared/constants/event.constants';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';

export type MetadataEventAction =
  | 'PROJECT_METADATA_CREATE'
  | 'PROJECT_METADATA_UPDATE'
  | 'PROJECT_METADATA_DELETE';

export function publishMetadataEvent(
  eventBus: EventBusService,
  action: MetadataEventAction,
  resource: ProjectMetadataResource,
  id: string | bigint | number,
  data: unknown,
  userId: bigint | number,
): Promise<void> {
  // Metadata Kafka topics were retired. Keep this helper as a no-op to avoid
  // changing call sites while preventing publication to removed topics.
  void eventBus;
  void action;
  void resource;
  void id;
  void data;
  void userId;
  return Promise.resolve();
}

export { PROJECT_METADATA_RESOURCE };
