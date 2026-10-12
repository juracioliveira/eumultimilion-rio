# Plataforma Multimilionário (LMS)

Plataforma de cursos avulsos (não-assinatura) sobre empreendedorismo digital, no formato de consumo "Prime Video": catálogo, player HLS, progresso por aula, trilhas de aprendizagem, quizzes, prova final e certificados verificáveis. Continuação da base do repositório `multimilionario`.

## O que já funciona

**Aluno**
- Cadastro, login e perfil (nome do certificado, troca de senha).
- Catálogo com busca e filtro por categoria; página do curso com grade de módulos/aulas.
- Matrícula imediata em cursos gratuitos; compra de cursos pagos pela Cakto (o webhook libera o acesso).
- Aulas de amostra grátis (visíveis sem comprar).
- Player de aula: HLS/mp4 (retoma de onde parou), YouTube/Vimeo/Bunny embed, material em texto, lista de aulas, aula anterior/próxima.
- Progresso automático (90% do vídeo) ou "Marcar como concluída".
- Área do aluno: continuar assistindo, meus cursos com % de progresso.
- Quiz por aula (formativo) e prova final do curso (obrigatória para o certificado), com múltiplas tentativas.
- Certificado em PDF emitido ao concluir o curso (e ao concluir todos os cursos de uma trilha), com página pública de validação em `/certificados/:codigo`.

**Admin** (`/admin`, só `role = admin` — checado no backend)
- Visão geral: alunos, receita, matrículas, certificados, últimas compras.
- Cursos: criar/editar/publicar/destacar/excluir, categorias, preço, link e ID do produto na Cakto.
- Módulos e aulas: criar, editar, reordenar, excluir; vídeo por URL ou upload direto para a Bunny Stream (TUS).
- Editor de quiz de aula e de prova final.
- Alunos: busca, progresso por curso, liberar/remover acesso (cortesia), promover a admin.
- Trilhas: criar/editar com cursos ordenados.

## Estrutura

```
api/   Fastify + Drizzle ORM + PostgreSQL (REST em /api/*). BullMQ opcional para webhooks.
web/   Vue 3 + Pinia + Tailwind 4 + Vite (SPA). Em dev, /api e /uploads vão por proxy para a API.
```

Documentos de domínio: [Arquitetura](ARQUITETURA.md) · [Design](DESIGN_GUIDELINES.md) · [Certificados](CERTIFICADOS.md) · [Upload de vídeo](FLUXO_UPLOAD.md) · [Quizzes](QUIZZES.md) · [Trilhas](ROTAS_APRENDIZAGEM.md)

## Rodando localmente

Pré-requisitos: Node.js 20+ e PostgreSQL. Redis é opcional.

```bash
npm install
cp .env.example .env          # ajuste DATABASE_URL e JWT_SECRET
npm run db:migrate            # cria as tabelas (api/drizzle/*.sql)
npm run db:seed               # admin + 3 cursos de exemplo + 1 trilha
npm run dev                   # API em :3333 e site em :5173
```

O seed cria o admin com `ADMIN_EMAIL` / `ADMIN_PASSWORD` do `.env` (padrão `admin@multimilionario.com` / `admin12345` — troque a senha no primeiro acesso).

Para testar compras sem a Cakto em desenvolvimento, use `ALLOW_FAKE_CHECKOUT=true`: o checkout mostra "Simular pagamento aprovado" quando o curso não tem link da Cakto. **Nunca ative em produção.**

### Testes e verificação

```bash
npm test             # testes de integração da API (precisa do banco migrado + seed)
npm run typecheck    # TypeScript da API e do frontend
npm run build        # build de produção (api/dist e web/dist)
```

### Mudanças no banco

Edite `api/src/db/schema.ts`, gere a migração com `npm run db:generate -w api` e aplique com `npm run db:migrate`.

## Integrações

### Cakto (pagamentos)
1. No admin, preencha no curso o **link de checkout** e o **ID do produto** da Cakto.
2. Na Cakto, configure o webhook para `https://SEU-DOMINIO/api/webhooks/cakto` com o segredo igual a `CAKTO_WEBHOOK_SECRET`.
3. Eventos tratados: `purchase_approved` (libera acesso), `refund` / `chargeback` (revoga), `purchase_refused`.
4. O aluno é identificado pelo **e-mail** do comprador — ele precisa ter conta com o mesmo e-mail (o checkout já é pré-preenchido com o e-mail da conta).

### Bunny Stream (vídeos) — opcional
Com `BUNNY_API_KEY` e `BUNNY_LIBRARY_ID`, o editor de aula ganha upload direto (browser → Bunny via TUS). Configure o webhook da biblioteca para `https://SEU-DOMINIO/api/webhooks/bunny?secret=BUNNY_WEBHOOK_SECRET` — ao terminar o processamento a aula fica "Pronta" com duração e thumbnail. Com `BUNNY_EMBED_TOKEN_KEY`, o player usa o embed da Bunny com link assinado e expiração. Sem Bunny, cada aula aceita URL de YouTube, Vimeo, `.mp4` ou `.m3u8`.

### Fila (Redis/BullMQ) — opcional
Com `REDIS_URL`, os webhooks são enfileirados e processados pelo worker (`npm run start:worker -w api`). Sem Redis são processados na própria requisição.

## Deploy (EasyPanel)

- **api**: `npm ci && npm run build -w api && npm run db:migrate -w api`, start `npm run start:api -w api`. Monte um volume em `UPLOADS_DIR` para os PDFs de certificado.
- **worker** (se usar Redis): mesma imagem, start `npm run start:worker -w api`.
- **web**: `npm run build -w web` e sirva `web/dist` (Nginx com fallback para `index.html`), fazendo proxy de `/api` e `/uploads` para a API — ou defina `VITE_API_URL` no build e `CORS_ORIGIN` na API.

## Próximos passos sugeridos
- Recuperação de senha por e-mail.
- Upload de capa de curso (hoje é por URL).
- Envio de e-mail ao emitir certificado.
