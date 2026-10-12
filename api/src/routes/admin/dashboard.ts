import type { FastifyPluginAsync } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { certificates, courseCompletions, courses, purchases, users } from '../../db/schema.js';

export const adminDashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stats', async () => {
    const [students] = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, 'student'));
    const [courseCount] = await db.select({ n: sql<number>`count(*)::int`, published: sql<number>`count(*) filter (where ${courses.published})::int` }).from(courses);
    const [sales] = await db
      .select({ n: sql<number>`count(*)::int`, revenueCents: sql<number>`coalesce(sum(${purchases.amountCents}), 0)::int` })
      .from(purchases)
      .where(eq(purchases.status, 'paid'));
    const [completions] = await db.select({ n: sql<number>`count(*)::int` }).from(courseCompletions);
    const [certs] = await db.select({ n: sql<number>`count(*)::int` }).from(certificates);

    const recent = await db
      .select({
        id: purchases.id,
        status: purchases.status,
        amountCents: purchases.amountCents,
        createdAt: purchases.createdAt,
        purchasedAt: purchases.purchasedAt,
        studentName: users.name,
        studentEmail: users.email,
        courseTitle: courses.title,
      })
      .from(purchases)
      .innerJoin(users, eq(purchases.userId, users.id))
      .innerJoin(courses, eq(purchases.courseId, courses.id))
      .orderBy(desc(purchases.createdAt))
      .limit(10);

    return {
      stats: {
        students: students?.n ?? 0,
        courses: courseCount?.n ?? 0,
        publishedCourses: courseCount?.published ?? 0,
        sales: sales?.n ?? 0,
        revenueCents: sales?.revenueCents ?? 0,
        completions: completions?.n ?? 0,
        certificates: certs?.n ?? 0,
      },
      recentPurchases: recent,
    };
  });
};
