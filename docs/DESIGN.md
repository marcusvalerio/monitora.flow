# Monitora — sistema de movimento e material

**Ordem de prioridade:** conteúdo → material → movimento. Nenhum efeito sem função (visual, espacial ou informacional).
Movimento nunca esconde problema de dado; vidro nunca compensa falta de hierarquia.

## Cor (tokens em `app/globals.css`)
| Token | Hex | Papel |
|---|---|---|
| Deep | `#000022` | profundidade, texto, fundo escuro, BRT (claro) |
| Atlantic | `#104071` | interação (claro), ônibus |
| Teal | `#1A9597` | mobilidade / informação viva, trajeto no mapa, interação (escuro) |
| Lime | `#EEFF99` | **só sinal**: aba ativa, item selecionado, BRT (escuro), foco. Nunca texto sobre fundo claro |
| Off-white | `#FDFDFE` | superfícies |
| Mist | `#EEF2F3` | fundo |

Cores de dado são semânticas e fixas: BRT = Deep+Lime (escuro: Lime+Deep), ônibus = Atlantic;
estados do veículo verde/âmbar/vermelho/cinza (no trajeto / incerto / fora / sem atualização). Movimento não muda cor de dado.

## Tipografia
Display: **Bricolage Grotesque 600** (temperatura, ETA, totais, títulos). UI e dados: **Instrument Sans 500–650**.
Números importantes são protagonistas e não ultrafinos.

## Movimento (`--dur-*`, `--spring` no CSS; `app/ui/motion.ts` no JS)
| Nível | Duração | Uso |
|---|---|---|
| Micro | 100–250 ms | pressão, hover, cor |
| Interação | 250–450 ms | aba, chip, painel, câmera curta |
| Espacial | 400–700 ms | câmera do mapa, painel inferior (mola) |
| Atmosfera | 3–20 s+ | clima, água — contínuo e lento, períodos primos entre si |

Curvas: `--ease-out` (saídas), `--ease-in-out` (espacial), `--spring` (mola criticamente amortecida, ~4% de overshoot — sem "bounce").
`prefers-reduced-motion` desliga tudo que se move; o material estático fica.

**Veículo.** Interpola do ponto desenhado até o dado real seguinte, no ritmo do GPS (≈ 85% do intervalo entre leituras), e sempre termina no dado
recebido — nunca extrapola. Pela via só quando ON_ROUTE no mesmo shape; salto > 800 m (provável erro) é mostrado rápido, não suavizado.
Estados com forma própria: andando (anel de direção), parado (anel recolhido + marca), incerto/fora (contorno tracejado, posição GPS real),
desatualizado (esmaecido).

**Mapa.** Seleção de estação/linha/veículo move a câmera com duração espacial; veículo selecionado só "puxa" a câmera se estiver fora da área visível.
**Água.** Textura de ondulação abstrata sobre a camada `water` do estilo, deriva de ±2 px e respiração de opacidade (23/29/37/17 s), ~8 fps, pausa sem foco.

## Material (vidro)
Só nas camadas funcionais sobre o conteúdo: busca, botões flutuantes, painel inferior, navegação, filtros e a faixa de dados do clima. Sem vidro sobre vidro.
Resposta: luz especular segue o ponteiro (`--mx/--my`, uma escrita por frame), cede na pressão (mola) e ganha anel de sinal no foco.
