import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  certificates,
  courseCompletions,
  courses,
  learningPathCourses,
  learningPaths,
  lessons,
  modules,
  quizAttempts,
  quizzes,
  users,
} from '../db/schema.js';
import { courseProgress } from './progress.js';
import { generateCertificatePdf, newVerificationCode } from './certificate.js';

async function courseWorkloadSeconds(courseId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${lessons.durationSeconds}), 0)::int` })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId));
  return row?.total ?? 0;
}

/** Prova final do curso (se existir) precisa ter ao menos uma tentativa aprovada. */
export async function courseFinalQuizPassed(userId: string, courseId: string): Promise<boolean> {
  const [quiz] = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(eq(quizzes.courseId, courseId), eq(quizzes.context, 'course')))
    .limit(1);
  if (!quiz) return true;
  const passed = await db
    .select({ id: quizAttempts.id })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quiz.id), eq(quizAttempts.userId, userId), eq(quizAttempts.passed, true)))
    .limit(1);
  return passed.length > 0;
}

/**
 * Verifica se o aluno concluiu o curso (todas as aulas + prova final, se houver).
 * Idempotente: registra course_completions e emite o certificado uma única vez.
 * Retorna o código do certificado quando o curso está concluído.
 */
export async function checkCourseCompletion(userId: string, courseId: string): Promise<string | null> {
  const progress = await courseProgress(userId, courseId);
  if (progress.total === 0 || progress.completed < progress.total) return null;
  if (!(await courseFinalQuizPassed(userId, courseId))) return null;

  await db.insert(courseCompletions).values({ userId, courseId }).onConflictDoNothing();

  const [existing] = await db
    .select({ code: certificates.verificationCode })
    .from(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)))
    .limit(1);

  const code = existing?.code ?? (await issueCourseCertificate(userId, courseId));
  await checkLearningPathCompletions(userId, courseId);
  return code;
}

async function issueCourseCertificate(userId: string, courseId: string): Promise<string | null> {
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  const [course] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!user || !course) return null;

  const verificationCode = newVerificationCode();
  const pdfUrl = await generateCertificatePdf({
    studentName: user.name,
    contentTitle: course.title,
    kind: 'course',
    verificationCode,
    workloadSeconds: await courseWorkloadSeconds(courseId),
  });

  const inserted = await db
    .insert(certificates)
    .values({ userId, type: 'course', courseId, contentTitleSnapshot: course.title, verificationCode, pdfUrl })
    .onConflictDoNothing()
    .returning({ code: certificates.verificationCode });
  console.log(`[certificado] ${user.name} concluiu "${course.title}" (${verificationCode})`);
  return inserted[0]?.code ?? null;
}

/** Emite certificado de trilha quando todos os cursos da trilha foram concluídos. */
async function checkLearningPathCompletions(userId: string, courseId: string) {
  const links = await db
    .select({ pathId: learningPathCourses.learningPathId })
    .from(learningPathCourses)
    .where(eq(learningPathCourses.courseId, courseId));

  for (const { pathId } of links) {
    const pathCourses = await db
      .select({ courseId: learningPathCourses.courseId })
      .from(learningPathCourses)
      .where(eq(learningPathCourses.learningPathId, pathId));
    const ids = pathCourses.map((c) => c.courseId);
    const done = await db
      .select({ courseId: courseCompletions.courseId })
      .from(courseCompletions)
      .where(and(eq(courseCompletions.userId, userId), inArray(courseCompletions.courseId, ids)));
    if (done.length < ids.length) continue;

    const [already] = await db
      .select({ id: certificates.id })
      .from(certificates)
      .where(and(eq(certificates.userId, userId), eq(certificates.learningPathId, pathId)))
      .limit(1);
    if (already) continue;

    const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
    const [path] = await db.select({ title: learningPaths.title }).from(learningPaths).where(eq(learningPaths.id, pathId)).limit(1);
    if (!user || !path) continue;

    const verificationCode = newVerificationCode();
    let workload = 0;
    for (const id of ids) workload += await courseWorkloadSeconds(id);
    const pdfUrl = await generateCertificatePdf({
      studentName: user.name,
      contentTitle: path.title,
      kind: 'learning_path',
      verificationCode,
      workloadSeconds: workload,
    });
    await db
      .insert(certificates)
      .values({ userId, type: 'learning_path', learningPathId: pathId, contentTitleSnapshot: path.title, verificationCode, pdfUrl })
      .onConflictDoNothing();
  }
}
