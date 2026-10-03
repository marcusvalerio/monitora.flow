# Monitora — sistema visual 5.0

**Espaço:** mundo (mapa) embaixo · material (vidro) no meio · informação (tipografia) em cima.
**Ordem:** conteúdo → material → movimento. Cor comunica estado; a interface é neutra.

## Marca
- **"Lente":** dois arcos deitados que afinam nas pontas formam uma pálpebra aberta (observar); quatro colchetes por fora,
  em cima e embaixo, enquadram a cidade. Simétrica nos dois eixos, sem ponto central. Caminhos em `MARCA_CAMINHOS`
  (`app/ui/Geometria.tsx`), viewBox 120, `currentColor`. Colchetes engrossados e afastados dos arcos para ler em 16–20 px.
- **Ícone do app:** fundo `#2C42C2`, cantos `rx=27` (viewBox 120), marca branca em escala 0,8 centralizada (`public/icone.svg`).
  PNG: `icone-512-arredondado.png`, `apple-touch-icon.png` (quadrado, o sistema arredonda), `favicon-32.png`;
  *maskable* `icone-192.png` / `icone-512.png` com a marca em escala 0,6 (margem segura de 20%).

## Cor (`app/ui/tokens.ts` = fonte; espelhada em `app/globals.css`)
| Token | Hex | Papel |
|---|---|---|
| Porcelain / Warm White / Mist | `#F5F5F2` `#FBFBF9` `#E7E9E8` | fundo, superfícies, divisões (maior parte da interface) |
| Ink / Deep Ink | `#111318` `#080A10` | texto, BRT, modo escuro |
| Ultramarine | `#3047C7` | **interação e seleção**: aba ativa, botão, rota ativa, veículo selecionado |
| Periwinkle / Lilac | `#8997F5` `#C7C8F5` | atmosfera e estados brandos (posição incerta, veículo andando, clima) |
| Coral | `#FF7058` | **só** incidente/alerta, veículo fora do trajeto e o clarão da tempestade |
| Sea Mist | `#B9D7D6` | água do mapa (com profundidade tonal) |

Estados do veículo (fixos em todo o produto): no trajeto = Ultramarine · incerto = Periwinkle · fora = Coral · sem atualização = cinza.
Modos: BRT = cápsula Ink sólida; ônibus = cápsula clara com contorno Ink.

## Tipografia
**Geist** conduz a interface (navegação, rótulos, corpo, controles, metadados). **Sora 600** só onde o número é o objeto:
ETA, temperatura, totais do Monitor, métricas, títulos de impacto. Ex.: "2" em Sora 600 72 px + "min" em Geist 500 20 px.
Rótulos do mapa usam Noto Sans (as fontes do mapa precisam vir como glifos PBF; gerar Geist em PBF fica como próximo passo).

## Material (vidro)
Só em busca, botões flutuantes, navegação, painel e filtros — nunca em cards nem vidro sobre vidro.
Translucidez + blur + saturação + luz especular que segue o ponteiro + borda interna clara + sombra ambiente.
**Responde ao ambiente:** o mapa informa o que está sob a busca (`data-sob` = água / rota / terra) e o vidro ganha uma influência mínima
de Sea Mist ou Ultramarine — nunca altera a cor do texto.

## Movimento (`--dur-*`, `--spring` no CSS; `app/ui/motion.ts` no JS)
Micro 100–180 ms · Interação 180–350 ms · Espacial 350–600 ms · Ambiente 4–20 s+. Mola criticamente amortecida, sem bounce.
- **Navegação:** um indicador Ultramarine único desliza entre as abas (mola) — continuidade, não troca de botão.
- **Telas:** cada rota entra com fade; o mapa "surge" (opacidade + 1,5% de escala); a busca sobe como folha.
- **ETA:** troca vertical (3 → 2: o antigo sobe, o novo entra) só quando o valor muda; ponto "ao vivo" pulsa só com dado novo.
- **Rota:** fluxo discreto no sentido da viagem (troca de traço ~9 fps, pausa sem foco); rota do veículo selecionado engrossa.
- **Veículo:** interpolação no ritmo do GPS terminando no dado real; rotação pelo menor caminho; parado não gira; STALE/OFF_ROUTE nunca suavizados.
- **Água:** textura e luz quase imperceptíveis (períodos 17–37 s).
`prefers-reduced-motion` zera durações e remove partículas.

## Contraste (WCAG)
Texto 17:1 · secundário 8,1:1 · terciário 5,3:1 (4,7:1 sobre Mist) · branco/Ultramarine 7,4:1 · escuro: terciário 6,4:1, aba 7,4:1.
