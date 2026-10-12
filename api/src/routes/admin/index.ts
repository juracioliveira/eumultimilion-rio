import type { FastifyPluginAsync } from 'fastify';
import { adminDashboardRoutes } from './dashboard.js';
import { adminCourseRoutes } from './courses.js';
import { adminCategoryRoutes } from './categories.js';
import { adminStudentRoutes } from './students.js';
import { adminPathRoutes } from './paths.js';
import { adminQuizRoutes } from './quizzes.js';

/** Todas as rotas /api/admin/* exigem role = admin (checagem no backend). */
export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preValidation', fastify.requireAdmin);
  await fastify.register(adminDashboardRoutes);
  await fastify.register(adminCourseRoutes, { prefix: '/courses' });
  await fastify.register(adminCategoryRoutes, { prefix: '/categories' });
  await fastify.register(adminStudentRoutes, { prefix: '/students' });
  await fastify.register(adminPathRoutes, { prefix: '/learning-paths' });
  await fastify.register(adminQuizRoutes, { prefix: '/quizzes' });
};
