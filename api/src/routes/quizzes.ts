import type { FastifyPluginAsync } from 'fastify';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { courses, lessons, modules, quizAnswers, quizAttempts, quizOptions, quizQuestions, quizzes } from '../db/schema.js';
import { hasCourseAccess } from '../services/access.js';
import { checkCourseCompletion } from '../services/completion.js';
import { idParam, parse } from '../lib/http.js';

/** Curso ao qual o quiz pertence (direto, ou via aula → módulo). */
async function quizCourseId(quiz: typeof quizzes.$inferSelect): Promise<string | null> {
  if (quiz.courseId) return quiz.courseId;
  if (!quiz.lessonId) return null;
  const [row] = await db
    .select({ courseId: modules.courseId })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(lessons.id, quiz.lessonId))
    .limit(1);
  return row?.courseId ?? null;
}

export const quizRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preValidation', fastify.authenticate);

  /** Perguntas e opções — nunca expõe is_correct. */
  fastify.get('/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, params.id)).limit(1);
    if (!quiz) return reply.status(404).send({ error: 'Quiz não encontrado' });
    const courseId = await quizCourseId(quiz);
    if (!courseId || !(await hasCourseAccess(request.user, courseId))) return reply.status(403).send({ error: 'Sem acesso ao curso' });

    const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id)).orderBy(asc(quizQuestions.order));
    const options = questions.length
      ? await db
          .select({ id: quizOptions.id, questionId: quizOptions.questionId, optionText: quizOptions.optionText, order: quizOptions.order })
          .from(quizOptions)
          .where(inArray(quizOptions.questionId, questions.map((q) => q.id)))
          .orderBy(asc(quizOptions.order))
      : [];
    const attempts = await db
      .select({ id: quizAttempts.id, scorePercent: quizAttempts.scorePercent, passed: quizAttempts.passed, completedAt: quizAttempts.completedAt })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.quizId, quiz.id), eq(quizAttempts.userId, request.user.id)))
      .orderBy(desc(quizAttempts.startedAt))
      .limit(10);
    const [course] = await db.select({ title: courses.title, slug: courses.slug }).from(courses).where(eq(courses.id, courseId)).limit(1);

    return {
      quiz,
      course,
      questions: questions.map((q) => ({ ...q, options: options.filter((o) => o.questionId === q.id) })),
      attempts: attempts.filter((a) => a.completedAt),
    };
  });

  fastify.post('/:id/attempts', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, params.id)).limit(1);
    if (!quiz) return reply.status(404).send({ error: 'Quiz não encontrado' });
    const courseId = await quizCourseId(quiz);
    if (!courseId || !(await hasCourseAccess(request.user, courseId))) return reply.status(403).send({ error: 'Sem acesso ao curso' });
    const [attempt] = await db.insert(quizAttempts).values({ quizId: quiz.id, userId: request.user.id }).returning();
    return { attemptId: attempt!.id };
  });

  fastify.post('/attempts/:id/submit', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(
      z.object({ answers: z.array(z.object({ questionId: z.string().uuid(), selectedOptionIds: z.array(z.string().uuid()) })) }),
      request.body,
      reply,
    );
    if (!params || !body) return;

    const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, params.id)).limit(1);
    if (!attempt || attempt.userId !== request.user.id) return reply.status(403).send({ error: 'Tentativa inválida' });
    if (attempt.completedAt) return reply.status(409).send({ error: 'Esta tentativa já foi enviada' });

    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, attempt.quizId)).limit(1);
    const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, attempt.quizId));
    const options = questions.length
      ? await db.select().from(quizOptions).where(inArray(quizOptions.questionId, questions.map((q) => q.id)))
      : [];
    const questionIds = new Set(questions.map((q) => q.id));

    const toInsert: (typeof quizAnswers.$inferInsert)[] = [];
    const results: Record<string, { correct: boolean; correctOptionIds: string[] }> = {};
    let correctCount = 0;

    for (const q of questions) {
      const answer = body.answers.find((a) => a.questionId === q.id);
      const validIds = new Set(options.filter((o) => o.questionId === q.id).map((o) => o.id));
      const selected = [...new Set(answer?.selectedOptionIds ?? [])].filter((id) => validIds.has(id));
      const correctIds = options.filter((o) => o.questionId === q.id && o.isCorrect).map((o) => o.id);
      const correct = selected.length === correctIds.length && correctIds.every((id) => selected.includes(id));
      if (correct) correctCount++;
      results[q.id] = { correct, correctOptionIds: correctIds };
      for (const optId of selected) toInsert.push({ attemptId: attempt.id, questionId: q.id, selectedOptionId: optId });
    }
    if (body.answers.some((a) => !questionIds.has(a.questionId))) return reply.status(400).send({ error: 'Pergunta inválida' });

    if (toInsert.length) await db.insert(quizAnswers).values(toInsert);
    const scorePercent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
    const passed = scorePercent >= quiz!.passingScorePercent;
    await db.update(quizAttempts).set({ scorePercent, passed, completedAt: new Date() }).where(eq(quizAttempts.id, attempt.id));

    let certificateCode: string | null = null;
    if (passed && quiz!.context === 'course' && quiz!.courseId) {
      certificateCode = await checkCourseCompletion(request.user.id, quiz!.courseId);
    }
    return { scorePercent, passed, passingScorePercent: quiz!.passingScorePercent, correctCount, total: questions.length, results, certificateCode };
  });
};
