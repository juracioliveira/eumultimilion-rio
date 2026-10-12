/**
 * Dados iniciais: admin, categorias, cursos de exemplo (com aulas, quiz e prova final) e uma trilha.
 * Idempotente — pode rodar mais de uma vez. Admin: ADMIN_EMAIL / ADMIN_PASSWORD (.env).
 */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from './index.js';
import { categories, courses, learningPathCourses, learningPaths, lessons, modules, quizOptions, quizQuestions, quizzes, users } from './schema.js';

const SAMPLE_HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const SAMPLE_MP4 = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4';

const adminEmail = (process.env.ADMIN_EMAIL || 'admin@multimilionario.com').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'admin12345';

const [admin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
if (!admin) {
  await db.insert(users).values({ name: 'Administrador', email: adminEmail, role: 'admin', passwordHash: await bcrypt.hash(adminPassword, 10) });
  console.log(`Admin criado: ${adminEmail} / ${adminPassword} — troque a senha depois do primeiro login.`);
}

async function category(name: string, slug: string) {
  await db.insert(categories).values({ name, slug }).onConflictDoNothing();
  const [row] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return row!;
}

const trafego = await category('Tráfego & Vendas', 'trafego-vendas');
const mindset = await category('Mindset & Estratégia', 'mindset-estrategia');

type SeedLesson = { title: string; content: string; videoUrl?: string; durationSeconds?: number; free?: boolean };
type SeedCourse = {
  slug: string; title: string; description: string; thumbnailUrl: string; priceCents: number; featured?: boolean; categoryId: string;
  modules: { title: string; lessons: SeedLesson[] }[];
  finalQuiz?: { title: string; questions: { q: string; options: [string, boolean][] }[] };
};

const seedCourses: SeedCourse[] = [
  {
    slug: 'dominio-do-trafego',
    title: 'Domínio do Tráfego',
    description: 'Do zero ao avançado: estruture campanhas de tráfego pago que convertem todos os dias e escale com segurança.',
    thumbnailUrl: '/assets/thumb_course_geo_1788306685110.jpg',
    priceCents: 9700,
    featured: true,
    categoryId: trafego.id,
    modules: [
      {
        title: 'Fundamentos',
        lessons: [
          { title: 'O que é tráfego pago', videoUrl: SAMPLE_HLS, durationSeconds: 596, free: true, content: 'Nesta aula você entende **como funciona o leilão de anúncios** e por que o tráfego pago é o motor de crescimento de negócios digitais.\n\n- Tráfego orgânico x pago\n- Custo por clique, CPM e CPA\n- Quando começar a investir' },
          { title: 'Configurando sua conta de anúncios', videoUrl: SAMPLE_MP4, durationSeconds: 15, content: 'Passo a passo para criar o Gerenciador de Negócios, a conta de anúncios e instalar o pixel.' },
        ],
      },
      {
        title: 'Escala',
        lessons: [
          { title: 'Testes de criativos', videoUrl: SAMPLE_HLS, durationSeconds: 596, content: 'Como montar uma matriz de testes de criativos e ler os resultados sem se enganar com amostras pequenas.' },
          { title: 'Escalando campanhas vencedoras', content: 'Escala vertical (orçamento) x horizontal (novos públicos).\n\n1. Aumente no máximo 20–30% por dia\n2. Duplique o conjunto vencedor para novos públicos\n3. Acompanhe o CPA por 72h antes de nova alteração' },
        ],
      },
    ],
    finalQuiz: {
      title: 'Prova final — Domínio do Tráfego',
      questions: [
        { q: 'O que significa CPA?', options: [['Custo por aquisição', true], ['Cliques por anúncio', false], ['Custo por alcance', false]] },
        { q: 'Qual é um aumento de orçamento diário seguro ao escalar?', options: [['Até 20–30%', true], ['Dobrar todo dia', false], ['Triplicar de uma vez', false]] },
      ],
    },
  },
  {
    slug: 'mentalidade-milionaria',
    title: 'Mentalidade Milionária',
    description: 'Reprograme suas crenças sobre dinheiro e construa hábitos de quem cresce de forma consistente.',
    thumbnailUrl: '/assets/thumb_course_green_1788306665364.jpg',
    priceCents: 0,
    categoryId: mindset.id,
    modules: [
      {
        title: 'Crenças e hábitos',
        lessons: [
          { title: 'Suas crenças sobre dinheiro', videoUrl: SAMPLE_MP4, durationSeconds: 15, free: true, content: 'Identifique as crenças limitantes que travam seu crescimento financeiro.' },
          { title: 'Rotina de alta performance', content: 'Monte uma rotina simples: planejamento semanal, blocos de foco e revisão diária de 10 minutos.' },
        ],
      },
    ],
  },
  {
    slug: 'funis-de-ouro',
    title: 'Funis de Ouro',
    description: 'Desenhe funis de venda que transformam visitantes em clientes recorrentes.',
    thumbnailUrl: '/assets/thumb_course_gold_1788306675532.jpg',
    priceCents: 14700,
    categoryId: trafego.id,
    modules: [
      {
        title: 'Arquitetura do funil',
        lessons: [
          { title: 'Topo, meio e fundo', videoUrl: SAMPLE_HLS, durationSeconds: 596, free: true, content: 'As três etapas do funil e a métrica certa para cada uma.' },
          { title: 'Página de captura que converte', content: 'Estrutura: promessa clara, prova, chamada para ação única.' },
        ],
      },
    ],
  },
];

const createdIds: string[] = [];
for (const c of seedCourses) {
  const [existing] = await db.select().from(courses).where(eq(courses.slug, c.slug)).limit(1);
  if (existing) {
    createdIds.push(existing.id);
    continue;
  }
  const [course] = await db
    .insert(courses)
    .values({
      slug: c.slug, title: c.title, description: c.description, thumbnailUrl: c.thumbnailUrl,
      priceCents: c.priceCents, featured: c.featured ?? false, categoryId: c.categoryId, published: true,
    })
    .returning();
  createdIds.push(course!.id);

  for (const [mi, m] of c.modules.entries()) {
    const [mod] = await db.insert(modules).values({ courseId: course!.id, title: m.title, order: mi }).returning();
    for (const [li, l] of m.lessons.entries()) {
      const [lesson] = await db
        .insert(lessons)
        .values({
          moduleId: mod!.id, title: l.title, content: l.content, videoUrl: l.videoUrl ?? null,
          durationSeconds: l.durationSeconds ?? null, isFreePreview: l.free ?? false, order: li,
          status: l.videoUrl ? 'ready' : 'draft',
        })
        .returning();
      if (mi === 0 && li === 0) {
        const [quiz] = await db.insert(quizzes).values({ context: 'lesson', lessonId: lesson!.id, title: `Revisão: ${l.title}`, passingScorePercent: 50 }).returning();
        const [q] = await db.insert(quizQuestions).values({ quizId: quiz!.id, questionText: 'Você entendeu o objetivo desta aula?', order: 0 }).returning();
        await db.insert(quizOptions).values([
          { questionId: q!.id, optionText: 'Sim, quero aplicar', isCorrect: true, order: 0 },
          { questionId: q!.id, optionText: 'Ainda não', isCorrect: false, order: 1 },
        ]);
      }
    }
  }

  if (c.finalQuiz) {
    const [quiz] = await db.insert(quizzes).values({ context: 'course', courseId: course!.id, title: c.finalQuiz.title, passingScorePercent: 70 }).returning();
    for (const [qi, item] of c.finalQuiz.questions.entries()) {
      const [q] = await db.insert(quizQuestions).values({ quizId: quiz!.id, questionText: item.q, order: qi }).returning();
      await db.insert(quizOptions).values(item.options.map(([text, ok], oi) => ({ questionId: q!.id, optionText: text, isCorrect: ok, order: oi })));
    }
  }
  console.log(`Curso criado: ${c.title}`);
}

const [path] = await db.select().from(learningPaths).where(eq(learningPaths.slug, 'empreendedor-digital-iniciante')).limit(1);
if (!path) {
  const [created] = await db
    .insert(learningPaths)
    .values({
      slug: 'empreendedor-digital-iniciante',
      title: 'Empreendedor Digital Iniciante',
      description: 'A sequência recomendada para sair do zero: mentalidade, tráfego e funis.',
      thumbnailUrl: '/assets/hero_premium_bg_1788306655617.jpg',
      published: true,
    })
    .returning();
  const order = ['mentalidade-milionaria', 'dominio-do-trafego', 'funis-de-ouro'];
  const bySlug = new Map(seedCourses.map((c, i) => [c.slug, createdIds[i]!]));
  await db.insert(learningPathCourses).values(order.map((slug, i) => ({ learningPathId: created!.id, courseId: bySlug.get(slug)!, order: i })));
  console.log('Trilha criada: Empreendedor Digital Iniciante');
}

await pool.end();
console.log('Seed concluído.');
