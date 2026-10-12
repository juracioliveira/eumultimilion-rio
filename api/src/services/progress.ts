import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { lessonProgress, lessons, modules } from '../db/schema.js';

/** Aulas do curso na ordem de exibição (módulo.order, aula.order). */
export async function courseLessonIds(courseId: string): Promise<string[]> {
  const rows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.order), asc(modules.createdAt), asc(lessons.order), asc(lessons.createdAt));
  return rows.map((r) => r.id);
}

export async function completedLessonIds(userId: string, lessonIds: string[]): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();
  const rows = await db
    .select({ lessonId: lessonProgress.lessonId })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.completed, true), inArray(lessonProgress.lessonId, lessonIds)));
  return new Set(rows.map((r) => r.lessonId));
}

export type CourseProgress = { total: number; completed: number; percent: number; nextLessonId: string | null };

export async function courseProgress(userId: string, courseId: string): Promise<CourseProgress> {
  const ids = await courseLessonIds(courseId);
  const done = await completedLessonIds(userId, ids);
  const completed = ids.filter((id) => done.has(id)).length;
  return {
    total: ids.length,
    completed,
    percent: ids.length ? Math.round((completed / ids.length) * 100) : 0,
    nextLessonId: ids.find((id) => !done.has(id)) ?? ids[0] ?? null,
  };
}
