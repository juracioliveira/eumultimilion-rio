import type { FastifyPluginAsync } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { courses, learningPathCourses, learningPaths } from '../../db/schema.js';
import { idParam, imageUrl, parse } from '../../lib/http.js';
import { slugify } from '../../lib/slug.js';

const pathInput = z.object({
  title: z.string().trim().min(2).max(255),
  description: z.string().trim().max(10000).nullable().optional(),
  thumbnailUrl: imageUrl,
  published: z.boolean().optional(),
  courseIds: z.array(z.string().uuid()).optional(),
});

async function setCourses(pathId: string, courseIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(learningPathCourses).where(eq(learningPathCourses.learningPathId, pathId));
    if (courseIds.length) {
      await tx.insert(learningPathCourses).values([...new Set(courseIds)].map((courseId, order) => ({ learningPathId: pathId, courseId, order })));
    }
  });
}

export const adminPathRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const paths = await db.select().from(learningPaths).orderBy(asc(learningPaths.title));
    const links = await db
      .select({ pathId: learningPathCourses.learningPathId, courseId: courses.id, title: courses.title, order: learningPathCourses.order })
      .from(learningPathCourses)
      .innerJoin(courses, eq(learningPathCourses.courseId, courses.id))
      .orderBy(asc(learningPathCourses.order));
    return {
      paths: paths.map((p) => ({ ...p, courses: links.filter((l) => l.pathId === p.id).map(({ courseId, title }) => ({ id: courseId, title })) })),
    };
  });

  fastify.post('/', async (request, reply) => {
    const body = parse(pathInput, request.body, reply);
    if (!body) return;
    const { courseIds, ...values } = body;
    let slug = slugify(body.title) || 'trilha';
    const [clash] = await db.select({ id: learningPaths.id }).from(learningPaths).where(eq(learningPaths.slug, slug)).limit(1);
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;
    const [path] = await db.insert(learningPaths).values({ ...values, slug }).returning();
    if (courseIds) await setCourses(path!.id, courseIds);
    return reply.status(201).send({ path });
  });

  fastify.patch('/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(pathInput.partial(), request.body, reply);
    if (!params || !body) return;
    const { courseIds, ...values } = body;
    const [path] = await db.update(learningPaths).set({ ...values, updatedAt: new Date() }).where(eq(learningPaths.id, params.id)).returning();
    if (!path) return reply.status(404).send({ error: 'Trilha não encontrada' });
    if (courseIds) await setCourses(path.id, courseIds);
    return { path };
  });

  fastify.delete('/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    await db.delete(learningPaths).where(eq(learningPaths.id, params.id));
    return { ok: true };
  });
};
