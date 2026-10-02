import { AVISO } from "../src/lib/parametros";

export default function Home() {
  return (
    <main>
      <h1>monitora.flow</h1>
      <p>Coletor + API do GPS dos BRTs e ônibus municipais do Rio (SMTR), para consumo pelo MOVA.</p>
      <p><strong>Aviso:</strong> {AVISO}</p>
      <ul>
        <li><a href="/pontos">/pontos</a> — pontos configurados e parâmetros</li>
        <li><code>/now?lat=-23.000556&amp;lng=-43.334167&amp;raio=400</code> ou <a href="/now?ponto=americas-2000">/now?ponto=americas-2000</a></li>
        <li><a href="/historico?ponto=americas-2000">/historico?ponto=americas-2000&amp;de=&amp;ate=</a></li>
        <li><a href="/habitual?ponto=americas-2000">/habitual?ponto=americas-2000&amp;diaSemana=&amp;hora=</a></li>
      </ul>
      <p>Metodologia e fontes: ver <code>docs/</code> no repositório.</p>
    </main>
  );
}
