# Pendências e evolução — dados meteorológicos do Rio de Janeiro

**Escopo:** melhorar fontes, qualidade, cobertura, atualização e interpretação dos dados. O design e a identidade visual do Monitora Flow ficam fora do escopo.

## Princípios
- Cobertura principal: município do Rio de Janeiro, com leitura distribuída por regiões e estações.
- Diferenciar sempre observação medida, previsão de modelo e aviso oficial.
- Preservar a origem, o horário de medição/validade e a idade de cada dado.
- Não apresentar ausência de dado como zero, nem previsão como observação.
- Não introduzir scraping frágil, contornar autenticação ou depender de endpoints não documentados em produção.
- Implementar e validar em branch; não publicar nem integrar em `main` sem autorização específica.

## Inventário confirmado no código
| Fonte | Situação atual | Observação |
|---|---|---|
| Alerta Rio — chuva observada | Integrada em `src/lib/chuva.ts` e `/chuva` | XML público `Chuvas.xml`; acumulados por estação em 5/10/15 min, 1/4/24/96 h e mês. A API seleciona os pluviômetros próximos. |
| Open-Meteo — previsão | Integrada em `src/lib/tempo.ts` e `src/lib/tempoCompleto.ts` | Previsão numérica, não observação. Inclui condições atuais do modelo, previsão horária/diária, precipitação, vento, UV e qualidade do ar. |
| Alerta Rio — variáveis meteorológicas completas | A investigar | A rede municipal tem 33 estações: 26 pluviométricas, cinco com chuva/temperatura/umidade e duas completas (Guaratiba e São Cristóvão) com chuva, vento, temperatura, umidade e pressão. O XML já integrado é o feed de chuva; não assumir que contém todas essas variáveis. |
| INMET — avisos | Público no portal; integração técnica pendente | O portal oficial publica avisos por dia em horizonte de até cinco dias. Validar feed/endereço oficial, formato, abrangência municipal, severidade, início/fim e cancelamento antes de integrar. |
| INMET — observações de estações | Pendente | Serviço oficial informa dados horários e janela recente de 90 dias. Avaliar cobertura de estações no município, atraso, UTC, qualidade e forma de acesso autorizada. |
| Google Weather API | Em espera | Não integrar em produção até esclarecer condições de uso para produto que inclui informações meteorológicas. |
| Radar/satélite municipal | Em investigação | Avaliar produtos oficiais da Plataforma Clima/COR, disponibilidade, resolução, atualização e condições de reutilização. |

## Problemas já identificados
1. **Melhor horário para sair:** a seleção atual podia escolher a hora em andamento, mesmo que ela já tivesse começado. A lógica deve escolher apenas janelas de duas horas cujo início seja futuro e cujas duas horas estejam representadas.
2. **Chuva observada vs. prevista:** o texto “sem chuva prevista” vem do modelo Open-Meteo e não significa que não esteja chovendo no município. A medição dos pluviômetros precisa permanecer semanticamente separada.
3. **Horário de atualização:** o carimbo de recepção/cache da aplicação não deve ser confundido com o horário de geração ou medição da fonte.
4. **Rajada atual vs. máxima diária:** manter os períodos claramente distintos; não tratar diferença entre eles como contradição.
5. **Cobertura da Home vs. Clima:** divergência de temperaturas observada em telas ainda precisa de rastreamento das chamadas e parâmetros de cada módulo.

## Plano de trabalho
### Prioridade 1 — confiabilidade sem novas credenciais
- [ ] Corrigir e testar a seleção de melhor janela futura.
- [ ] Inspecionar a rede Alerta Rio e identificar feed oficial para variáveis meteorológicas completas.
- [ ] Mapear estações e variáveis disponíveis por região do município.
- [ ] Validar idade e completude das observações; sinalizar estação indisponível/desatualizada.
- [ ] Rastrear fontes, coordenadas, timestamps e cache da Home e da tela Clima.

### Prioridade 2 — avisos e fontes públicas
- [ ] Validar acesso automatizado e estável aos avisos INMET (fonte oficial).
- [ ] Definir normalização de área afetada, severidade, fenômeno, validade, atualização e cancelamento.
- [ ] Avaliar dados horários do INMET e cobertura no município do Rio.
- [ ] Avaliar radar/satélite público da Prefeitura/COR.

### Prioridade 3 — validação e operação
- [ ] Criar fixtures anonimizadas/reproduzíveis das fontes.
- [ ] Testar fuso `America/Sao_Paulo`, UTC, horário de verão histórico e campos ausentes.
- [ ] Comparar observações locais e previsão sem misturar as duas categorias.
- [ ] Documentar limites, atribuição, licença, cadência e política de cache por fonte.
- [ ] Só depois propor mudanças de interface, se indispensáveis — fora do escopo atual.

## Referências técnicas
- Alerta Rio — rede e descrição das estações: https://www.sistema-alerta-rio.com.br/institucional/quem-somos/
- COR.Rio — FAQ da rede: https://cor.rio/faq/
- Prefeitura — camada geográfica das estações: https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Geotecnia/Estacoes_AlertaRio/FeatureServer/0
- INMET — avisos oficiais: https://alertas2.inmet.gov.br/
- INMET — serviço de estações automáticas: https://portal.inmet.gov.br/servicos/esta%C3%A7%C3%B5es-autom%C3%A1ticas
- Open-Meteo: https://open-meteo.com/

## Histórico desta pasta
- Criada na branch `feat/clima-dados-rio` para centralizar descobertas, pendências e critérios de validação.
