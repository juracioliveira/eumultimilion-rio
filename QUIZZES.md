# Quizzes Personalizados

## Onde um quiz pode existir
- **Ao final de uma aula** (`quizzes.context = lesson`) — checagem rápida de entendimento.
- **Como prova final de um curso** (`quizzes.context = course`) — avaliação mais completa, geralmente com mais perguntas.

Cada aula ou curso tem no máximo um quiz (índices únicos parciais em `lesson_id`/`course_id` no schema).

## Estrutura
`quizzes` → `quiz_questions` (pergunta, tipo `single_choice`/`multiple_choice`, ordem) → `quiz_options` (alternativas, com `is_correct` marcado apenas no banco/admin, nunca exposto ao frontend do aluno antes de responder).

## Fluxo de tentativa (attempt)
1. Aluno inicia o quiz → cria `quiz_attempts` (`started_at`).
2. A cada pergunta respondida, grava uma ou mais linhas em `quiz_answers` (uma por opção marcada — no `single_choice` sempre 1, no `multiple_choice` pode ser várias).
3. Ao enviar o quiz, backend calcula `score_percent` comparando `quiz_answers.selected_option_id` com `quiz_options.is_correct` de cada pergunta, grava `passed` (`score_percent >= quizzes.passing_score_percent`) e `completed_at`.
4. Múltiplas tentativas são permitidas (não há índice único em `quiz_attempts` por usuário) — o histórico de tentativas fica registrado; o app decide se mostra a melhor nota ou a última.

## Relação com progresso e certificado
No MVP, a conclusão da aula (`lesson_progress.completed`) continua sendo baseada apenas em assistir o vídeo — o quiz de aula é formativo, não bloqueia o progresso. A prova final de curso (`context = course`), se existir, é uma decisão de produto: pode ser **obrigatória** para a emissão do certificado do curso ou apenas **complementar**. Recomendo tratar como obrigatória quando existir: o job de conclusão de curso (ver `CERTIFICADOS.md`) checa `course_completions` **e**, se houver quiz de curso, exige `quiz_attempts.passed = true` antes de disparar a emissão.

## Endpoints sugeridos
- `GET /api/quizzes/:id` — perguntas e opções (sem `is_correct`).
- `POST /api/quizzes/:id/attempts` — inicia tentativa.
- `POST /api/quizzes/attempts/:attemptId/answers` — grava resposta de uma pergunta.
- `POST /api/quizzes/attempts/:attemptId/submit` — fecha tentativa, calcula nota, retorna resultado.
