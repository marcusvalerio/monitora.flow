import "./novidade.css";
import TempoNovo from "./TempoNovo";

export const metadata = { title: "Novidades — Monitora" };

/** O que mudou nesta rodada (correções já ativas no app todo) — para avaliar junto com a prévia abaixo. */
const MUDANCAS = [
  { t: "Clima abre na hora", d: "A última previsão do local fica guardada no aparelho (até 3 h). A tela e o cartão da Home aparecem já com ela e trocam quando a rede responder." },
  { t: "Sem piscar a cada 10 min", d: "A atualização automática do Clima não volta mais para o esqueleto de carregamento; se a rede falhar, mantém a previsão anterior." },
  { t: "Cache compartilhado da previsão", d: "As coordenadas vão arredondadas (~1 km) para /tempo: pessoas no mesmo bairro reaproveitam a mesma resposta do servidor." },
  { t: "Fontes sem bloqueio", d: "Geist e Sora agora são servidas pelo próprio app (next/font), sem esperar o CSS do Google para desenhar a tela." },
  { t: "Offline abria a tela errada", d: "O service worker guardava toda página como \"/\": sem rede, abrir /clima mostrava a Home. Agora cada tela tem sua cópia." },
  { t: "Relógio do céu", d: "A marca de 12 h depois (embaixo do anel) ficava por cima da máxima/mínima no centro; foi retirada. Semana e fita não quebram mais sem temperatura." },
];

export default function Novidade() {
  return (
    <main className="page nv">
      <span className="t-label">Em avaliação</span>
      <h1 className="t-hero" style={{ margin: "8px 0 4px" }}>Novidades</h1>
      <p className="t-body muted" style={{ margin: 0 }}>O que já mudou e uma prévia da nova página do tempo. Nada aqui substitui a aba Clima até ser aprovado.</p>

      <details className="nv-mudancas">
        <summary>Correções já ativas ({MUDANCAS.length})</summary>
        <ul>{MUDANCAS.map((m) => <li key={m.t}><b>{m.t}</b><span>{m.d}</span></li>)}</ul>
      </details>

      <TempoNovo />
    </main>
  );
}
