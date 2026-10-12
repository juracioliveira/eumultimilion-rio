import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { purchases } from '../db/schema.js';
import type { AuthUser } from '../plugins/authenticate.js';

/** Admin acessa tudo; aluno precisa de compra paga (cursos gratuitos geram compra paga de R$ 0). */
export async function hasCourseAccess(user: AuthUser | undefined, courseId: string): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const rows = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(and(eq(purchases.userId, user.id), eq(purchases.courseId, courseId), eq(purchases.status, 'paid')))
    .limit(1);
  return rows.length > 0;
}

/** Libera (ou re-libera) o acesso: upsert na linha única user+course. */
export async function grantCourseAccess(userId: string, courseId: string, amountCents: number, caktoTransactionId?: string) {
  await db
    .insert(purchases)
    .values({ userId, courseId, amountCents, status: 'paid', purchasedAt: new Date(), caktoTransactionId })
    .onConflictDoUpdate({
      target: [purchases.userId, purchases.courseId],
      set: { status: 'paid', amountCents, purchasedAt: new Date(), ...(caktoTransactionId ? { caktoTransactionId } : {}) },
    });
}
