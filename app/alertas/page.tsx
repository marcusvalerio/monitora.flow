import "../novidade/novidade.css";
import OcorrenciasPerto from "./OcorrenciasPerto";

export const metadata = { title: "Ocorrências — Monitora" };

export default function Alertas() {
  return (
    <main className="page alertas">
      <h1 className="t-hero">Ocorrências</h1>
      <OcorrenciasPerto />
    </main>
  );
}
