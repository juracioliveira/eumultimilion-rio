import type { FastifyPluginAsync } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { courses, lessonProgress, lessons, modules, quizzes } from '../db/schema.js';
import { currentUser } from '../plugins/authenticate.js';
import { hasCourseAccess } from '../services/access.js';
import { checkCourseCompletion } from '../services/completion.js';
import { courseLessonIds, courseProgress } from '../services/progress.js';
import { playbackSource } from '../services/video.js';
import { idParam, parse } from '../lib/http.js';

async function loadLesson(lessonId: string) {
  const [row] = await db
    .select({ lesson: lessons, courseId: modules.courseId, moduleTitle: modules.title })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return row;
}

export const playerRoutes: FastifyPluginAsync = async (fastify) => {
  /** Aula completa (vídeo + conteúdo) — exige compra, exceto aulas de amostra grátis. */
  fastify.get('/lessons/:id', { preValidation: [fastify.optionalAuth] }, async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    const user = currentUser(request);
    const row = await loadLesson(params.id);
    if (!row) return reply.status(404).send({ error: 'Aula não encontrada' });

    const [course] = await db
      .select({ id: courses.id, title: courses.title, slug: courses.slug, published: courses.published })
      .from(courses)
      .where(eq(courses.id, row.courseId))
      .limit(1);
    if (!course || (!course.published && user?.role !== 'admin')) return reply.status(404).send({ error: 'Aula não encontrada' });

    const hasAccess = await hasCourseAccess(user, course.id);
    if (!hasAccess && !row.lesson.isFreePreview) {
      return reply.status(user ? 403 : 401).send({
        error: user ? 'Você precisa adquirir o curso para assistir esta aula.' : 'Entre na sua conta para assistir.',
        course: { slug: course.slug, title: course.title },
      });
    }

    const ids = await courseLessonIds(course.id);
    const idx = ids.indexOf(row.lesson.id);
    const [progress] = user
      ? await db
          .select()
          .from(lessonProgress)
          .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.lessonId, row.lesson.id)))
          .limit(1)
      : [];
    const [quiz] = await db.select({ id: quizzes.id, title: quizzes.title }).from(quizzes).where(eq(quizzes.lessonId, row.lesson.id)).limit(1);

    const l = row.lesson;
    return {
      lesson: {
        id: l.id,
        title: l.title,
        description: l.description,
        content: l.content,
        durationSeconds: l.durationSeconds,
        thumbnailUrl: l.thumbnailUrl,
        isFreePreview: l.isFreePreview,
        moduleTitle: row.moduleTitle,
      },
      video: playbackSource(l),
      course,
      hasAccess,
      quiz: quiz ?? null,
      progress: { watchedSeconds: progress?.watchedSeconds ?? 0, completed: progress?.completed ?? false },
      navigation: {
        previousLessonId: idx > 0 ? ids[idx - 1] : null,
        nextLessonId: idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null,
        position: idx + 1,
        total: ids.length,
      },
    };
  });

  /** Progresso de visualização. Marca como concluída ao passar de 90% do vídeo. */
  fastify.post('/lessons/:id/progress', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(
      z.object({ watchedSeconds: z.number().min(0), totalSeconds: z.number().min(0).optional() }),
      request.body,
      reply,
    );
    if (!params || !body) return;
    const row = await loadLesson(params.id);
    if (!row) return reply.status(404).send({ error: 'Aula não encontrada' });
    if (!(await hasCourseAccess(request.user, row.courseId))) return reply.status(403).send({ error: 'Sem acesso ao curso' });

    const watchedSeconds = Math.floor(body.watchedSeconds);
    const reachedEnd = Boolean(body.totalSeconds && watchedSeconds >= body.totalSeconds * 0.9);

    // Nunca "desconclui" uma aula já concluída por causa de um novo ping de progresso.
    const [saved] = await db
      .insert(lessonProgress)
      .values({ userId: request.user.id, lessonId: params.id, watchedSeconds, completed: reachedEnd, lastWatchedAt: new Date() })
      .onConflictDoUpdate({
        target: [lessonProgress.userId, lessonProgress.lessonId],
        set: { watchedSeconds, lastWatchedAt: new Date(), ...(reachedEnd ? { completed: true } : {}) },
      })
      .returning();

    // Grava a duração real se a aula ainda não tem (vídeos externos)
    if (body.totalSeconds && !row.lesson.durationSeconds) {
      await db.update(lessons).set({ durationSeconds: Math.round(body.totalSeconds) }).where(eq(lessons.id, params.id));
    }

    const certificateCode = reachedEnd ? await checkCourseCompletion(request.user.id, row.courseId) : null;
    return { completed: saved?.completed ?? reachedEnd, certificateCode };
  });

  /** Marcar/desmarcar como concluída manualmente (aulas de texto, vídeos embed). */
  fastify.post('/lessons/:id/complete', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(z.object({ completed: z.boolean().default(true) }), request.body ?? {}, reply);
    if (!params || !body) return;
    const row = await loadLesson(params.id);
    if (!row) return reply.status(404).send({ error: 'Aula não encontrada' });
    if (!(await hasCourseAccess(request.user, row.courseId))) return reply.status(403).send({ error: 'Sem acesso ao curso' });

    await db
      .insert(lessonProgress)
      .values({ userId: request.user.id, lessonId: params.id, completed: body.completed, lastWatchedAt: new Date() })
      .onConflictDoUpdate({
        target: [lessonProgress.userId, lessonProgress.lessonId],
        set: { completed: body.completed, lastWatchedAt: new Date() },
      });

    const certificateCode = body.completed ? await checkCourseCompletion(request.user.id, row.courseId) : null;
    const progress = await courseProgress(request.user.id, row.courseId);
    return { completed: body.completed, certificateCode, progress };
  });
};
