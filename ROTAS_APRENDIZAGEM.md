# Rotas de Aprendizagem (Trilhas)

## Conceito
Uma **trilha** (`learning_paths`) agrupa vários cursos numa sequência recomendada — ex: "Trilha do Empreendedor Digital Iniciante" = Curso A → Curso B → Curso C. É o equivalente a uma "temporada" que reúne "episódios" (cursos).

## Modelo de dados
- `learning_paths`: dados da trilha (título, slug, thumbnail, publicado).
- `learning_path_courses`: join ordenado entre trilha e curso (`order` define a sequência sugerida). Um curso pode pertencer a mais de uma trilha.

## Regras de negócio do MVP
- A trilha **não tem preço próprio no MVP** — o aluno compra os cursos avulsos que a compõem (mantém o modelo de venda avulsa já decidido). A trilha é uma camada de navegação/curadoria, não um novo produto de checkout.
- Progresso da trilha = agregação do progresso dos cursos que a compõem (não precisa de tabela própria; calculado a partir de `course_completions` dos cursos vinculados).
- Trilha pode ter certificado próprio (`certificates.type = learning_path`), emitido quando o usuário concluir **todos** os cursos vinculados a ela.

## Ordem sugerida vs. obrigatória
No MVP a ordem é apenas sugestiva (não bloqueia acesso a um curso posterior antes do anterior). Bloqueio sequencial fica como evolução futura, se fizer sentido pro produto.

## Endpoints sugeridos
- `GET /api/learning-paths` — lista trilhas publicadas com contagem de cursos.
- `GET /api/learning-paths/:slug` — detalhe da trilha + cursos ordenados + progresso do usuário logado.
