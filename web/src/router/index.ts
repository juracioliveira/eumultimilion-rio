import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
    guestOnly?: boolean
    /** Esconde a navbar pública (player, admin) */
    bare?: boolean
  }
}

const routes = [
  { path: '/', name: 'Home', component: () => import('../views/public/Home.vue') },
  { path: '/cursos', name: 'Catalog', component: () => import('../views/public/Catalog.vue') },
  { path: '/course/:slug', name: 'CourseDetail', component: () => import('../views/public/CourseDetail.vue') },
  { path: '/checkout/:slug', name: 'Checkout', component: () => import('../views/public/Checkout.vue'), meta: { requiresAuth: true } },
  { path: '/aula/:lessonId', name: 'Lesson', component: () => import('../views/student/Lesson.vue'), meta: { bare: true } },
  { path: '/my-courses', name: 'MyCourses', component: () => import('../views/student/MyCourses.vue'), meta: { requiresAuth: true } },
  { path: '/perfil', name: 'Profile', component: () => import('../views/student/Profile.vue'), meta: { requiresAuth: true } },
  { path: '/quiz/:quizId', name: 'Quiz', component: () => import('../views/student/Quiz.vue'), meta: { requiresAuth: true } },
  { path: '/paths', name: 'Paths', component: () => import('../views/public/Paths.vue') },
  { path: '/paths/:slug', name: 'PathDetail', component: () => import('../views/public/PathDetail.vue') },
  { path: '/certificados/:code', name: 'Certificate', component: () => import('../views/public/Certificate.vue') },
  { path: '/login', name: 'Login', component: () => import('../views/auth/Login.vue'), meta: { guestOnly: true } },
  { path: '/cadastro', name: 'Register', component: () => import('../views/auth/Register.vue'), meta: { guestOnly: true } },
  {
    path: '/admin',
    component: () => import('../components/admin/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, bare: true },
    children: [
      { path: '', name: 'AdminDashboard', component: () => import('../views/admin/Dashboard.vue') },
      { path: 'cursos', name: 'AdminCourses', component: () => import('../views/admin/Courses.vue') },
      { path: 'cursos/:id', name: 'AdminCourseEditor', component: () => import('../views/admin/CourseEditor.vue') },
      { path: 'quizzes/:id', name: 'AdminQuizEditor', component: () => import('../views/admin/QuizEditor.vue') },
      { path: 'alunos', name: 'AdminStudents', component: () => import('../views/admin/Students.vue') },
      { path: 'alunos/:id', name: 'AdminStudent', component: () => import('../views/admin/StudentDetail.vue') },
      { path: 'trilhas', name: 'AdminPaths', component: () => import('../views/admin/Paths.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('../views/public/NotFound.vue') },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, saved) {
    return saved ?? { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresAdmin && !auth.isAdmin) return { name: 'Home' }
  if (to.meta.guestOnly && auth.isAuthenticated) return { name: auth.isAdmin ? 'AdminDashboard' : 'MyCourses' }
})
