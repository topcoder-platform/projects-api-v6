/**
 * Metadata event publishing utility.
 *
 * `publishMetadataEvent` is intentionally a no-op because metadata Kafka topics
 * were retired. The function signature remains in place to avoid changing every
 * metadata call site that used to publish events.
 */
import {
  PROJECT_METADATA_RESOURCE,
  ProjectMetadataResource,
} from 'src/shared/constants/event.constants';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';

export type MetadataEventAction =
  | 'PROJECT_METADATA_CREATE'
  | 'PROJECT_METADATA_UPDATE'
  | 'PROJECT_METADATA_DELETE';

/**
 * Publishes a metadata event (currently no-op).
 *
 * @param eventBus Event bus dependency retained for compatibility.
 * @param action Event action name.
 * @param resource Metadata resource identifier.
 * @param id Resource identifier.
 * @param data Event payload.
 * @param userId Acting user id.
 * @returns Always resolves immediately.
 */
export function publishMetadataEvent(
  eventBus: EventBusService,
  action: MetadataEventAction,
  resource: ProjectMetadataResource,
  id: string | bigint | number,
  data: unknown,
  userId: bigint | number,
): Promise<void> {
  // TODO (DEAD CODE): This function is a no-op. If metadata events are never re-enabled, consider removing all call sites and this utility to reduce noise. If re-enabling, replace the no-op body with actual EventBusService.publish() calls.
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
