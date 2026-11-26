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
1. **Estrutura em 3 abas:** **Agora** (Início + Clima, grade de horas como peça central), **Atenção** (estágio, chuva medida por região,
   alagamentos, alertas — cara de boletim) e **Trajeto** (chegada com número grande e confiança do dado).
2. **Estilo visual:** o dono vai escolher entre 4 propostas (nome, símbolo, paleta, tipografia). Aplicar o escolhido via tokens
   (`app/ui/tokens.ts` + variáveis em `app/globals.css`) — não espalhar cor solta.
3. **Design system:** trazer raios, espaçamentos e tamanhos de fonte avulsos de volta aos tokens (`--r-*`, `--sp-*`, `.t-*`); hoje há ~38 hex soltos.
4. **Mapa:** estado do veículo por forma/ícone além da cor; fallback sem tiles com linhas de BRT.
5. **Atenção completa:** alagamentos do COR por rua, interdições, push (dados mínimos: assinatura push, parada, linha, expira em 90 min; sem IP, apaga ao expirar), alerta em áudio.
6. **Clima:** radar do Alerta Rio, Níveis de Calor do COR, ressaca, avisos INMET; fixar `models=` no Open-Meteo e dizer qual na tela.
7. **Dados:** ETA em linha reta pelo shape e só no sentido certo; GTFS-RT da SMTR com cache compartilhado em vez da memória por instância (`aoVivo.ts`);
   coleta agendada se o "habitual" continuar (hoje a amostra é enviesada pela coleta sob demanda); cobertura de Av. Brasil, Linha Amarela, Ponte e Zona Oeste (custo de banco).
8. **Grade de horas:** rolagem sincronizada entre os dias; chuva medida na hora que já passou.
