import { Worker, type Job } from 'bullmq';
import { redisConnection } from './connection.js';
import { QUEUE_NAME } from './producer.js';
import { processWebhook } from '../services/webhooks.js';

if (!redisConnection) {
  console.error('REDIS_URL não configurado — o worker não tem fila para consumir.');
  process.exit(1);
}

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    if (job.name === 'webhook') await processWebhook(job.data);
  },
  { connection: redisConnection },
);

worker.on('completed', (job) => console.log(`Job ${job.id} concluído`));
worker.on('failed', (job, err) => console.error(`Job ${job?.id} falhou: ${err.message}`));
console.log('Worker iniciado.');
