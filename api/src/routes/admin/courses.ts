import type { FastifyPluginAsync } from 'fastify';
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { categories, courses, lessons, modules, purchases, quizzes } from '../../db/schema.js';
import { idParam, imageUrl, optionalUrl, parse } from '../../lib/http.js';
import { slugify } from '../../lib/slug.js';
import { courseStats } from '../catalog.js';
import { bunnyConfigured, createBunnyUpload } from '../../services/video.js';

const nullableText = z.string().trim().max(10000).nullable().optional().transform((v) => (v === '' ? null : v));

const courseInput = z.object({
  title: z.string().trim().min(2).max(255),
  slug: z.string().trim().max(280).optional(),
  description: nullableText,
  thumbnailUrl: imageUrl,
  categoryId: z.string().uuid().nullable().optional(),
  priceCents: z.number().int().min(0),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  caktoCheckoutUrl: optionalUrl,
  caktoProductId: z.string().trim().max(100).nullable().optional().transform((v) => (v === '' ? null : v)),
});

const moduleInput = z.object({ title: z.string().trim().min(1).max(255), order: z.number().int().optional() });

const lessonInput = z.object({
  title: z.string().trim().min(1).max(255),
  description: nullableText,
  content: z.string().max(200000).nullable().optional(),
  videoUrl: optionalUrl,
  durationSeconds: z.number().int().min(0).nullable().optional(),
  isFreePreview: z.boolean().optional(),
  order: z.number().int().optional(),
  moduleId: z.string().uuid().optional(),
});

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || 'curso';
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const [hit] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, candidate)).limit(1);
    if (!hit || hit.id === ignoreId) return candidate;
  }
}

async function nextOrder(table: 'modules' | 'lessons', parentId: string): Promise<number> {
  const [row] =
    table === 'modules'
      ? await db.select({ max: sql<number>`coalesce(max(${modules.order}), -1)::int` }).from(modules).where(eq(modules.courseId, parentId))
      : await db.select({ max: sql<number>`coalesce(max(${lessons.order}), -1)::int` }).from(lessons).where(eq(lessons.moduleId, parentId));
  return (row?.max ?? -1) + 1;
}

export const adminCourseRoutes: FastifyPluginAsync = async (fastify) => {
  // ---------- cursos ----------
  fastify.get('/', async () => {
    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        thumbnailUrl: courses.thumbnailUrl,
        priceCents: courses.priceCents,
        published: courses.published,
        featured: courses.featured,
        updatedAt: courses.updatedAt,
        categoryName: categories.name,
        students: sql<number>`(select count(*)::int from purchases p where p.course_id = courses.id and p.status = 'paid')`,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .orderBy(desc(courses.updatedAt));
    const stats = await courseStats(rows.map((r) => r.id));
    return { courses: rows.map((r) => ({ ...r, ...(stats.get(r.id) ?? { lessonCount: 0, durationSeconds: 0 }) })) };
  });

  fastify.get('/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    const [course] = await db.select().from(courses).where(eq(courses.id, params.id)).limit(1);
    if (!course) return reply.status(404).send({ error: 'Curso não encontrado' });
    const mods = await db.select().from(modules).where(eq(modules.courseId, course.id)).orderBy(asc(modules.order), asc(modules.createdAt));
    const lessonRows = mods.length
      ? await db.select().from(lessons).where(inArray(lessons.moduleId, mods.map((m) => m.id))).orderBy(asc(lessons.order), asc(lessons.createdAt))
      : [];
    const quizRows = await db
      .select({ id: quizzes.id, lessonId: quizzes.lessonId, courseId: quizzes.courseId, context: quizzes.context, title: quizzes.title })
      .from(quizzes)
      .where(
        lessonRows.length
          ? sql`${quizzes.courseId} = ${course.id} or ${inArray(quizzes.lessonId, lessonRows.map((l) => l.id))}`
          : eq(quizzes.courseId, course.id),
      );
    return {
      course,
      modules: mods.map((m) => ({ ...m, lessons: lessonRows.filter((l) => l.moduleId === m.id) })),
      quizzes: quizRows,
      bunnyEnabled: bunnyConfigured(),
    };
  });

  fastify.post('/', async (request, reply) => {
    const body = parse(courseInput, request.body, reply);
    if (!body) return;
    const [course] = await db
      .insert(courses)
      .values({ ...body, slug: await uniqueSlug(body.slug || body.title) })
      .returning();
    return reply.status(201).send({ course });
  });

  fastify.patch('/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(courseInput.partial(), request.body, reply);
    if (!params || !body) return;
    const update: Partial<typeof courses.$inferInsert> = { ...body, updatedAt: new Date() };
    if (body.slug !== undefined) update.slug = await uniqueSlug(body.slug || body.title || 'curso', params.id);
    const [course] = await db.update(courses).set(update).where(eq(courses.id, params.id)).returning();
    if (!course) return reply.status(404).send({ error: 'Curso não encontrado' });
    return { course };
  });

  fastify.delete('/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    await db.delete(courses).where(eq(courses.id, params.id));
    return { ok: true };
  });

  // ---------- módulos ----------
  fastify.post('/:id/modules', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(moduleInput, request.body, reply);
    if (!params || !body) return;
    const [mod] = await db
      .insert(modules)
      .values({ courseId: params.id, title: body.title, order: body.order ?? (await nextOrder('modules', params.id)) })
      .returning();
    return reply.status(201).send({ module: mod });
  });

  fastify.patch('/modules/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(moduleInput.partial(), request.body, reply);
    if (!params || !body) return;
    const [mod] = await db.update(modules).set(body).where(eq(modules.id, params.id)).returning();
    if (!mod) return reply.status(404).send({ error: 'Módulo não encontrado' });
    return { module: mod };
  });

  fastify.delete('/modules/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    await db.delete(modules).where(eq(modules.id, params.id));
    return { ok: true };
  });

  /** Reordena módulos e aulas de uma vez: [{ id, lessonIds: [...] }] na ordem final. */
  fastify.post('/:id/reorder', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(z.object({ modules: z.array(z.object({ id: z.string().uuid(), lessonIds: z.array(z.string().uuid()) })) }), request.body, reply);
    if (!params || !body) return;
    const owned = await db.select({ id: modules.id }).from(modules).where(eq(modules.courseId, params.id));
    const ownedIds = new Set(owned.map((m) => m.id));
    if (body.modules.some((m) => !ownedIds.has(m.id))) return reply.status(400).send({ error: 'Módulo não pertence ao curso' });

    await db.transaction(async (tx) => {
      for (const [i, m] of body.modules.entries()) {
        await tx.update(modules).set({ order: i }).where(eq(modules.id, m.id));
        for (const [j, lessonId] of m.lessonIds.entries()) {
          await tx.update(lessons).set({ order: j, moduleId: m.id }).where(eq(lessons.id, lessonId));
        }
      }
    });
    return { ok: true };
  });

  // ---------- aulas ----------
  fastify.post('/modules/:id/lessons', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(lessonInput, request.body, reply);
    if (!params || !body) return;
    const { moduleId: _ignored, ...values } = body;
    const [lesson] = await db
      .insert(lessons)
      .values({ ...values, moduleId: params.id, order: body.order ?? (await nextOrder('lessons', params.id)) })
      .returning();
    return reply.status(201).send({ lesson });
  });

  fastify.patch('/lessons/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    const body = parse(lessonInput.partial(), request.body, reply);
    if (!params || !body) return;
    const [lesson] = await db.update(lessons).set({ ...body, updatedAt: new Date() }).where(eq(lessons.id, params.id)).returning();
    if (!lesson) return reply.status(404).send({ error: 'Aula não encontrada' });
    return { lesson };
  });

  fastify.delete('/lessons/:id', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    await db.delete(lessons).where(eq(lessons.id, params.id));
    return { ok: true };
  });

  /** Upload de vídeo para a Bunny Stream: cria o vídeo e devolve credenciais TUS. Ver FLUXO_UPLOAD.md. */
  fastify.post('/lessons/:id/upload-url', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    if (!bunnyConfigured()) return reply.status(503).send({ error: 'Bunny Stream não configurado (BUNNY_API_KEY / BUNNY_LIBRARY_ID)' });
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, params.id)).limit(1);
    if (!lesson) return reply.status(404).send({ error: 'Aula não encontrada' });

    const upload = await createBunnyUpload(lesson.title);
    await db
      .update(lessons)
      .set({ bunnyVideoId: upload.videoId, bunnyLibraryId: upload.libraryId, status: 'uploading', updatedAt: new Date() })
      .where(eq(lessons.id, lesson.id));
    return upload;
  });

  /** Chamado pelo frontend quando o upload TUS termina (a Bunny avisa o fim do processamento via webhook). */
  fastify.post('/lessons/:id/upload-complete', async (request, reply) => {
    const params = parse(idParam, request.params, reply);
    if (!params) return;
    const [lesson] = await db
      .update(lessons)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(lessons.id, params.id))
      .returning();
    if (!lesson) return reply.status(404).send({ error: 'Aula não encontrada' });
    return { lesson };
  });
};
