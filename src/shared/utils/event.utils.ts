import { LoggerService } from 'src/shared/modules/global/logger.service';
import * as busApi from 'tc-bus-api-wrapper';

type BusApiEvent = {
  topic: string;
  originator: string;
  timestamp: string;
  'mime-type': string;
  payload: unknown;
};

type BusApiClient = {
  postEvent: (event: BusApiEvent) => Promise<unknown>;
};

type PublishCallback = (event: BusApiEvent) => void;

const EVENT_ORIGINATOR = 'project-service-v6';
const EVENT_MIME_TYPE = 'application/json';
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 100;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
const CIRCUIT_BREAKER_OPEN_MS = 30000;

let busApiClient: BusApiClient | null;
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const logger = LoggerService.forRoot('EventUtils');

function buildBusApiConfig(): Record<string, unknown> {
  return {
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
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

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

function calculatePayloadSize(payload: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(payload), 'utf8');
  } catch {
    return -1;
  }
}

function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

function resetCircuitBreaker(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

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

function createBusApiEvent(topic: string, payload: unknown): BusApiEvent {
  return {
    topic,
    originator: EVENT_ORIGINATOR,
    timestamp: new Date().toISOString(),
    'mime-type': EVENT_MIME_TYPE,
    payload,
  };
}

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

function buildProjectEventPayload(project: unknown): unknown {
  return {
    resource: 'project',
    data: project,
  };
}

function buildMemberEventPayload(member: unknown): unknown {
  return {
    resource: 'project.member',
    data: member,
  };
}

function buildInviteEventPayload(invite: unknown): unknown {
  return {
    resource: 'project.member.invite',
    data: invite,
  };
}

function buildAttachmentEventPayload(attachment: unknown): unknown {
  return {
    resource: 'attachment',
    data: attachment,
  };
}

function buildPhaseEventPayload(phase: unknown): unknown {
  return {
    resource: 'project.phase',
    data: phase,
  };
}

function buildPhaseProductEventPayload(phaseProduct: unknown): unknown {
  return {
    resource: 'project.phase.product',
    data: phaseProduct,
  };
}

function buildTimelineEventPayload(timeline: unknown): unknown {
  return {
    resource: 'timeline',
    data: timeline,
  };
}

function buildMilestoneEventPayload(milestone: unknown): unknown {
  return {
    resource: 'milestone',
    data: milestone,
  };
}

function buildWorkstreamEventPayload(workstream: unknown): unknown {
  return {
    resource: 'project.workstream',
    data: workstream,
  };
}

function buildWorkEventPayload(work: unknown): unknown {
  return {
    resource: 'project.work',
    data: work,
  };
}

function buildWorkItemEventPayload(workItem: unknown): unknown {
  return {
    resource: 'project.workitem',
    data: workItem,
  };
}

function buildSettingEventPayload(setting: unknown): unknown {
  return {
    resource: 'project.setting',
    data: setting,
  };
}

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

export async function publishRawEvent(
  topic: string,
  payload: unknown,
  callback?: PublishCallback,
): Promise<void> {
  await publishNotificationEvent(topic, payload, callback);
}
