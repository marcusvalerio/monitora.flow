import Link from "next/link";
import { ChevronRight, Code2, Database, ShieldCheck, TriangleAlert, Info } from "lucide-react";

export const metadata = { title: "Mais — Monitora" };

const FONTES = [
  { nome: "GPS do BRT e dos ônibus municipais", quem: "SMTR / Prefeitura do Rio", tipo: "Medido, ao vivo", url: "https://dados.mobilidade.rio/gps/brt" },
  { nome: "Estações e terminais do BRT", quem: "Data.Rio / IPP", tipo: "Catálogo oficial", url: "https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Hosted/Esta%C3%A7%C3%B5es_BRT/FeatureServer/0" },
  { nome: "Paradas de ônibus", quem: "Prefeitura do Rio", tipo: "Catálogo (2024)", url: "https://raw.githubusercontent.com/prefeitura-rio/storage/master/layers/paradas_onibus.geojson" },
  { nome: "Chuva medida (pluviômetros)", quem: "Alerta Rio / COR", tipo: "Medido, ~5 min", url: "https://alertario.rio.rj.gov.br/upload/xml/Chuvas.xml" },
  { nome: "Previsão do tempo", quem: "Open-Meteo (CC BY 4.0)", tipo: "Modelo numérico", url: "https://open-meteo.com" },
  { nome: "Endereços e bairros", quem: "IPP / Prefeitura do Rio", tipo: "Geocodificação", url: "https://pgeo3.rio.rj.gov.br" },
  { nome: "Mapa", quem: "© OpenStreetMap (OpenFreeMap)", tipo: "Base cartográfica", url: "https://openfreemap.org" },
];

export default function Mais() {
  return (
    <main className="page">
      <h1 className="t-hero" style={{ margin: "8px 0 4px" }}>Mais</h1>
      <p className="t-body muted" style={{ margin: 0 }}>Transparência sobre os dados e como os números são calculados.</p>

      <section className="section" aria-labelledby="ocor">
        <span className="t-label" id="ocor">Ocorrências</span>
        <div className="notice">
          <TriangleAlert className="sev-atencao" aria-hidden />
          <div><div className="t-head">Ainda sem fonte aberta ao vivo</div>
            <div className="t-cap">A API pública de ocorrências do COR está fora do ar. Preferimos não mostrar nada a inventar dados. A área está pronta para receber a fonte quando ela estiver disponível.</div></div>
        </div>
      </section>

      <section className="section" aria-labelledby="sobre">
        <span className="t-label" id="sobre">Sobre os dados</span>
        <div className="surface" style={{ padding: "16px 18px" }}>
          <Bloco t="Chegada estimada">A previsão de chegada é uma estimativa calculada pelo Monitora (distância em linha reta e velocidade de aproximação observada entre leituras de GPS). Não representa um horário oficial da operação.</Bloco>
          <Bloco t="Direção dos veículos">A seta usa o rumo informado pelo GPS do próprio veículo. Quando a fonte não informa, calculamos pelo deslocamento real (mínimo de 30 m). Sem informação suficiente, o veículo aparece sem seta — nunca inventamos uma direção.</Bloco>
          <Bloco t="Velocidade na região">É a velocidade média dos ônibus e BRTs que passaram perto. Eles param em estações e usam faixas exclusivas: é um indicador indireto, não a velocidade dos carros nem a contagem de veículos.</Bloco>
          <Bloco t="Linhas de uma estação">Mostramos as linhas cujos veículos tiveram GPS perto do ponto na última hora. Não é a lista oficial da operação.</Bloco>
          <Bloco t="Clima" ultimo>Temperatura, vento e previsão vêm de modelo numérico (Open-Meteo). A chuva medida vem dos pluviômetros do Alerta Rio e só aparece no Rio.</Bloco>
        </div>
      </section>

      <section className="section" aria-labelledby="fontes">
        <span className="t-label" id="fontes">Fontes</span>
        <ul className="list surface" style={{ padding: "0 16px" }}>
          {FONTES.map((f) => (
            <li key={f.nome}><a className="list-item" href={f.url} target="_blank" rel="noreferrer">
              <span className="ico"><Database aria-hidden /></span>
              <span className="main"><div className="t-head">{f.nome}</div><div className="t-cap">{f.quem} · {f.tipo}</div></span>
            </a></li>
          ))}
        </ul>
      </section>

      <section className="section">
        <ul className="list surface" style={{ padding: "0 16px" }}>
          <li><Link className="list-item" href="/docs"><span className="ico"><Code2 aria-hidden /></span>
            <span className="main"><div className="t-head">API e metodologia completa</div><div className="t-cap">Endpoints, fórmulas e limitações</div></span><ChevronRight aria-hidden /></Link></li>
          <li><div className="list-item"><span className="ico"><ShieldCheck aria-hidden /></span>
            <span className="main"><div className="t-head">Privacidade</div><div className="t-cap">Sem cadastro. Locais e estações recentes ficam só neste aparelho. Placas dos veículos são descartadas.</div></span></div></li>
        </ul>
      </section>
      <p className="t-meta" style={{ margin: "20px 4px" }}><Info size={12} aria-hidden style={{ verticalAlign: "-2px" }} /> Monitora · dados abertos do Rio de Janeiro</p>
    </main>
  );
}

function Bloco({ t, children, ultimo }: { t: string; children: React.ReactNode; ultimo?: boolean }) {
  return (
    <div style={{ paddingBottom: ultimo ? 0 : 14, marginBottom: ultimo ? 0 : 14, borderBottom: ultimo ? 0 : "1px solid var(--border)" }}>
      <div className="t-head">{t}</div>
      <div className="t-cap" style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}
