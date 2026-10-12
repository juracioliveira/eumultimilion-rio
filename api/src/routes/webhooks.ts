import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { webhookEvents } from '../db/schema.js';
import { env } from '../env.js';
import { enqueueWebhook } from '../queue/producer.js';

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Grava o evento primeiro (idempotência por provider + id externo) e só então processa. */
async function record(reply: FastifyReply, provider: string, externalEventId: string, eventType: string, payload: unknown) {
  const inserted = await db
    .insert(webhookEvents)
    .values({ provider, externalEventId, eventType, payload: payload as object })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (!inserted.length) return reply.send({ received: true, duplicate: true });
  await enqueueWebhook({ provider, externalEventId, payload });
  return reply.send({ received: true });
}

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/cakto', async (request, reply) => {
    const body = (request.body ?? {}) as any;
    // A Cakto envia o segredo configurado no webhook dentro do corpo ("secret").
    if (!env.cakto.webhookSecret || !safeEqual(String(body.secret ?? ''), env.cakto.webhookSecret)) {
      return reply.status(401).send({ error: 'Assinatura inválida' });
    }
    const event = String(body.event ?? 'unknown');
    const id = String(body.data?.id ?? body.data?.refId ?? '');
    if (!id) return reply.status(400).send({ error: 'Evento sem id' });
    return record(reply, 'cakto', `${event}:${id}`, event, body);
  });

  fastify.post('/bunny', async (request, reply) => {
    // Bunny não assina o webhook; usamos um segredo na querystring (?secret=...).
    const { secret } = (request.query ?? {}) as { secret?: string };
    if (!env.bunny.webhookSecret || !safeEqual(String(secret ?? ''), env.bunny.webhookSecret)) {
      return reply.status(401).send({ error: 'Assinatura inválida' });
    }
    const body = (request.body ?? {}) as any;
    const videoId = String(body.VideoGuid ?? '');
    if (!videoId) return reply.status(400).send({ error: 'Evento sem VideoGuid' });
    return record(reply, 'bunny', `${videoId}:${body.Status}`, `video.status.${body.Status}`, body);
  });
};
