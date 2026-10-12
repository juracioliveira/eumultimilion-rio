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

/** URL de imagem: absoluta (https://…) ou caminho do próprio site (/assets/…). Vazio vira null. */
export const imageUrl = z
  .union([
    z.string().trim().url('Informe uma URL válida (https://…) ou um caminho começando com /'),
    z.string().trim().regex(/^\/[^\s]*$/, 'Informe uma URL válida (https://…) ou um caminho começando com /'),
    z.literal('').transform(() => null),
  ])
  .nullable()
  .optional();

/** URL externa obrigatoriamente absoluta. Vazio vira null. */
export const optionalUrl = z
  .union([z.string().trim().url('Informe uma URL válida, começando com https://'), z.literal('').transform(() => null)])
  .nullable()
  .optional();
