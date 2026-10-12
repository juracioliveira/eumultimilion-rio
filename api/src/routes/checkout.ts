import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { courses, purchases } from '../db/schema.js';
import { env } from '../env.js';
import { grantCourseAccess, hasCourseAccess } from '../services/access.js';
import { parse } from '../lib/http.js';

const courseParam = z.object({ courseId: z.string().uuid() });

export const checkoutRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Inicia a compra. Curso gratuito → matrícula imediata.
   * Curso pago → registra compra "pending" e devolve o link de checkout da Cakto;
   * o acesso é liberado pelo webhook (POST /api/webhooks/cakto).
   */
  fastify.post('/course/:courseId', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const params = parse(courseParam, request.params, reply);
    if (!params) return;
    const [course] = await db.select().from(courses).where(eq(courses.id, params.courseId)).limit(1);
    if (!course || !course.published) return reply.status(404).send({ error: 'Curso não encontrado' });

    if (await hasCourseAccess(request.user, course.id)) return { status: 'enrolled' as const };

    if (course.priceCents === 0) {
      await grantCourseAccess(request.user.id, course.id, 0);
      return { status: 'enrolled' as const };
    }

    await db
      .insert(purchases)
      .values({ userId: request.user.id, courseId: course.id, amountCents: course.priceCents, status: 'pending' })
      .onConflictDoUpdate({
        target: [purchases.userId, purchases.courseId],
        set: { status: 'pending', amountCents: course.priceCents },
      });

    if (course.caktoCheckoutUrl) {
      const url = new URL(course.caktoCheckoutUrl);
      // pré-preenche o checkout com os dados do aluno (o webhook casa pelo e-mail)
      url.searchParams.set('email', request.user.email);
      url.searchParams.set('name', request.user.name);
      return { status: 'pending' as const, checkoutUrl: url.toString() };
    }
    if (env.allowFakeCheckout) return { status: 'pending' as const, checkoutUrl: null, simulated: true };
    return reply.status(503).send({ error: 'Pagamento indisponível para este curso no momento.' });
  });

  /** Pagamento simulado — só existe com ALLOW_FAKE_CHECKOUT=true (desenvolvimento). */
  fastify.post('/course/:courseId/simulate', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    if (!env.allowFakeCheckout) return reply.status(404).send({ error: 'Não encontrado' });
    const params = parse(courseParam, request.params, reply);
    if (!params) return;
    const [course] = await db.select().from(courses).where(eq(courses.id, params.courseId)).limit(1);
    if (!course) return reply.status(404).send({ error: 'Curso não encontrado' });
    await grantCourseAccess(request.user.id, course.id, course.priceCents, `simulado-${Date.now()}`);
    return { status: 'enrolled' as const };
  });

  /** Status da compra (a tela de retorno do checkout consulta até o webhook liberar). */
  fastify.get('/course/:courseId/status', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const params = parse(courseParam, request.params, reply);
    if (!params) return;
    return { hasAccess: await hasCourseAccess(request.user, params.courseId) };
  });
};
