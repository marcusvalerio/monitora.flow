import { AVISO } from "../../src/lib/parametros";

export const metadata = { title: "API — monitora.flow" };

export default function Docs() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 40px" }}>
      <h1>monitora.flow</h1>
      <p>Coletor + API do GPS dos BRTs e ônibus municipais do Rio (SMTR), para consumo pelo MOVA.</p>
      <p><strong>Aviso:</strong> {AVISO}</p>
      <p><a href="/">← Meu trajeto</a> · <a href="/openapi">OpenAPI (JSON)</a></p>
      <ul>
        <li><a href="/pontos">/pontos</a> — pontos configurados e parâmetros</li>
        <li><a href="/agora?lat=-23.000556&amp;lng=-43.334167&amp;raio=400">/agora?lat=&amp;lng=&amp;raio=</a> ou <a href="/agora?ponto=americas-2000">/agora?ponto=americas-2000</a></li>
        <li><a href="/linhas/22/veiculos">/linhas/22/veiculos</a> · <a href="/chegada?linha=22&amp;lat=-23.000556&amp;lng=-43.334167">/chegada?linha=&amp;lat=&amp;lng=</a> (estimativa experimental)</li>
        <li><a href="/chuva?lat=-22.97&amp;lng=-43.22">/chuva?lat=&amp;lng=</a> (Alerta Rio) · <a href="/tempo?lat=-22.97&amp;lng=-43.22">/tempo?lat=&amp;lng=</a> (Open-Meteo)</li>
        <li><a href="/geocodificar?q=Avenida%20das%20Am%C3%A9ricas%202000">/geocodificar?q=</a> · <a href="/ocorrencias">/ocorrencias</a> (sem fonte aberta ainda)</li>
        <li><a href="/historico?ponto=americas-2000">/historico?ponto=americas-2000&amp;de=&amp;ate=</a></li>
        <li><a href="/habitual?ponto=americas-2000">/habitual?ponto=americas-2000&amp;diaSemana=&amp;hora=</a></li>
      </ul>
      <p>Metodologia e fontes: ver <code>docs/</code> no repositório.</p>
    </main>
  );
}
