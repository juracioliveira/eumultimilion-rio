import type { FastifyPluginAsync } from 'fastify';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { courseCompletions, courses, learningPathCourses, learningPaths, certificates } from '../db/schema.js';
import { currentUser } from '../plugins/authenticate.js';
import { hasCourseAccess } from '../services/access.js';

export const pathRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const paths = await db
      .select({
        id: learningPaths.id,
        title: learningPaths.title,
        slug: learningPaths.slug,
        description: learningPaths.description,
        thumbnailUrl: learningPaths.thumbnailUrl,
        courseCount: sql<number>`(select count(*)::int from ${learningPathCourses} where ${learningPathCourses.learningPathId} = ${learningPaths.id})`,
      })
      .from(learningPaths)
      .where(eq(learningPaths.published, true))
      .orderBy(asc(learningPaths.title));
    return { paths };
  });

  fastify.get('/:slug', { preValidation: [fastify.optionalAuth] }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const user = currentUser(request);
    const [path] = await db.select().from(learningPaths).where(eq(learningPaths.slug, slug)).limit(1);
    if (!path || (!path.published && user?.role !== 'admin')) return reply.status(404).send({ error: 'Trilha não encontrada' });

    const pathCourses = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        thumbnailUrl: courses.thumbnailUrl,
        description: courses.description,
        priceCents: courses.priceCents,
        order: learningPathCourses.order,
      })
      .from(learningPathCourses)
      .innerJoin(courses, eq(learningPathCourses.courseId, courses.id))
      .where(and(eq(learningPathCourses.learningPathId, path.id), eq(courses.published, true)))
      .orderBy(asc(learningPathCourses.order));

    const progress: Record<string, { purchased: boolean; completed: boolean }> = {};
    let certificateCode: string | null = null;
    if (user && pathCourses.length) {
      const completions = await db
        .select({ courseId: courseCompletions.courseId })
        .from(courseCompletions)
        .where(and(eq(courseCompletions.userId, user.id), inArray(courseCompletions.courseId, pathCourses.map((c) => c.id))));
      const completed = new Set(completions.map((c) => c.courseId));
      for (const c of pathCourses) {
        progress[c.id] = { purchased: await hasCourseAccess(user, c.id), completed: completed.has(c.id) };
      }
      const [cert] = await db
        .select({ code: certificates.verificationCode })
        .from(certificates)
        .where(and(eq(certificates.userId, user.id), eq(certificates.learningPathId, path.id)))
        .limit(1);
      certificateCode = cert?.code ?? null;
    }
    return { path, courses: pathCourses, progress, certificateCode };
  });
};
