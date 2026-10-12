const SITE = 'Multimilionário'

/** Título da aba: "Página · Multimilionário" (ou só o nome do site). */
export function setTitle(page?: string | null) {
  document.title = page ? `${page} · ${SITE}` : `${SITE} — Cursos de empreendedorismo digital`
}
