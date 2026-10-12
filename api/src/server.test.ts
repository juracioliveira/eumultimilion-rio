/**
 * Teste de integração do fluxo principal. Precisa de um Postgres com migrações + seed
 * (npm run db:migrate && npm run db:seed) apontado por DATABASE_URL.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildServer } from './server.js';
import { pool } from './db/index.js';
import { env } from './env.js';

let app: FastifyInstance;
const email = `aluno-${Date.now()}@teste.com`;
let token = '';
let adminToken = '';

const call = async (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, body?: unknown, auth = token) => {
  const res = await app.inject({ method, url: `/api${url}`, payload: body as any, headers: auth ? { authorization: `Bearer ${auth}` } : {} });
  return { status: res.statusCode, body: res.json() as any };
};

before(async () => {
  app = await buildServer();
  await app.ready();
});

after(async () => {
  await app.close();
  await pool.end();
});

describe('fluxo do aluno', () => {
  test('cadastro e login', async () => {
    const reg = await call('POST', '/auth/register', { name: 'Aluno Teste', email, password: 'senha-segura' }, '');
    assert.equal(reg.status, 201);
    assert.equal(reg.body.user.role, 'student');
    const dup = await call('POST', '/auth/register', { name: 'Outro', email, password: 'senha-segura' }, '');
    assert.equal(dup.status, 409);
    const bad = await call('POST', '/auth/login', { email, password: 'errada' }, '');
    assert.equal(bad.status, 401);
    const ok = await call('POST', '/auth/login', { email: email.toUpperCase(), password: 'senha-segura' }, '');
    assert.equal(ok.status, 200);
    token = ok.body.token;
    const me = await call('GET', '/auth/me');
    assert.equal(me.body.user.email, email);
  });

  test('catálogo lista só cursos publicados', async () => {
    const { body } = await call('GET', '/courses', undefined, '');
    assert.ok(body.courses.length >= 3);
    assert.ok(body.courses.every((c: any) => typeof c.lessonCount === 'number'));
  });

  test('aula paga bloqueada, amostra grátis liberada', async () => {
    const { body } = await call('GET', '/courses/dominio-do-trafego');
    assert.equal(body.access.hasAccess, false);
    const lessons = body.modules.flatMap((m: any) => m.lessons);
    const free = lessons.find((l: any) => l.isFreePreview);
    const paid = lessons.find((l: any) => !l.isFreePreview);
    assert.equal((await call('GET', `/player/lessons/${paid.id}`)).status, 403);
    assert.equal((await call('GET', `/player/lessons/${paid.id}`, undefined, '')).status, 401);
    const freeLesson = await call('GET', `/player/lessons/${free.id}`, undefined, '');
    assert.equal(freeLesson.status, 200);
    assert.equal(freeLesson.body.video.kind, 'hls');
    // progresso exige acesso ao curso
    assert.equal((await call('POST', `/player/lessons/${free.id}/complete`, { completed: true })).status, 403);
  });

  test('curso gratuito: matrícula, conclusão e certificado', async () => {
    const { body: detail } = await call('GET', '/courses/mentalidade-milionaria');
    const enroll = await call('POST', `/checkout/course/${detail.course.id}`, {});
    assert.equal(enroll.body.status, 'enrolled');

    const lessons = detail.modules.flatMap((m: any) => m.lessons);
    let last: any;
    for (const l of lessons) last = await call('POST', `/player/lessons/${l.id}/complete`, { completed: true });
    assert.equal(last.body.progress.percent, 100);
    assert.match(last.body.certificateCode, /^[A-Z0-9]{12}$/);

    const cert = await call('GET', `/certificates/${last.body.certificateCode}`, undefined, '');
    assert.equal(cert.body.certificate.studentName, 'Aluno Teste');
    const mine = await call('GET', '/student/my-courses');
    assert.equal(mine.body.courses[0].certificateCode, last.body.certificateCode);
  });

  test('curso pago com prova final: certificado só após aprovação', async () => {
    const { body: detail } = await call('GET', '/courses/dominio-do-trafego');
    const checkout = await call('POST', `/checkout/course/${detail.course.id}`, {});
    assert.equal(checkout.body.status, 'pending');
    // webhook da Cakto libera o acesso (casando produto + e-mail)
    await call('PATCH', `/admin/courses/${detail.course.id}`, { caktoProductId: 'prod-trafego' }, adminToken || (await adminLogin()));
    const hook = { secret: env.cakto.webhookSecret, event: 'purchase_approved', data: { id: `tx-${Date.now()}`, amount: 97, customer: { email }, product: { id: 'prod-trafego' } } };
    const wrongSecret = await call('POST', '/webhooks/cakto', { ...hook, secret: 'x' }, '');
    assert.equal(wrongSecret.status, 401);
    assert.equal((await call('POST', '/webhooks/cakto', hook, '')).body.received, true);
    assert.equal((await call('POST', '/webhooks/cakto', hook, '')).body.duplicate, true);
    assert.equal((await call('GET', `/checkout/course/${detail.course.id}/status`)).body.hasAccess, true);

    const lessons = detail.modules.flatMap((m: any) => m.lessons);
    let last: any;
    for (const l of lessons) last = await call('POST', `/player/lessons/${l.id}/complete`, { completed: true });
    assert.equal(last.body.certificateCode, null, 'sem prova final aprovada não há certificado');

    const quiz = await call('GET', `/quizzes/${detail.finalQuiz.id}`);
    assert.ok(quiz.body.questions.every((q: any) => q.options.every((o: any) => !('isCorrect' in o))));
    const attempt = await call('POST', `/quizzes/${detail.finalQuiz.id}/attempts`, {});
    const wrong = quiz.body.questions.map((q: any) => ({ questionId: q.id, selectedOptionIds: [q.options[1].id] }));
    const failed = await call('POST', `/quizzes/attempts/${attempt.body.attemptId}/submit`, { answers: wrong });
    assert.equal(failed.body.passed, false);
    assert.equal((await call('POST', `/quizzes/attempts/${attempt.body.attemptId}/submit`, { answers: wrong })).status, 409);

    const attempt2 = await call('POST', `/quizzes/${detail.finalQuiz.id}/attempts`, {});
    const right = quiz.body.questions.map((q: any) => ({ questionId: q.id, selectedOptionIds: [q.options[0].id] }));
    const passed = await call('POST', `/quizzes/attempts/${attempt2.body.attemptId}/submit`, { answers: right });
    assert.equal(passed.body.scorePercent, 100);
    assert.match(passed.body.certificateCode, /^[A-Z0-9]{12}$/);
  });
});

async function adminLogin() {
  const res = await call('POST', '/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@multimilionario.com', password: process.env.ADMIN_PASSWORD || 'admin12345' }, '');
  adminToken = res.body.token;
  return adminToken;
}

describe('admin', () => {
  test('rotas admin exigem role admin', async () => {
    assert.equal((await call('GET', '/admin/stats', undefined, '')).status, 401);
    assert.equal((await call('GET', '/admin/stats')).status, 403);
    const stats = await call('GET', '/admin/stats', undefined, adminToken || (await adminLogin()));
    assert.equal(stats.status, 200);
    assert.ok(stats.body.stats.sales >= 1);
  });

  test('CRUD de curso, módulo e aula', async () => {
    const t = adminToken || (await adminLogin());
    const created = await call('POST', '/admin/courses', { title: 'Curso de Teste Ação', priceCents: 0 }, t);
    assert.equal(created.status, 201);
    assert.equal(created.body.course.slug, 'curso-de-teste-acao');
    const id = created.body.course.id;
    const mod = await call('POST', `/admin/courses/${id}/modules`, { title: 'Módulo 1' }, t);
    const lesson = await call('POST', `/admin/courses/modules/${mod.body.module.id}/lessons`, { title: 'Aula 1', videoUrl: 'https://youtu.be/dQw4w9WgXcQ', content: 'Texto' }, t);
    assert.equal(lesson.status, 201);
    // curso não publicado não aparece para alunos
    assert.equal((await call('GET', `/courses/${created.body.course.slug}`)).status, 404);
    await call('PATCH', `/admin/courses/${id}`, { published: true }, t);
    const pub = await call('GET', `/courses/${created.body.course.slug}`);
    assert.equal(pub.body.modules[0].lessons[0].title, 'Aula 1');
    const asAdmin = await call('GET', `/player/lessons/${lesson.body.lesson.id}`, undefined, t);
    assert.equal(asAdmin.body.video.kind, 'embed');
    assert.equal((await call('DELETE', `/admin/courses/${id}`, undefined, t)).status, 200);
  });
});
