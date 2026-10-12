import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import { env } from './env.js';
import { authenticate } from './plugins/authenticate.js';
import { authRoutes } from './routes/auth.js';
import { catalogRoutes } from './routes/catalog.js';
import { checkoutRoutes } from './routes/checkout.js';
import { webhookRoutes } from './routes/webhooks.js';
import { studentRoutes } from './routes/student.js';
import { playerRoutes } from './routes/player.js';
import { quizRoutes } from './routes/quizzes.js';
import { pathRoutes } from './routes/paths.js';
import { certificateRoutes } from './routes/certificates.js';
import { adminRoutes } from './routes/admin/index.js';

export async function buildServer() {
  const server = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  await server.register(cors, { origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',') });
  await server.register(jwt, { secret: env.jwtSecret });
  await server.register(authenticate);

  fs.mkdirSync(env.uploadsDir, { recursive: true });
  await server.register(fastifyStatic, { root: env.uploadsDir, prefix: '/uploads/' });

  await server.register(
    async (api) => {
      api.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(catalogRoutes);
      await api.register(checkoutRoutes, { prefix: '/checkout' });
      await api.register(webhookRoutes, { prefix: '/webhooks' });
      await api.register(studentRoutes, { prefix: '/student' });
      await api.register(playerRoutes, { prefix: '/player' });
      await api.register(quizRoutes, { prefix: '/quizzes' });
      await api.register(pathRoutes, { prefix: '/learning-paths' });
      await api.register(certificateRoutes, { prefix: '/certificates' });
      await api.register(adminRoutes, { prefix: '/admin' });
    },
    { prefix: '/api' },
  );

  return server;
}

if (process.env.NODE_ENV !== 'test') {
  const server = await buildServer();
  try {
    await server.listen({ port: env.port, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
