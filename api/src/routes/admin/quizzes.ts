import type { FastifyPluginAsync } from 'fastify';
import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { quizOptions, quizQuestions, quizzes } from '../../db/schema.js';
import { idParam, parse } from '../../lib/http.js';

const questionInput = z
  .object({
    questionText: z.string().trim().min(1),
    type: z.enum(['single_choice', 'multiple_choice']).default('single_choice'),
    options: z.array(z.object({ optionText: z.string().trim().min(1), isCorrect: z.boolean() })).min(2),
  })
  .refine((q) => q.options.some((o) => o.isCorrect), { message: 'Marque ao menos uma alternativa correta' })
  .refine((q) => q.type === 'multiple_choice' || q.options.filter((o) => o.isCorrect).length === 1, {
    message: 'Pergunta de escolha única precisa de exatamente uma alternativa correta',
  });

const quizInput = z.object({
  title: z.string().trim().min(2).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  passingScorePercent: z.number().int().min(0).max(100).default(70),
  questions: z.array(questionInput),
});

/**
 * Quiz é editado como um documento único (título + perguntas + alternativas):
 * salvar substitui as perguntas. Tentativas antigas mantêm a nota já calculada.
 */
async function saveQuestions(quizId: string, questions: z.infer<typeof questionInput>[]) {
  await db.transaction(async (tx) => {
    await tx.delete(quizQuestions).where(eq(quizQuestions.quizId, quizId));
    for (const [i, q] of questions.entries()) {
      const [question] = await tx.insert(quizQuestions).values({ quizId, questionText: q.questionText, type: q.type, order: i }).returning();
      await tx.insert(quizOptions).values(q.options.map((o, j) => ({ questionId: question!.id, optionText: o.optionText, isCorrect: o.isCorrect, order: j })));
    }
  });
}

export const adminQuizRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, params.id)).limit(1);
    if (!quiz) return reply.status(404).send({ error: 'Quiz não encontrado' });
    const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id)).orderBy(asc(quizQuestions.order));
    const options = questions.length
      ? await db.select().from(quizOptions).where(inArray(quizOptions.questionId, questions.map((q) => q.id))).orderBy(asc(quizOptions.order))
      : [];
    return { quiz, questions: questions.map((q) => ({ ...q, options: options.filter((o) => o.questionId === q.id) })) };
  });

  fastify.post('/', async (request, reply) => {
    const body = parse(
      quizInput.extend({ context: z.enum(['lesson', 'course']), lessonId: z.string().uuid().optional(), courseId: z.string().uuid().optional() }),
      request.body,
      reply,
    );
    if (!body) return;
    if (body.context === 'lesson' ? !body.lessonId : !body.courseId) {
      return reply.status(400).send({ error: 'Informe a aula (quiz de aula) ou o curso (prova final)' });
    }
    const existing = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(body.context === 'lesson' ? eq(quizzes.lessonId, body.lessonId!) : eq(quizzes.courseId, body.courseId!))
      .limit(1);
    if (existing.length) return reply.status(409).send({ error: 'Já existe um quiz aqui', quizId: existing[0]!.id });

    const [quiz] = await db
      .insert(quizzes)
      .values({
        context: body.context,
        lessonId: body.context === 'lesson' ? body.lessonId : null,
        courseId: body.context === 'course' ? body.courseId : null,
        title: body.title,
        description: body.description ?? null,
        passingScorePercent: body.passingScorePercent,
      })
      .returning();
    await saveQuestions(quiz!.id, body.questions);
    return reply.status(201).send({ quiz });
  });

  fastify.put('/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(quizInput, request.body, reply);
    if (!params || !body) return;
    const [quiz] = await db
      .update(quizzes)
      .set({ title: body.title, description: body.description ?? null, passingScorePercent: body.passingScorePercent, updatedAt: new Date() })
      .where(eq(quizzes.id, params.id))
      .returning();
    if (!quiz) return reply.status(404).send({ error: 'Quiz não encontrado' });
    await saveQuestions(quiz.id, body.questions);
    return { quiz };
  });

  fastify.delete('/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    await db.delete(quizzes).where(eq(quizzes.id, params.id));
    return { ok: true };
  });
};
