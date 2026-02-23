/**
 * Kafka event publishing utility with retry and circuit-breaker behavior.
 *
 * Used by domain services to publish lifecycle events to Topcoder Bus API.
 */
import { LoggerService } from 'src/shared/modules/global/logger.service';
import * as busApi from 'tc-bus-api-wrapper';

/**
 * Event envelope shape accepted by `tc-bus-api-wrapper`.
 */
type BusApiEvent = {
  topic: string;
  originator: string;
  timestamp: string;
  'mime-type': string;
  payload: unknown;
};

/**
 * Minimal client contract required from bus API wrapper.
 */
type BusApiClient = {
  postEvent: (event: BusApiEvent) => Promise<unknown>;
};

/**
 * Optional callback invoked after successful publish.
 */
type PublishCallback = (event: BusApiEvent) => void;
type ErrorLogger = {
  error: (message: string, trace?: string) => void;
};

/**
 * Originator value embedded into outbound events.
 */
const EVENT_ORIGINATOR = 'project-service-v6';
/**
 * MIME type used for event payloads.
 */
const EVENT_MIME_TYPE = 'application/json';
/**
 * Maximum retry attempts for client initialization and event publish.
 */
const MAX_RETRY_ATTEMPTS = 3;
/**
 * Initial retry delay used before exponential backoff.
 */
const INITIAL_RETRY_DELAY_MS = 100;
/**
 * Number of consecutive failures needed to open circuit.
 */
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
/**
 * Duration (ms) the circuit remains open before retry attempts resume.
 */
const CIRCUIT_BREAKER_OPEN_MS = 30000;

/**
 * Lazily initialized BUS API client singleton for this process.
 *
 * @todo Module-level mutable state (`busApiClient`, failure counters, circuit
 * timers) is process-local and does not synchronize across worker threads or
 * horizontally scaled instances.
 */
let busApiClient: BusApiClient | null;
/**
 * Consecutive publish failure counter used by circuit-breaker logic.
 */
let consecutiveFailures = 0;
/**
 * Epoch timestamp until which the circuit remains open.
 */
let circuitOpenUntil = 0;
const logger = LoggerService.forRoot('EventUtils');

/**
 * Builds `tc-bus-api-wrapper` configuration from environment variables.
 *
 * @security `AUTH0_CLIENT_SECRET` is injected from environment and must never
 * be logged.
 */
function buildBusApiConfig(): Record<string, unknown> {
  return {
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
  };
}

/**
 * Converts unknown errors into safe log messages.
 */
function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Extracts error stack when available.
 */
function toErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

/**
 * Classifies transient network/socket failures for retry logic.
 */
function isTransientError(error: unknown): boolean {
  const message = toErrorMessage(error);
  const normalizedMessage = message.toLowerCase();
  const codeValue =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  const code = typeof codeValue === 'string' ? codeValue : '';

  const transientCodes = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EPIPE',
    'EAI_AGAIN',
  ]);

  return (
    transientCodes.has(code) ||
    normalizedMessage.includes('timeout') ||
    normalizedMessage.includes('temporar') ||
    normalizedMessage.includes('connect') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('socket')
  );
}

/**
 * Calculates serialized payload size in bytes for logging.
 *
 * Returns `-1` if serialization fails.
 */
function calculatePayloadSize(payload: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(payload), 'utf8');
  } catch {
    return -1;
  }
}

/**
 * Returns `true` when circuit breaker is currently open.
 */
function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

/**
 * Clears circuit-breaker failure state.
 */
function resetCircuitBreaker(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

/**
 * Registers a failed publish attempt and opens circuit if threshold is met.
 */
function registerFailure(): void {
  consecutiveFailures += 1;

  if (consecutiveFailures < CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    return;
  }

  circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_OPEN_MS;
  logger.warn(
    `Event publish circuit opened for ${CIRCUIT_BREAKER_OPEN_MS}ms after ${consecutiveFailures} consecutive failures.`,
  );
}

/**
 * Promise-based sleep helper used for retry backoff.
 */
async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a lazily-initialized BUS API client.
 *
 * Initialization retries transient failures with exponential backoff up to
 * `MAX_RETRY_ATTEMPTS`.
 *
 * @throws Error when all initialization attempts fail.
 */
export async function getBusApiClient(): Promise<BusApiClient> {
  if (busApiClient) {
    return busApiClient;
  }

  const factory = busApi as unknown as (
    config: Record<string, unknown>,
  ) => BusApiClient | undefined;

  let delayMs = INITIAL_RETRY_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const client = factory(buildBusApiConfig());

      if (!client || typeof client.postEvent !== 'function') {
        throw new Error('tc-bus-api-wrapper client initialization failed.');
      }

      busApiClient = client;
      return busApiClient;
    } catch (error) {
      lastError = error;
      const shouldRetry =
        attempt < MAX_RETRY_ATTEMPTS && isTransientError(error);

      logger.error(
        `Failed to initialize BUS API client attempt=${attempt + 1}/${MAX_RETRY_ATTEMPTS + 1}: ${toErrorMessage(error)}`,
        toErrorStack(error),
      );

      if (!shouldRetry) {
        break;
      }

      await sleep(delayMs);
      delayMs *= 2;
    }
  }

  throw new Error(
    `Unable to initialize BUS API client: ${toErrorMessage(lastError)}`,
  );
}

/**
 * Creates an outbound BUS API event envelope.
 */
function createBusApiEvent(topic: string, payload: unknown): BusApiEvent {
  return {
    topic,
    originator: EVENT_ORIGINATOR,
    timestamp: new Date().toISOString(),
    'mime-type': EVENT_MIME_TYPE,
    payload,
  };
}

/**
 * Publishes an event with retry + circuit-breaker protection.
 *
 * Behavior:
 * - Skips publish when circuit is open.
 * - Retries transient failures with exponential backoff.
 * - Executes optional callback on successful publish.
 * - Registers circuit-breaker failure when all retries are exhausted.
 * - Logs failures and returns; this helper does not rethrow.
 */
async function postEventWithRetry(
  event: BusApiEvent,
  operation: string,
  callback?: PublishCallback,
): Promise<void> {
  if (isCircuitOpen()) {
    logger.warn(
      `Skipping event publish because circuit is open operation=${operation} topic=${event.topic}.`,
    );
    return;
  }

  let delayMs = INITIAL_RETRY_DELAY_MS;
  const payloadSize = calculatePayloadSize(event.payload);
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const client = await getBusApiClient();
      await client.postEvent(event);
      resetCircuitBreaker();

      if (callback) {
        callback(event);
      }

      return;
    } catch (error) {
      lastError = error;
      const shouldRetry =
        attempt < MAX_RETRY_ATTEMPTS && isTransientError(error);

      logger.error(
        `Failed to publish ${operation} topic=${event.topic} attempt=${attempt + 1}/${MAX_RETRY_ATTEMPTS + 1} payloadSize=${payloadSize}: ${toErrorMessage(error)}`,
        toErrorStack(error),
      );

      if (!shouldRetry) {
        break;
      }

      await sleep(delayMs);
      delayMs *= 2;
    }
  }

  registerFailure();
  logger.warn(
    `Event publish abandoned operation=${operation} topic=${event.topic} payloadSize=${payloadSize}: ${toErrorMessage(lastError)}`,
  );
}

/**
 * Builds `{ resource: 'project', data }` payload.
 *
 * @todo These `buildXxxEventPayload` functions are structurally identical.
 * Replace with `buildEventPayload(resource, data)` + resource constants map.
 */
function buildProjectEventPayload(project: unknown): unknown {
  return {
    resource: 'project',
    data: project,
  };
}

/**
 * Builds `{ resource: 'project.member', data }` payload.
 */
function buildMemberEventPayload(member: unknown): unknown {
  return {
    resource: 'project.member',
    data: member,
  };
}

/**
 * Builds `{ resource: 'project.member.invite', data }` payload.
 */
function buildInviteEventPayload(invite: unknown): unknown {
  return {
    resource: 'project.member.invite',
    data: invite,
  };
}

/**
 * Builds `{ resource: 'attachment', data }` payload.
 */
function buildAttachmentEventPayload(attachment: unknown): unknown {
  return {
    resource: 'attachment',
    data: attachment,
  };
}

/**
 * Builds `{ resource: 'project.phase', data }` payload.
 */
function buildPhaseEventPayload(phase: unknown): unknown {
  return {
    resource: 'project.phase',
    data: phase,
  };
}

/**
 * Builds `{ resource: 'project.phase.product', data }` payload.
 */
function buildPhaseProductEventPayload(phaseProduct: unknown): unknown {
  return {
    resource: 'project.phase.product',
    data: phaseProduct,
  };
}

/**
 * Builds `{ resource: 'timeline', data }` payload.
 */
function buildTimelineEventPayload(timeline: unknown): unknown {
  return {
    resource: 'timeline',
    data: timeline,
  };
}

/**
 * Builds `{ resource: 'milestone', data }` payload.
 */
function buildMilestoneEventPayload(milestone: unknown): unknown {
  return {
    resource: 'milestone',
    data: milestone,
  };
}

/**
 * Builds `{ resource: 'project.workstream', data }` payload.
 */
function buildWorkstreamEventPayload(workstream: unknown): unknown {
  return {
    resource: 'project.workstream',
    data: workstream,
  };
}

/**
 * Builds `{ resource: 'project.work', data }` payload.
 */
function buildWorkEventPayload(work: unknown): unknown {
  return {
    resource: 'project.work',
    data: work,
  };
}

/**
 * Builds `{ resource: 'project.workitem', data }` payload.
 */
function buildWorkItemEventPayload(workItem: unknown): unknown {
  return {
    resource: 'project.workitem',
    data: workItem,
  };
}

/**
 * Builds `{ resource: 'project.setting', data }` payload.
 */
function buildSettingEventPayload(setting: unknown): unknown {
  return {
    resource: 'project.setting',
    data: setting,
  };
}

/**
 * Publishes a project event envelope.
 *
 * @param topic Kafka topic name.
 * @param project Domain payload wrapped as `resource: 'project'`.
 * @param callback Optional success callback.
 *
 * @todo All `publishXxxEvent` helpers share identical try/catch + retry
 * wrappers. Consolidate into `publishEvent(topic, resource, data, callback?)`.
 */
export async function publishProjectEvent(
  topic: string,
  project: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, buildProjectEventPayload(project)),
      'project-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish project event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Publishes a project-member event envelope.
 */
export async function publishMemberEvent(
  topic: string,
  member: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, buildMemberEventPayload(member)),
      'member-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish member event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Fire-and-forget wrapper for member events with caller-provided logger.
 */
export function publishMemberEventSafely(
  topic: string,
  payload: unknown,
  errorLogger: ErrorLogger,
): void {
  void publishMemberEvent(topic, payload).catch((error) => {
    errorLogger.error(
      `Failed to publish member event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  });
}

/**
 * Publishes a project-member-invite event envelope.
 */
export async function publishInviteEvent(
  topic: string,
  invite: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, buildInviteEventPayload(invite)),
      'invite-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish invite event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Publishes an attachment event envelope.
 */
export async function publishAttachmentEvent(
  topic: string,
  attachment: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, buildAttachmentEventPayload(attachment)),
      'attachment-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish attachment event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Publishes a project-phase event envelope.
 */
export async function publishPhaseEvent(
  topic: string,
  phase: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, buildPhaseEventPayload(phase)),
      'phase-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish phase event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Publishes a phase-product event envelope.
 */
export async function publishPhaseProductEvent(
  topic: string,
  phaseProduct: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, buildPhaseProductEventPayload(phaseProduct)),
      'phase-product-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish phase-product event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Publishes a timeline event envelope.
 */
export async function publishTimelineEvent(
  topic: string,
  timeline: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, buildTimelineEventPayload(timeline)),
      'timeline-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish timeline event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Publishes a milestone event envelope.
 */
export async function publishMilestoneEvent(
  topic: string,
  milestone: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, buildMilestoneEventPayload(milestone)),
      'milestone-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish milestone event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Publishes a workstream event envelope.
 */
export async function publishWorkstreamEvent(
  topic: string,
  workstream: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, buildWorkstreamEventPayload(workstream)),
      'workstream-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish workstream event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Publishes a work event envelope.
 */
export async function publishWorkEvent(
  topic: string,
  work: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, buildWorkEventPayload(work)),
      'work-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish work event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Publishes a work-item event envelope.
 */
export async function publishWorkItemEvent(
  topic: string,
  workItem: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, buildWorkItemEventPayload(workItem)),
      'workitem-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish workitem event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Publishes a project-setting event envelope.
 */
export async function publishSettingEvent(
  topic: string,
  setting: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, buildSettingEventPayload(setting)),
      'setting-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish setting event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Publishes a raw notification payload without resource wrapping.
 */
export async function publishNotificationEvent(
  topic: string,
  payload: unknown,
  callback?: PublishCallback,
): Promise<void> {
  try {
    await postEventWithRetry(
      createBusApiEvent(topic, payload),
      'notification-event',
      callback,
    );
  } catch (error) {
    logger.error(
      `Failed to publish notification event topic=${topic}: ${toErrorMessage(error)}`,
      toErrorStack(error),
    );
  }
}

/**
 * Backward-compatible alias for `publishNotificationEvent`.
 *
 * @deprecated Use `publishNotificationEvent` instead.
 */
export async function publishRawEvent(
  topic: string,
  payload: unknown,
  callback?: PublishCallback,
): Promise<void> {
  await publishNotificationEvent(topic, payload, callback);
}
