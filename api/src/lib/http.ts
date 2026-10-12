import type { FastifyReply } from 'fastify';
import { z } from 'zod';

/** Valida com zod; em caso de erro responde 400 e retorna null. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown, reply: FastifyReply): z.infer<T> | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    reply.status(400).send({ error: 'Dados inválidos', issues: result.error.flatten() });
    return null;
  }
  return result.data;
}

export const idParam = z.object({ id: z.string().uuid() });
