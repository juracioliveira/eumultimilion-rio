import type { FastifyPluginAsync } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { certificates, courses, lessonProgress, lessons, modules, purchases } from '../db/schema.js';
import { courseProgress } from '../services/progress.js';

export const studentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preValidation', fastify.authenticate);

  fastify.get('/my-courses', async (request) => {
    const userId = request.user.id;
    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        thumbnailUrl: courses.thumbnailUrl,
        description: courses.description,
        purchasedAt: purchases.purchasedAt,
      })
      .from(purchases)
      .innerJoin(courses, eq(purchases.courseId, courses.id))
      .where(and(eq(purchases.userId, userId), eq(purchases.status, 'paid')))
      .orderBy(desc(purchases.purchasedAt));

    const certs = await db
      .select({ courseId: certificates.courseId, code: certificates.verificationCode })
      .from(certificates)
      .where(and(eq(certificates.userId, userId), eq(certificates.type, 'course')));
    const certByCourse = new Map(certs.map((c) => [c.courseId, c.code]));

    const result = [];
    for (const c of rows) {
      const progress = await courseProgress(userId, c.id);
      const [next] = progress.nextLessonId
        ? await db.select({ title: lessons.title }).from(lessons).where(eq(lessons.id, progress.nextLessonId)).limit(1)
        : [];
      result.push({ ...c, progress: { ...progress, nextLessonTitle: next?.title ?? null }, certificateCode: certByCourse.get(c.id) ?? null });
    }
    return { courses: result };
  });

  fastify.get('/continue-watching', async (request) => {
    const rows = await db
      .select({
        lessonId: lessons.id,
        title: lessons.title,
        thumbnailUrl: lessons.thumbnailUrl,
        durationSeconds: lessons.durationSeconds,
        watchedSeconds: lessonProgress.watchedSeconds,
        lastWatchedAt: lessonProgress.lastWatchedAt,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        courseThumbnailUrl: courses.thumbnailUrl,
      })
      .from(lessonProgress)
      .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .innerJoin(courses, eq(modules.courseId, courses.id))
      .where(and(eq(lessonProgress.userId, request.user.id), eq(lessonProgress.completed, false)))
      .orderBy(desc(lessonProgress.lastWatchedAt))
      .limit(6);
    return { history: rows };
  });

  fastify.get('/certificates', async (request) => {
    const rows = await db
      .select({
        type: certificates.type,
        title: certificates.contentTitleSnapshot,
        code: certificates.verificationCode,
        pdfUrl: certificates.pdfUrl,
        issuedAt: certificates.issuedAt,
      })
      .from(certificates)
      .where(eq(certificates.userId, request.user.id))
      .orderBy(desc(certificates.issuedAt));
    return { certificates: rows };
  });
};
