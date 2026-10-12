import type { FastifyPluginAsync } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { categories } from '../../db/schema.js';
import { idParam, parse } from '../../lib/http.js';
import { slugify } from '../../lib/slug.js';

export const adminCategoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ categories: await db.select().from(categories).orderBy(asc(categories.name)) }));

  fastify.post('/', async (request, reply) => {
    const body = parse(z.object({ name: z.string().trim().min(2).max(120) }), request.body, reply);
    if (!body) return;
    const [category] = await db
      .insert(categories)
      .values({ name: body.name, slug: slugify(body.name) })
      .onConflictDoNothing()
      .returning();
    if (!category) return reply.status(409).send({ error: 'Categoria já existe' });
    return { category };
  });

  fastify.delete('/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    await db.delete(categories).where(eq(categories.id, params.id));
    return { ok: true };
  });
};
