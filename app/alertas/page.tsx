import "../novidade/novidade.css";
import OcorrenciasPerto from "./OcorrenciasPerto";

export const metadata = { title: "Ocorrências — Monitora" };

export default function Alertas() {
  return (
    <main className="page">
      <h1 className="t-hero" style={{ margin: "8px 0 8px" }}>Ocorrências</h1>
      <OcorrenciasPerto />
    </main>
  );
}
