export type Role = 'admin' | 'student'
export type User = { id: string; name: string; email: string; role: Role; avatarUrl?: string | null }

export type Category = { id: string; name: string; slug: string }

export type CourseSummary = {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string | null
  priceCents: number
  featured: boolean
  category: Category | null
  lessonCount: number
  durationSeconds: number
}

export type OutlineLesson = {
  id: string
  title: string
  description: string | null
  order: number
  durationSeconds: number | null
  isFreePreview: boolean
  completed: boolean
  quizId: string | null
}

export type CourseDetail = {
  course: {
    id: string
    title: string
    slug: string
    description: string | null
    thumbnailUrl: string | null
    priceCents: number
    published: boolean
    category: Category | null
  }
  modules: { id: string; title: string; lessons: OutlineLesson[] }[]
  finalQuiz: { id: string; title: string; passingScorePercent: number } | null
  access: { hasAccess: boolean; loggedIn: boolean }
  progress: { total: number; completed: number; percent: number; nextLessonId: string | null }
  stats: { lessonCount: number; durationSeconds: number }
}

export type VideoSource = { kind: 'hls' | 'mp4' | 'embed'; url: string } | { kind: 'none' }
