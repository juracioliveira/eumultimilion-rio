# Multimilionário — Arquitetura da Plataforma

## Visão geral

Plataforma de cursos avulsos (não-assinatura) sobre empreendedorismo digital, adaptada da base iEnfermagem-LMS. Estilo de consumo "Prime Video": catálogo, player em HLS, progresso de visualização por aula, trilhas, quizzes e certificados.

## Diagrama de sistema

```
                              ┌─────────────────────┐
                              │      Navegador       │
                              │  (aluno / admin)     │
                              └──────────┬───────────┘
                                         │ HTTPS
                    ┌────────────────────┼─────────────────────┐
                    │                    │                     │
                    ▼                    ▼                     ▼
          ┌──────────────────┐  ┌────────────────┐   ┌──────────────────┐
          │  Frontend (Vue3) │  │   API (Node)    │   │  Bunny Stream CDN │
          │  estático, Nginx │  │  REST, JWT auth │   │  (playlist HLS,   │
          │  na EasyPanel    │  │  na EasyPanel    │  │   upload TUS)     │
          └──────────────────┘  └────────┬────────┘   └────────┬─────────┘
                                          │                     │
                     ┌────────────────────┼─────────────────────┘
                     │                    │  webhook (vídeo pronto)
                     ▼                    ▼
           ┌──────────────────┐  ┌──────────────────┐
           │   PostgreSQL      │  │   Redis + BullMQ  │
           │  (metadados,      │  │  (fila: webhooks, │
           │   Drizzle ORM)    │  │  e-mails, certif.) │
           └──────────────────┘  └────────┬───────────┘
                                           │
                                           ▼
                                 ┌───────────────────┐
                                 │   Worker process    │
                                 │  (consome a fila,    │
                                 │  gera PDF certificado,│
                                 │  processa webhooks)  │
                                 └───────────────────┘

           ┌──────────────────┐        webhook (pagamento)
           │   Cakto (gateway) │ ─────────────────────────► API
           └──────────────────┘
```

Tudo dentro da caixa "EasyPanel" roda na mesma VPS, como containers Docker separados na mesma rede interna. Bunny Stream e Cakto são serviços externos, acessados via API/webhook.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Vue 3 + Pinia + TailwindCSS |
| Player de vídeo | hls.js / Vidstack consumindo HLS do Bunny Stream |
| Backend | Node.js (API REST) |
| ORM | Drizzle ORM |
| Banco de dados | PostgreSQL |
| Streaming de vídeo | Bunny Stream (upload, transcodificação adaptativa, CDN, player) |
| Fila/jobs | BullMQ + Redis (webhooks, e-mails, geração de certificado) |
| Pagamentos | Cakto (compra avulsa por curso) |
| Infra/deploy | EasyPanel (VPS própria, containers Docker) |

## Componentes e responsabilidades

### Frontend (Vue 3)
Build estático (Vite), servido por Nginx num container próprio. Consome só a API REST — nenhuma lógica de negócio no frontend além de UI state (Pinia). Duas áreas de rota: pública (catálogo, checkout, player, trilhas) e admin (CRUD de curso/aula/quiz, dashboard de vendas).

### API (Node)
Processo único de API REST organizado por domínio (não por camada técnica), cada domínio com suas próprias rotas/controllers/services:
- `auth` — registro, login, JWT
- `catalog` — categorias, cursos, módulos, aulas (CRUD admin + leitura pública)
- `media` — orquestra upload/URL assinada com a Bunny, recebe webhook de vídeo pronto
- `purchases` — cria cobrança na Cakto, recebe webhook de pagamento, controla acesso
- `progress` — grava `lesson_progress`, calcula `course_completions`
- `learning-paths` — CRUD de trilhas e vínculo com cursos
- `quizzes` — CRUD de quiz/perguntas/opções, tentativas e correção
- `certificates` — consulta e página pública de validação (`/certificados/:code`)
- `webhooks` — camada fina que só grava em `webhook_events` e enfileira o processamento real (idempotência)

A API não fala diretamente com a fila em requests síncronos de webhook — ela grava o evento e enfileira; quem processa é o worker (evita que uma resposta lenta da Bunny/Cakto trave o webhook endpoint).

### Worker (processo separado, mesmo código-base da API)
Consome a fila BullMQ: processa `webhook_events` pendentes, gera PDF de certificado, envia e-mails/notificações. Roda como container separado do processo de API (mesmo binário, comando de start diferente) — assim um pico de geração de certificados não compete por CPU/memória com requisições HTTP.

### PostgreSQL
Único banco, schema definido em `db/schema.ts` (Drizzle). Armazena só metadados — nunca binário de vídeo. Backup via dump agendado (ver `PROMPTS_DESENVOLVIMENTO.md`, Fase 5).

### Redis
Só para a fila BullMQ neste MVP (não é usado como cache de sessão — JWT é stateless).

## Topologia de deploy na EasyPanel

5 serviços na mesma VPS/rede interna:
1. `web` — container Nginx servindo o build do Vue 3 (porta interna 80, exposta via domínio principal)
2. `api` — container Node rodando a API REST (porta interna 3000, exposta em `/api` do mesmo domínio ou subdomínio `api.multimilionario.com`)
3. `worker` — container Node rodando o consumidor da fila (sem porta exposta publicamente)
4. `postgres` — serviço gerenciado pela própria EasyPanel
5. `redis` — serviço gerenciado pela própria EasyPanel

`api` e `worker` compartilham a mesma imagem Docker; o que muda é o comando de start (`npm run start:api` vs `npm run start:worker`) e as variáveis de ambiente (worker não precisa de `JWT_SECRET` de sessão de usuário, por exemplo). Isso evita manter dois Dockerfiles.

## Fluxos ponta a ponta (exemplos)

**Aluno assiste uma aula comprada:**
`browser → GET /api/lessons/:id/playback-url → API valida purchases.status=paid → API retorna URL HLS assinada da Bunny (token com expiração curta) → player consome direto da CDN da Bunny (não passa pela API/EasyPanel)`

**Aluno compra um curso:**
`browser → POST /api/purchases → API cria cobrança na Cakto, retorna link de checkout → aluno paga na Cakto → Cakto dispara webhook → API grava webhook_event → worker processa: purchases.status=paid (upsert) → notificação ao aluno`

**Admin sobe um vídeo novo:** ver `FLUXO_UPLOAD.md` (fluxo completo já detalhado).

**Aluno conclui um curso:** ver `CERTIFICADOS.md` e `QUIZZES.md`.

## Modelo de acesso a conteúdo

- Curso tem preço e é vendido avulso (sem assinatura).
- Compra aprovada pelo Cakto → webhook do Cakto libera `purchases.status = paid` → usuário ganha acesso às aulas do curso.
- Aulas podem ser marcadas como `is_free_preview = true` para amostra grátis (like trailer).
- URLs de reprodução HLS usam Token Authentication da Bunny (expiração curta) — a API nunca entrega uma URL de playlist "nua" e permanente.

## Segurança

- Autenticação de usuário: JWT (access token curto + refresh token), sem sessão em Redis neste MVP.
- Webhooks (Bunny e Cakto): validação de assinatura/origem antes de qualquer escrita no banco; evento sempre gravado em `webhook_events` primeiro (idempotência por `provider + external_event_id`).
- Vídeo: token de reprodução com expiração curta, para reduzir compartilhamento de link fora da plataforma.
- Rotas admin protegidas por `role = admin` (checagem no backend, nunca só escondendo botão no frontend).

## Estrutura de pastas sugerida (monorepo)

```
/apps
  /web        → frontend Vue 3
  /api        → backend Node (API + worker compartilham este código)
    /src
      /modules
        /auth
        /catalog
        /media
        /purchases
        /progress
        /learning-paths
        /quizzes
        /certificates
        /webhooks
      /db       → schema.ts, migrations (Drizzle)
      /queue    → definição dos jobs BullMQ
/docs           → os MDs deste projeto
```

## Módulos já modelados no MVP
- Certificados de conclusão (curso e trilha) — ver `CERTIFICADOS.md`
- Trilhas de aprendizagem (agrupamento ordenado de cursos) — ver `ROTAS_APRENDIZAGEM.md`
- Quizzes personalizados (por aula ou prova final de curso) — ver `QUIZZES.md`

## Direção visual
Frontend segue linguagem Liquid Glass (iOS 26) adaptada ao tema — ver `DESIGN_GUIDELINES.md`.

## Escalabilidade (para depois do MVP)
Nesta topologia de VPS única, os primeiros gargalos prováveis são: CPU do container `api` sob pico de acesso simultâneo ao catálogo, e memória do `worker` se muitos certificados forem gerados ao mesmo tempo (geração de PDF é pesada). Mitigação futura, sem redesenhar o modelo de dados: separar `worker` em VPS própria, ou mover geração de PDF para um serviço externo (ex: Gotenberg/API de PDF). Postgres numa VPS única aguenta bem o volume esperado de um MVP; migrar para gerenciado (RDS-like) só se o tráfego justificar.

## Fora do escopo deste MVP
- Comentários/dúvidas por aula
- Bloqueio sequencial de progresso dentro de uma trilha
