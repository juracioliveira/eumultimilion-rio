import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export type AuthUser = { id: string; role: 'admin' | 'student'; name: string; email: string };

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Exige token válido (401 caso contrário). */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Lê o token se existir, sem exigir login. */
    optionalAuth: (request: FastifyRequest) => Promise<void>;
    /** Exige token válido de um usuário admin (401/403). */
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authenticate = fp(async function (fastify) {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
  });

  fastify.decorate('optionalAuth', async function (request: FastifyRequest) {
    if (!request.headers.authorization) return;
    try {
      await request.jwtVerify();
    } catch {
      // token inválido/expirado: segue como visitante
    }
  });

  fastify.decorate('requireAdmin', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Acesso restrito a administradores' });
    }
  });
});

/** Usuário logado, ou undefined para visitantes (rotas com optionalAuth). */
export function currentUser(request: FastifyRequest): AuthUser | undefined {
  const user = (request as { user?: AuthUser }).user;
  return user?.id ? user : undefined;
}
