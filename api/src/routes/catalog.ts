import type { FastifyPluginAsync } from 'fastify';
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { categories, courses, lessons, modules, quizzes } from '../db/schema.js';
import { currentUser } from '../plugins/authenticate.js';
import { hasCourseAccess } from '../services/access.js';
import { completedLessonIds } from '../services/progress.js';
import { parse } from '../lib/http.js';

/** Contagem de aulas e duração total por curso. */
export async function courseStats(courseIds: string[]) {
  if (courseIds.length === 0) return new Map<string, { lessonCount: number; durationSeconds: number }>();
  const rows = await db
    .select({
      courseId: modules.courseId,
      lessonCount: sql<number>`count(${lessons.id})::int`,
      durationSeconds: sql<number>`coalesce(sum(${lessons.durationSeconds}), 0)::int`,
    })
    .from(modules)
    .leftJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(inArray(modules.courseId, courseIds))
    .groupBy(modules.courseId);
  return new Map(rows.map((r) => [r.courseId, { lessonCount: r.lessonCount, durationSeconds: r.durationSeconds }]));
}

export const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/categories', async () => {
    const rows = await db.select().from(categories).orderBy(asc(categories.name));
    return { categories: rows };
  });

  fastify.get('/courses', async (request, reply) => {
    const query = parse(z.object({ q: z.string().optional(), category: z.string().optional() }), request.query, reply);
    if (!query) return;
    const filters = [eq(courses.published, true)];
    if (query.q) filters.push(or(ilike(courses.title, `%${query.q}%`), ilike(courses.description, `%${query.q}%`))!);
    if (query.category) filters.push(eq(categories.slug, query.category));

    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        description: courses.description,
        thumbnailUrl: courses.thumbnailUrl,
        priceCents: courses.priceCents,
        featured: courses.featured,
        createdAt: courses.createdAt,
        category: { id: categories.id, name: categories.name, slug: categories.slug },
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(and(...filters))
      .orderBy(desc(courses.featured), desc(courses.createdAt));

    const stats = await courseStats(rows.map((r) => r.id));
    return {
      courses: rows.map((r) => ({
        ...r,
        category: r.category?.id ? r.category : null,
        ...(stats.get(r.id) ?? { lessonCount: 0, durationSeconds: 0 }),
      })),
    };
  });

  /** Detalhe do curso por slug ou id, com grade de módulos/aulas e progresso do aluno logado. */
  fastify.get('/courses/:slug', { preValidation: [fastify.optionalAuth] }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const user = currentUser(request);
    const isUuid = /^[0-9a-f-]{36}$/i.test(slug);

    const [course] = await db
      .select()
      .from(courses)
      .where(isUuid ? or(eq(courses.slug, slug), eq(courses.id, slug)) : eq(courses.slug, slug))
      .limit(1);
    if (!course || (!course.published && user?.role !== 'admin')) {
      return reply.status(404).send({ error: 'Curso não encontrado' });
    }

    const [category] = course.categoryId
      ? await db.select().from(categories).where(eq(categories.id, course.categoryId)).limit(1)
      : [];
    const mods = await db.select().from(modules).where(eq(modules.courseId, course.id)).orderBy(asc(modules.order), asc(modules.createdAt));
    const lessonRows = mods.length
      ? await db
          .select({
            id: lessons.id,
            moduleId: lessons.moduleId,
            title: lessons.title,
            description: lessons.description,
            order: lessons.order,
            durationSeconds: lessons.durationSeconds,
            isFreePreview: lessons.isFreePreview,
            createdAt: lessons.createdAt,
          })
          .from(lessons)
          .where(inArray(lessons.moduleId, mods.map((m) => m.id)))
          .orderBy(asc(lessons.order), asc(lessons.createdAt))
      : [];

    const hasAccess = await hasCourseAccess(user, course.id);
    const done = user ? await completedLessonIds(user.id, lessonRows.map((l) => l.id)) : new Set<string>();
    const lessonQuizzes = lessonRows.length
      ? await db.select({ id: quizzes.id, lessonId: quizzes.lessonId }).from(quizzes).where(inArray(quizzes.lessonId, lessonRows.map((l) => l.id)))
      : [];
    const quizByLesson = new Map(lessonQuizzes.map((q) => [q.lessonId, q.id]));
    const [finalQuiz] = await db
      .select({ id: quizzes.id, title: quizzes.title, passingScorePercent: quizzes.passingScorePercent })
      .from(quizzes)
      .where(and(eq(quizzes.courseId, course.id), eq(quizzes.context, 'course')))
      .limit(1);

    const outline = mods.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: lessonRows
        .filter((l) => l.moduleId === m.id)
        .map(({ moduleId, createdAt, ...l }) => ({ ...l, completed: done.has(l.id), quizId: quizByLesson.get(l.id) ?? null })),
    }));
    const flat = outline.flatMap((m) => m.lessons);
    const completedCount = flat.filter((l) => l.completed).length;

    const { caktoProductId, ...publicCourse } = course;
    return {
      course: { ...publicCourse, category: category ?? null },
      modules: outline,
      finalQuiz: finalQuiz ?? null,
      access: {
        hasAccess,
        loggedIn: Boolean(user),
      },
      progress: {
        total: flat.length,
        completed: completedCount,
        percent: flat.length ? Math.round((completedCount / flat.length) * 100) : 0,
        nextLessonId: flat.find((l) => !l.completed)?.id ?? flat[0]?.id ?? null,
      },
      stats: {
        lessonCount: flat.length,
        durationSeconds: flat.reduce((s, l) => s + (l.durationSeconds ?? 0), 0),
      },
    };
  });
};
