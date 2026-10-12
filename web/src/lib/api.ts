import axios, { AxiosError } from 'axios'

/** Cliente HTTP da API. Em dev o Vite faz proxy de /api para o backend. */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

const TOKEN_KEY = 'token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // armazenamento indisponível (modo privado): sessão vale só para esta aba
  }
}

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Mensagem amigável a partir de um erro da API. */
export function apiError(err: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: string; issues?: { fieldErrors?: Record<string, string[]> } } | undefined
    const field = data?.issues?.fieldErrors && Object.values(data.issues.fieldErrors).flat()[0]
    if (field) return field
    if (data?.error) return data.error
    if (!err.response) return 'Não foi possível conectar ao servidor.'
  }
  return fallback
}

export function apiStatus(err: unknown): number | undefined {
  return err instanceof AxiosError ? err.response?.status : undefined
}
