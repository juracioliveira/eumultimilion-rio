# Certificados

## Gatilho de conclusão de curso
1. A cada atualização de `lesson_progress`, o backend verifica se **todas** as aulas do curso (excluindo talvez aulas opcionais, se esse conceito existir) estão com `completed = true` para aquele usuário.
2. Se sim, cria um registro em `course_completions` (idempotente via índice único `userId + courseId` — se já existe, não faz nada).
3. Criação de `course_completions` dispara (via fila BullMQ) o job de emissão de certificado.

## Emissão do certificado
1. Job gera um `verification_code` único (ex: `nanoid` de 12 caracteres).
2. Gera o PDF do certificado (nome do aluno, nome do curso, carga horária estimada, data, código de verificação) — pode usar uma lib server-side (ex: `pdf-lib` ou template HTML→PDF com Puppeteer).
3. PDF é enviado para storage (Bunny Storage ou S3-compatible) e a URL pública é salva em `certificates.pdfUrl`.
4. Registro final em `certificates` com `type = course`, `courseId`, `userId`, `verificationCode`, `pdfUrl` e `contentTitleSnapshot` (cópia do título do curso no momento da emissão — garante que o certificado continue legível mesmo se o curso for excluído depois; `courseId` nesse caso vira `null`, mas o título já emitido permanece).
5. Usuário recebe notificação (e-mail/in-app) com link do certificado.

## Certificado de trilha
Mesmo fluxo, mas o gatilho é: todos os cursos vinculados à trilha (`learning_path_courses`) têm `course_completions` para aquele usuário. Gera `certificates.type = learning_path` com `learningPathId` preenchido.

## Página pública de validação
- Rota `/certificados/:verificationCode` (pública, sem login) — busca o certificado pelo código e exibe nome do aluno, curso/trilha, data de emissão. Serve como prova de autenticidade (padrão do mercado de cursos online).

## Observação sobre carga horária
Se o certificado precisa exibir "carga horária" (comum nesse tipo de produto), somar `lessons.duration_seconds` de todas as aulas do curso no momento da emissão e gravar esse valor junto ao certificado (ou calcular on-the-fly a partir das aulas — mais simples pro MVP, mas menos "congelado" caso o curso mude depois).
