import "../novidade.css";
import Testes from "./Testes";

export const metadata = { title: "Teste do sistema — Monitora" };

export default function Page() {
  return (
    <main className="page">
      <span className="t-label">Em avaliação</span>
      <h1 className="t-hero" style={{ margin: "8px 0 4px" }}>Teste do sistema</h1>
      <p className="t-body muted" style={{ margin: 0 }}>Cada fonte e cada função testadas agora, com o tempo de resposta. Toque em “Testar de novo” quando quiser.</p>
      <Testes />
    </main>
  );
}
