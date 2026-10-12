import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============ ENUMS ============

export const userRoleEnum = pgEnum("user_role", ["admin", "student"]);

export const lessonStatusEnum = pgEnum("lesson_status", [
  "draft",
  "uploading",
  "processing",
  "ready",
  "failed",
]);

export const purchaseStatusEnum = pgEnum("purchase_status", [
  "pending",
  "paid",
  "refunded",
  "canceled",
]);

export const certificateTypeEnum = pgEnum("certificate_type", [
  "course",
  "learning_path",
]);

export const quizContextEnum = pgEnum("quiz_context", [
  "lesson", // quiz rápido ao final de uma aula
  "course", // prova final do curso
]);

export const quizQuestionTypeEnum = pgEnum("quiz_question_type", [
  "single_choice",
  "multiple_choice",
]);

// ============ USERS ============

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("student"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============ CATEGORIES ============

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============ COURSES ============

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 280 }).notNull().unique(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  trailerBunnyVideoId: varchar("trailer_bunny_video_id", { length: 100 }),
  priceCents: integer("price_cents").notNull(), // preço em centavos, venda avulsa (0 = gratuito)
  // link de checkout do produto na Cakto (o webhook libera o acesso)
  caktoCheckoutUrl: text("cakto_checkout_url"),
  // id do produto na Cakto — usado para casar o webhook de pagamento com o curso
  caktoProductId: varchar("cakto_product_id", { length: 100 }),
  featured: boolean("featured").notNull().default(false),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============ MODULES ============

export const modules = pgTable("modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============ LESSONS ============

export const lessons = pgTable("lessons", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  // conteúdo textual da aula (material de apoio, markdown simples)
  content: text("content"),
  order: integer("order").notNull().default(0),

  // URL externa de vídeo (mp4 ou playlist HLS) — alternativa ao Bunny Stream
  videoUrl: text("video_url"),

  // Bunny Stream
  bunnyLibraryId: varchar("bunny_library_id", { length: 50 }),
  bunnyVideoId: varchar("bunny_video_id", { length: 100 }),
  status: lessonStatusEnum("status").notNull().default("draft"),
  durationSeconds: integer("duration_seconds"),
  thumbnailUrl: text("thumbnail_url"),

  isFreePreview: boolean("is_free_preview").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============ PURCHASES (venda avulsa por curso) ============

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    status: purchaseStatusEnum("status").notNull().default("pending"),
    caktoTransactionId: varchar("cakto_transaction_id", { length: 150 }),
    purchasedAt: timestamp("purchased_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    // Um usuário tem no máximo 1 linha de compra por curso. Em caso de reembolso
    // seguido de nova compra, a aplicação deve fazer UPSERT nesta linha (voltar
    // para "pending"/"paid"), nunca inserir uma segunda linha — o índice único
    // abaixo depende disso.
    userCourseUnique: uniqueIndex("purchases_user_course_idx").on(
      table.userId,
      table.courseId
    ),
  })
);

// ============ LESSON PROGRESS ============

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    watchedSeconds: integer("watched_seconds").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    lastWatchedAt: timestamp("last_watched_at").notNull().defaultNow(),
  },
  (table) => ({
    userLessonUnique: uniqueIndex("progress_user_lesson_idx").on(
      table.userId,
      table.lessonId
    ),
  })
);

// ============ QUIZZES (personalizados, por aula ou prova final de curso) ============

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    context: quizContextEnum("context").notNull(),
    // preenchido conforme "context" — exatamente um dos dois deve estar preenchido
    lessonId: uuid("lesson_id").references(() => lessons.id, {
      onDelete: "cascade",
    }),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "cascade",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    passingScorePercent: integer("passing_score_percent")
      .notNull()
      .default(70),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // um quiz por aula, um quiz por curso (prova final) — evita duplicidade acidental
    lessonQuizUnique: uniqueIndex("quiz_lesson_idx")
      .on(table.lessonId)
      .where(sql`${table.lessonId} is not null`),
    courseQuizUnique: uniqueIndex("quiz_course_idx")
      .on(table.courseId)
      .where(sql`${table.courseId} is not null`),
  })
);

export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  type: quizQuestionTypeEnum("type").notNull().default("single_choice"),
  questionText: text("question_text").notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const quizOptions = pgTable("quiz_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => quizQuestions.id, { onDelete: "cascade" }),
  optionText: text("option_text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  order: integer("order").notNull().default(0),
});

// Uma tentativa = uma rodada do usuário respondendo o quiz inteiro (permite retry)
export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scorePercent: integer("score_percent"), // preenchido ao concluir
  passed: boolean("passed"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Resposta selecionada por pergunta dentro de uma tentativa.
// Para multiple_choice, o usuário gera uma linha por opção marcada.
export const quizAnswers = pgTable("quiz_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => quizQuestions.id, { onDelete: "cascade" }),
  selectedOptionId: uuid("selected_option_id")
    .notNull()
    .references(() => quizOptions.id, { onDelete: "cascade" }),
});

// ============ LEARNING PATHS (trilhas de aprendizagem) ============

export const learningPaths = pgTable("learning_paths", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 280 }).notNull().unique(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// join ordenado entre trilha e cursos
export const learningPathCourses = pgTable(
  "learning_path_courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learningPathId: uuid("learning_path_id")
      .notNull()
      .references(() => learningPaths.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    order: integer("order").notNull().default(0),
  },
  (table) => ({
    pathCourseUnique: uniqueIndex("learning_path_course_idx").on(
      table.learningPathId,
      table.courseId
    ),
  })
);

// ============ COURSE COMPLETIONS ============
// Registro materializado de quando um usuário concluiu 100% das aulas de um curso.
// Gatilho para emissão de certificado — evita recalcular progresso toda hora.

export const courseCompletions = pgTable(
  "course_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (table) => ({
    userCourseUnique: uniqueIndex("completion_user_course_idx").on(
      table.userId,
      table.courseId
    ),
  })
);

// ============ CERTIFICATES ============

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: certificateTypeEnum("type").notNull(),

    // onDelete "set null" (não cascade): um certificado já emitido é prova de
    // conclusão e não deve desaparecer se o curso/trilha for removido depois.
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "set null",
    }), // preenchido quando type = course
    learningPathId: uuid("learning_path_id").references(
      () => learningPaths.id,
      { onDelete: "set null" }
    ), // preenchido quando type = learning_path

    // snapshot do título no momento da emissão — garante que o certificado
    // continue legível mesmo se courseId/learningPathId virar null depois
    contentTitleSnapshot: varchar("content_title_snapshot", { length: 255 }).notNull(),

    verificationCode: varchar("verification_code", { length: 40 })
      .notNull()
      .unique(), // código público para validação em /certificados/:code
    pdfUrl: text("pdf_url"), // certificado gerado (armazenado em storage, ex: Bunny Storage ou S3)

    issuedAt: timestamp("issued_at").notNull().defaultNow(),
  },
  (table) => ({
    // impede emissão duplicada do mesmo certificado de curso para o mesmo usuário
    userCourseCertUnique: uniqueIndex("certificate_user_course_idx")
      .on(table.userId, table.courseId)
      .where(sql`${table.courseId} is not null`),
    // impede emissão duplicada do mesmo certificado de trilha para o mesmo usuário
    userPathCertUnique: uniqueIndex("certificate_user_path_idx")
      .on(table.userId, table.learningPathId)
      .where(sql`${table.learningPathId} is not null`),
  })
);

// ============ WEBHOOK EVENTS (idempotência: Bunny + Cakto) ============

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: varchar("provider", { length: 30 }).notNull(), // "bunny" | "cakto"
  externalEventId: varchar("external_event_id", { length: 150 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  providerEventUnique: uniqueIndex("webhook_provider_event_idx").on(
    table.provider,
    table.externalEventId
  ),
}));

// ============ RELATIONS ============

export const usersRelations = relations(users, ({ many }) => ({
  purchases: many(purchases),
  progress: many(lessonProgress),
  completions: many(courseCompletions),
  certificates: many(certificates),
  quizAttempts: many(quizAttempts),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  lesson: one(lessons, {
    fields: [quizzes.lessonId],
    references: [lessons.id],
  }),
  course: one(courses, {
    fields: [quizzes.courseId],
    references: [courses.id],
  }),
  questions: many(quizQuestions),
  attempts: many(quizAttempts),
}));

export const quizQuestionsRelations = relations(
  quizQuestions,
  ({ one, many }) => ({
    quiz: one(quizzes, {
      fields: [quizQuestions.quizId],
      references: [quizzes.id],
    }),
    options: many(quizOptions),
  })
);

export const quizOptionsRelations = relations(quizOptions, ({ one }) => ({
  question: one(quizQuestions, {
    fields: [quizOptions.questionId],
    references: [quizQuestions.id],
  }),
}));

export const quizAttemptsRelations = relations(
  quizAttempts,
  ({ one, many }) => ({
    quiz: one(quizzes, {
      fields: [quizAttempts.quizId],
      references: [quizzes.id],
    }),
    user: one(users, {
      fields: [quizAttempts.userId],
      references: [users.id],
    }),
    answers: many(quizAnswers),
  })
);

export const quizAnswersRelations = relations(quizAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [quizAnswers.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(quizQuestions, {
    fields: [quizAnswers.questionId],
    references: [quizQuestions.id],
  }),
  selectedOption: one(quizOptions, {
    fields: [quizAnswers.selectedOptionId],
    references: [quizOptions.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  courses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  category: one(categories, {
    fields: [courses.categoryId],
    references: [categories.id],
  }),
  modules: many(modules),
  purchases: many(purchases),
  pathLinks: many(learningPathCourses),
}));

export const learningPathsRelations = relations(learningPaths, ({ many }) => ({
  pathCourses: many(learningPathCourses),
  certificates: many(certificates),
}));

export const learningPathCoursesRelations = relations(
  learningPathCourses,
  ({ one }) => ({
    learningPath: one(learningPaths, {
      fields: [learningPathCourses.learningPathId],
      references: [learningPaths.id],
    }),
    course: one(courses, {
      fields: [learningPathCourses.courseId],
      references: [courses.id],
    }),
  })
);

export const courseCompletionsRelations = relations(
  courseCompletions,
  ({ one }) => ({
    user: one(users, {
      fields: [courseCompletions.userId],
      references: [users.id],
    }),
    course: one(courses, {
      fields: [courseCompletions.courseId],
      references: [courses.id],
    }),
  })
);

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, { fields: [certificates.userId], references: [users.id] }),
  course: one(courses, {
    fields: [certificates.courseId],
    references: [courses.id],
  }),
  learningPath: one(learningPaths, {
    fields: [certificates.learningPathId],
    references: [learningPaths.id],
  }),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
  course: one(courses, {
    fields: [modules.courseId],
    references: [courses.id],
  }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  module: one(modules, {
    fields: [lessons.moduleId],
    references: [modules.id],
  }),
  progress: many(lessonProgress),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
  user: one(users, { fields: [purchases.userId], references: [users.id] }),
  course: one(courses, {
    fields: [purchases.courseId],
    references: [courses.id],
  }),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  user: one(users, {
    fields: [lessonProgress.userId],
    references: [users.id],
  }),
  lesson: one(lessons, {
    fields: [lessonProgress.lessonId],
    references: [lessons.id],
  }),
}));
