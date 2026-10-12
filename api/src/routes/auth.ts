import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { parse } from '../lib/http.js';
import type { AuthUser } from '../plugins/authenticate.js';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(255),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres').max(200),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const publicUser = (u: typeof users.$inferSelect) => ({ id: u.id, name: u.name, email: u.email, role: u.role, avatarUrl: u.avatarUrl });

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const sign = (u: typeof users.$inferSelect) => {
    const payload: AuthUser = { id: u.id, role: u.role, name: u.name, email: u.email };
    return fastify.jwt.sign(payload, { expiresIn: '7d' });
  };

  fastify.post('/register', async (request, reply) => {
    const body = parse(registerSchema, request.body, reply);
    if (!body) return;
    const exists = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${body.email}`).limit(1);
    if (exists.length) return reply.status(409).send({ error: 'Já existe uma conta com este e-mail' });

    const [user] = await db
      .insert(users)
      .values({ name: body.name, email: body.email, passwordHash: await bcrypt.hash(body.password, 10) })
      .returning();
    return reply.status(201).send({ token: sign(user!), user: publicUser(user!) });
  });

  fastify.post('/login', async (request, reply) => {
    const body = parse(loginSchema, request.body, reply);
    if (!body) return;
    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${body.email}`).limit(1);
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.status(401).send({ error: 'E-mail ou senha incorretos' });
    }
    return reply.send({ token: sign(user), user: publicUser(user) });
  });

  fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const [user] = await db.select().from(users).where(eq(users.id, request.user.id)).limit(1);
    if (!user) return reply.status(401).send({ error: 'Conta não encontrada' });
    return reply.send({ user: publicUser(user) });
  });

  fastify.patch('/me', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const body = parse(
      z.object({
        name: z.string().trim().min(2).max(255).optional(),
        currentPassword: z.string().optional(),
        newPassword: z.string().min(8).max(200).optional(),
      }),
      request.body,
      reply,
    );
    if (!body) return;
    const [user] = await db.select().from(users).where(eq(users.id, request.user.id)).limit(1);
    if (!user) return reply.status(401).send({ error: 'Conta não encontrada' });

    const update: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (body.name) update.name = body.name;
    if (body.newPassword) {
      if (!body.currentPassword || !(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
        return reply.status(400).send({ error: 'Senha atual incorreta' });
      }
      update.passwordHash = await bcrypt.hash(body.newPassword, 10);
    }
    const [updated] = await db.update(users).set(update).where(eq(users.id, user.id)).returning();
    return reply.send({ user: publicUser(updated!), token: sign(updated!) });
  });
};
