import type { FastifyPluginAsync } from 'fastify';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { certificates, courses, purchases, users } from '../../db/schema.js';
import { idParam, parse } from '../../lib/http.js';
import { grantCourseAccess } from '../../services/access.js';
import { courseProgress } from '../../services/progress.js';

export const adminStudentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const query = parse(z.object({ q: z.string().optional() }), request.query, reply);
    if (!query) return;
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        courses: sql<number>`(select count(*)::int from purchases p where p.user_id = users.id and p.status = 'paid')`,
        certificates: sql<number>`(select count(*)::int from certificates c where c.user_id = users.id)`,
      })
      .from(users)
      .where(query.q ? or(ilike(users.name, `%${query.q}%`), ilike(users.email, `%${query.q}%`)) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(200);
    return { students: rows };
  });

  fastify.get('/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, params.id))
      .limit(1);
    if (!user) return reply.status(404).send({ error: 'Aluno não encontrado' });

    const enrollments = await db
      .select({ courseId: courses.id, title: courses.title, status: purchases.status, amountCents: purchases.amountCents, purchasedAt: purchases.purchasedAt })
      .from(purchases)
      .innerJoin(courses, eq(purchases.courseId, courses.id))
      .where(eq(purchases.userId, user.id))
      .orderBy(desc(purchases.createdAt));
    const withProgress = [];
    for (const e of enrollments) withProgress.push({ ...e, progress: await courseProgress(user.id, e.courseId) });
    const certs = await db
      .select({ title: certificates.contentTitleSnapshot, code: certificates.verificationCode, issuedAt: certificates.issuedAt })
      .from(certificates)
      .where(eq(certificates.userId, user.id));
    return { student: user, enrollments: withProgress, certificates: certs };
  });

  /** Libera acesso manualmente (ex.: bolsa, venda fora da Cakto). */
  fastify.post('/:id/grant', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(z.object({ courseId: z.string().uuid() }), request.body, reply);
    if (!params || !body) return;
    await grantCourseAccess(params.id, body.courseId, 0);
    return { ok: true };
  });

  fastify.post('/:id/revoke', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(z.object({ courseId: z.string().uuid() }), request.body, reply);
    if (!params || !body) return;
    await db
      .update(purchases)
      .set({ status: 'canceled' })
      .where(and(eq(purchases.userId, params.id), eq(purchases.courseId, body.courseId)));
    return { ok: true };
  });

  fastify.post('/:id/role', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(z.object({ role: z.enum(['admin', 'student']) }), request.body, reply);
    if (!params || !body) return;
    if (params.id === request.user.id && body.role !== 'admin') {
      return reply.status(400).send({ error: 'Você não pode remover seu próprio acesso de admin' });
    }
    await db.update(users).set({ role: body.role, updatedAt: new Date() }).where(eq(users.id, params.id));
    return { ok: true };
  });
};
