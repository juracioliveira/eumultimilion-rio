# Diretrizes de Design — Multimilionário

Direção pedida: nível Apple/iOS 26 (Liquid Glass). Este documento traduz isso em tokens concretos pro Vue 3 + Tailwind, evitando cair no "kit SaaS genérico" (cards idênticos, sombra cinza padrão, gradiente decorativo) — a identidade vem do tema (empreendedorismo, ascensão financeira) combinado com a linguagem de material translúcido do iOS 26, não de um template Apple qualquer.

## O que é "Liquid Glass" na prática
Não é um filtro estético — é uma regra de hierarquia: **conteúdo fica opaco e nítido na camada de base; controles (nav, player, modais, quiz) flutuam translúcidos por cima**, com blur e leve refração. Aplicado aqui:
- Capas de curso, thumbnails, texto → sempre opacos e legíveis, nunca atrás de vidro.
- Barra de navegação, overlay de progresso "continue assistindo", modal de quiz, controles do player → superfícies de vidro (`backdrop-blur` + borda translúcida sutil).

## Token system

**Cor** (base escura — combina com o tom "premium/streaming" e evita o clichê cream+terracota):
| Token | Hex | Uso |
|---|---|---|
| `bg-base` | `#0B0E16` | fundo geral (obsidiana) |
| `surface-glass` | `rgba(255,255,255,0.07)` + blur | nav, modais, player controls |
| `border-glass` | `rgba(255,255,255,0.14)` | borda 1px das superfícies de vidro |
| `accent-gold` | `#C6A15B` | CTA primário, estado "comprado/premium" — usar com moderação |
| `accent-emerald` | `#2E6F5E` | sucesso: progresso concluído, certificado emitido, quiz aprovado |
| `text-primary` | `#F6F4EE` | texto sobre fundo escuro |
| `text-muted` | `#9CA3AF` | metadados, legendas, timestamps |

O dourado é o único acento "de luxo" — reservado para CTA de compra e badges de conquista. Não usar gradiente decorativo espalhado; se precisar de destaque, use o dourado sólido ou blur, nunca os dois ao mesmo tempo na mesma superfície.

**Tipografia**: uma família só, duas variantes ópticas — `-apple-system, "SF Pro Display"` para títulos/hero, `"SF Pro Text", Inter` (fallback web) para corpo. Nada de segunda família decorativa. Títulos de hero com peso alto e tracking levemente negativo; corpo com line-height generoso (conteúdo educacional pede conforto de leitura, não densidade de jornal).

**Layout**: carrosséis horizontais por categoria (padrão streaming) como estrutura principal da home, não grid uniforme de cards. Cantos bem arredondados e contínuos (`rounded-[28px]` em cards de destaque, `rounded-2xl` em cards de linha) — arredondamento generoso é parte da linguagem iOS 26, mas varie a escala por hierarquia (hero > card de curso > chip de tag), nunca o mesmo raio em tudo.

## Princípios
1. **Vidro é cromo, não decoração.** Se um elemento não é controle de navegação/interação, ele não recebe blur.
2. **Um acento, usado com intenção.** Dourado = ação/conquista. Esmeralda = progresso/sucesso. Não misturar os dois na mesma tela sem motivo.
3. **Movimento só em resposta a ação do usuário**: abrir um módulo, concluir um quiz, desbloquear certificado — não scroll-reveal genérico em cada card.
4. **Numeração (1, 2, 3...) só onde a ordem é real** — trilhas de aprendizagem e passos de quiz são sequência de verdade, então numerar aí é correto; não usar numeração como decoração em outras listas.
5. Evitar por padrão: eyebrow label em CAIXA ALTA, "→" no fim de botão, sombra cinza `rgba(0,0,0,.1)` idêntica em todo card — esses são os tiques do "design genérico" e não têm relação com o tema da plataforma.

## Implementação (Tailwind/Vue)
- `backdrop-filter: blur(20px)` + `background: rgba(255,255,255,0.07)` + `border: 1px solid rgba(255,255,255,0.14)` como classe utilitária `.glass-surface`, reaproveitada em nav, modal e player controls.
- Respeitar `prefers-reduced-motion` em todas as transições de player/quiz/certificado.
- Foco de teclado visível (outline dourado sutil) em todos os controles — acessibilidade não é opcional mesmo com vidro translúcido de fundo.
