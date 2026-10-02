/** Baixa respostas reais e grava amostras em tests/fixtures (placas substituídas). */
import { writeFileSync } from "node:fs";
import { buscarBrt, buscarSppo } from "../src/lib/fontes";

const agora = new Date();
const brt = (await buscarBrt()) as { veiculos: Record<string, unknown>[] };
const sppo = (await buscarSppo(new Date(agora.getTime() - 3 * 60_000), agora)) as unknown[];
const veiculos = brt.veiculos.slice(0, 60).map((v, i) => ({ ...v, placa: `TST${String(i).padStart(4, "0")}` }));
writeFileSync("tests/fixtures/brt.json", JSON.stringify({ veiculos }));
writeFileSync("tests/fixtures/sppo.json", JSON.stringify(sppo.filter((_, i) => i % 80 === 0)));
console.log("capturado em", agora.toISOString(), "— atualize AGORA_FIXTURE nos testes");
