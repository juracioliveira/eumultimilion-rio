import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { courses, lessons, purchases, users, webhookEvents } from '../db/schema.js';
import { grantCourseAccess } from './access.js';
import { fetchBunnyVideoInfo } from './video.js';

type Job = { provider: string; externalEventId: string; payload: any };

// Bunny Stream: 3 = Finished, 4 = Resolution finished, 5 = Failed
const BUNNY_STATUS: Record<number, 'processing' | 'ready' | 'failed'> = {
  0: 'processing', 1: 'processing', 2: 'processing', 3: 'ready', 4: 'ready', 5: 'failed', 6: 'processing',
};

async function processBunny(payload: any) {
  const videoId = String(payload?.VideoGuid ?? '');
  const libraryId = String(payload?.VideoLibraryId ?? '');
  const status = BUNNY_STATUS[Number(payload?.Status)];
  if (!videoId || !status) return;

  const update: Partial<typeof lessons.$inferInsert> = { status, updatedAt: new Date() };
  if (status === 'ready') {
    const info = await fetchBunnyVideoInfo(libraryId, videoId);
    if (info?.durationSeconds) update.durationSeconds = info.durationSeconds;
    if (info?.thumbnailUrl) update.thumbnailUrl = info.thumbnailUrl;
  }
  await db.update(lessons).set(update).where(eq(lessons.bunnyVideoId, videoId));
}

/**
 * Cakto: o curso é identificado pelo id do produto (courses.cakto_product_id)
 * e o aluno pelo e-mail do comprador (precisa ter conta com o mesmo e-mail).
 */
async function processCakto(payload: any) {
  const event = String(payload?.event ?? '');
  const data = payload?.data ?? {};
  const email = String(data?.customer?.email ?? '').toLowerCase().trim();
  const productId = String(data?.product?.id ?? data?.offer?.product ?? '');
  const transactionId = String(data?.id ?? data?.refId ?? '');
  if (!email || !productId) return;

  const [course] = await db.select().from(courses).where(eq(courses.caktoProductId, productId)).limit(1);
  const [user] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  if (!course || !user) {
    console.warn(`[cakto] evento ${event} sem curso/aluno correspondente (produto ${productId}, e-mail ${email})`);
    return;
  }

  if (event === 'purchase_approved') {
    const amountCents = typeof data.amount === 'number' ? Math.round(data.amount * 100) : course.priceCents;
    await grantCourseAccess(user.id, course.id, amountCents, transactionId || undefined);
  } else if (event === 'refund' || event === 'chargeback') {
    await db
      .update(purchases)
      .set({ status: 'refunded' })
      .where(and(eq(purchases.userId, user.id), eq(purchases.courseId, course.id)));
  } else if (event === 'purchase_refused') {
    await db
      .update(purchases)
      .set({ status: 'canceled' })
      .where(and(eq(purchases.userId, user.id), eq(purchases.courseId, course.id), eq(purchases.status, 'pending')));
  }
}

export async function processWebhook({ provider, externalEventId, payload }: Job) {
  if (provider === 'bunny') await processBunny(payload);
  else if (provider === 'cakto') await processCakto(payload);

  await db
    .update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.externalEventId, externalEventId)));
}
