# Reformulação — passagem de trabalho

Branch: `claude/charming-rubin-6s4s29`. Tudo abaixo marcado como **feito** já está commitado nele.

## Contexto
Uma banca avaliou o app (diretor de arte, designer de produto, designer de UX, motion designer, meteorologista,
especialista em mobilidade/dados e 4 motoboys — estes últimos como **simulação de perfis**, não entrevista real).
Notas de 2 a 7. Consenso: base técnica e honestidade boas; Início vazia; "chega em X min" sem confiança declarada;
app serve para "antes de sair", não para quem está na rua.

**Regra do dono para a identidade:** o traço carioca fica **só no mapa e na marca**, nunca nos dados.
Números, alertas, estágio e chuva seguem padrão de painel de operação (fundo neutro, número grande, fonte e horário ao lado).
Teste: tirando cor e marca, uma tela de Atenção tem que parecer um boletim da Defesa Civil.

Nome da seção de alertas: **Atenção** (a notificação push em si é um "alerta"). Não usar "rádio do motoboy".

## Feito
- **Chegada** (`app/mobilidade/MobilidadeApp.tsx` `mesclarChegadas`/`corrigirIdade`, `app/ui/Home.tsx`):
  desconta a idade do GPS; descarta GPS > 5 min e ETA > 60 min; mostra método, idade do GPS e "pode variar ±25%".
  A margem ±25% é escolha nossa — **calibrar com dados reais**.
- **Clima** (`app/clima/TempoNovo.tsx`, `src/lib/chuva.ts`, `src/lib/tempoCompleto.ts`):
  sem horário exato de início de chuva ("o modelo indica chance nas próximas 2 h");
  `intensidadeChuva()` pela escala do Alerta Rio (fraca ≤5, moderada ≤25, forte ≤50, muito forte >50 mm/h) —
  **confirmar no boletim oficial**; 3 pluviômetros (mostra o maior), 24/96 h e hora da medição; volume previsto com ressalva.
- **Grade hora a hora** (`GradeHoras` em `TempoNovo.tsx`, CSS seção 17 de `globals.css`): uma fileira por dia, cartão por hora,
  "nível d'água" = chance de chuva, seta do vento (hourly `wind_direction_10m`), toque abre o detalhe. 4 dias de horas.
- **Início**: abre com o Centro do Rio quando não há local salvo; link "Atenção: operação da cidade".
- **Contraste**: `--alert-text #B23A27`, `--stale-text #8A5A12`, `--calm-text #4C5BC9` (AA); `COR_TEXTO` em `tokens.ts`;
  STALE `#7E838B`; rótulos da barra 11,5 px; link com 44 px.
- **Movimento**: keyframes duplicados renomeados (`navSobe`, `navVeu`); atmosfera pausa fora da tela/aba oculta;
  barra da viagem só em transform; overflow horizontal da Início corrigido (`html{overflow-x:clip}`).
- Teste novo de `intensidadeChuva` em `tests/fontes.test.ts`. 122 testes passando.

## A fazer (reformulação)
1. **Estrutura em 4 abas** (decisão do dono): **Agora** (resumo: uma linha/cartão de cada assunto — estágio, temperatura e chance de chuva,
   próximo ônibus, alerta se houver — cada um leva à aba completa), **Tempo** (previsão completa: céu de agora, grade hora a hora como peça central,
   chuva em 2 h, 7 dias, vento, UV, ar, sol, satélite e depois radar), **Atenção** (estágio, chuva medida por região, alagamentos, calor, botão de alertas —
   cara de boletim) e **Trajeto** (mapa, estação, chegada com número grande e confiança do dado). Regra: o Agora só resume; o detalhe vive em uma aba só.
   Menu (Sobre os dados, Monitor, ajustes) vira ícone no canto superior, fora da barra.
2. **Estilo visual:** o dono vai escolher entre 4 propostas (nome, símbolo, paleta, tipografia). Aplicar o escolhido via tokens
   (`app/ui/tokens.ts` + variáveis em `app/globals.css`) — não espalhar cor solta.
3. **Design system:** trazer raios, espaçamentos e tamanhos de fonte avulsos de volta aos tokens (`--r-*`, `--sp-*`, `.t-*`); hoje há ~38 hex soltos.
4. **Mapa:** estado do veículo por forma/ícone além da cor; fallback sem tiles com linhas de BRT.
5. **Atenção completa:** alagamentos do COR por rua, interdições, push (dados mínimos: assinatura push, parada, linha, expira em 90 min; sem IP, apaga ao expirar), alerta em áudio.
6. **Clima:** radar do Alerta Rio, Níveis de Calor do COR, ressaca, avisos INMET; fixar `models=` no Open-Meteo e dizer qual na tela.
7. **Dados:** ETA em linha reta pelo shape e só no sentido certo; GTFS-RT da SMTR com cache compartilhado em vez da memória por instância (`aoVivo.ts`);
   coleta agendada se o "habitual" continuar (hoje a amostra é enviesada pela coleta sob demanda); cobertura de Av. Brasil, Linha Amarela, Ponte e Zona Oeste (custo de banco).
8. **Grade de horas:** rolagem sincronizada entre os dias; chuva medida na hora que já passou.

## Decisões de identidade (26/11)
Canvas com tudo: https://claude.ai/artifact/R47LCHZLU8LEnNtELYucwM
Cópias das pranchas aprovadas (HTML de referência, com SVG e keyframes exatos) em `docs/reformulacao/`:
`Fusao` (estilo e telas), `Simbolo2` (símbolo C · Pálpebra), `Abertura` (olho piscando), `Movimento` (microinterações).
As pranchas usam Familjen Grotesk em títulos: ignorar, vale a seção Tipografia.
- **Estilo:** fusão dos estilos 1 (Boletim) e 4 (Calçadão), prancha "Fusão 1 + 4". Nome **Monitora**.
  Fundo papel `#FAF9F6`, superfície `#FFFFFF`, tinta `#0E1014`, texto 2 `#545A66`, linhas `#E6E3DC`,
  toque ultramarino `#3047C7`, alerta `#B23A27` (fundo `#F8E9E5`), chuva `#C3D4F0`.
  Tipografia: ver seção Tipografia (Sora nos títulos principais, Inter Tight nos números, Inter no resto). Dados com linhas finas de tabela.
- **Símbolo:** conceito **C · Pálpebra** (prancha "Símbolo, rodada 2"), em 120×120:
  pálpebra de cima `M14 62 A46 46 0 0 1 106 62 L90 62 A30 30 0 0 0 30 62 Z`,
  base `M30 66 A30 30 0 0 0 90 66 Z`, pupila `circle cx=60 cy=64 r=15` com `mix-blend-mode: multiply`.
  Cores: no azul = branco / lilás `#C7C8F5` / tinta; no papel = lilás / ultramarino / tinta.
  Em ≤ 32 px usar a versão de fresta maior (prancha "Abertura", último quadro). Substitui `public/icone*.png`, `icone.svg` e `MarcaMonitora`.
- **Abertura:** o olho abre, pisca uma vez e o nome entra (1,6 s, só transform/opacidade, toca uma vez,
  não segura o carregamento; com reduzir movimento, olho já aberto). Keyframes na prancha "Abertura".

## Movimento (26/11)
Regra: o movimento mostra o que aconteceu com o dado; ornamento só na marca. Só transform/opacidade, pausa fora da tela/aba oculta,
entrada total < 0,7 s (stagger ≤ 6 itens), nada em loop na Atenção, "reduzir movimento" desliga também em JS (versão estática).
Prancha "Movimento" no canvas tem as peças rodando.
- **Assinatura = o olho piscando:** abertura (abre, pisca, nome entra; 1,6 s; uma vez); carregando = piscada lenta (substitui `Orbita`);
  dado atualizado = piscada curta do ícone no topo (substitui `pulsoDado`).
- **Agora:** cartões em cascata curta; números rolam ao mudar (`NumeroRolante`, já existe).
- **Tempo:** na grade, a "água" sobe até a chance de chuva quando a fileira entra na tela (`.gh-agua` scaleY, 600 ms, atraso 30 ms por cartão);
  detalhe da hora abre deslizando; céu animado pausa fora da tela (já feito).
- **Atenção:** item novo entra com fundo destacado que some em 2 s; estágio ≥ 3 pisca uma vez. Nada em loop.
- **Trajeto:** veículo desliza até a posição real (já existe, `duracaoVeiculo`); minutos rolam para baixo; "Saia agora" com um pulso único.
- **Barra:** indicador desliza (já existe) + pequeno salto do ícone ativo. Toque: escala .96 (já existe).
- **Fora:** paralaxe, rolagem presa, fundos animados atrás de dados, brilhos decorativos.

## Tipografia (26/11)
| Nível | Fonte |
|---|---|
| Título principal ("Bom dia", "Tempo", "Atenção") | **Sora 700**, 34–44 px, tracking −0,045em |
| Números e dados (28°, 7 min, 14,6 mm, 85%) | **Inter Tight 600–700**, `font-variant-numeric: tabular-nums` (decisão do dono) |
| Título de seção | **Inter 600** |
| Texto | **Inter 400–500** |
| Rótulos miúdos | **Inter 500**, 12–13 px |
A fonte própria de números (estudo "Cifra" no canvas) foi descartada. Familjen Grotesk também sai.
Hoje os números usam Sora (`--font-num`): trocar para Inter Tight e manter o ajuste de corte do `.rolante`.

## Aplicado (26/11, branch `claude/confident-goodall-t8pz1l`)
1. Tokens: paleta Fusão 1 + 4 em `globals.css`/`tokens.ts`; Sora 700 (título), Inter Tight (números, `--font-num`), Inter (resto; Geist saiu).
2. Símbolo C · Pálpebra em `MarcaMonitora` (fresta maior ≤ 32 px), `public/icone.svg` e PNGs refeitos; `OlhoCarregando` substitui `Orbita`.
3. 4 abas: Agora (`/`), Tempo (`/clima`, abre com o Centro sem local salvo), Atenção (`/atencao`, nova), Trajeto (`/mobilidade`).
   Menu e olho no canto superior. O botão "Avisar quando chover forte aqui" fica desligado e diz que ainda não existe (push de chuva = item 5).
4. Abertura (`app/ui/Abertura.tsx`, uma vez por sessão; `?sem-abertura` pula), piscada curta no dado novo, água da grade, cascata,
   item novo/estágio ≥ 3 na Atenção, pulso do "Saia agora", salto do ícone da barra.
Prints (dados reais; ocorrências do COR estavam fora): `docs/reformulacao/prints/`.
