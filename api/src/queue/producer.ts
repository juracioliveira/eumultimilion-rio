import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';
import { processWebhook } from '../services/webhooks.js';

export const QUEUE_NAME = 'multimilionario-queue';

const webhookQueue = redisConnection ? new Queue(QUEUE_NAME, { connection: redisConnection }) : null;

/**
 * Com REDIS_URL configurado o evento vai para a fila (processado pelo worker);
 * sem Redis (desenvolvimento) é processado na hora.
 */
export async function enqueueWebhook(job: { provider: string; externalEventId: string; payload: unknown }) {
  if (webhookQueue) {
    await webhookQueue.add('webhook', job, { attempts: 5, backoff: { type: 'exponential', delay: 5000 } });
  } else {
    await processWebhook(job);
  }
}
