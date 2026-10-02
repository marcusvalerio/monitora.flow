import { PONTOS } from "../../src/config/pontos";
import { PARAMETROS } from "../../src/lib/parametros";
import { ok } from "../../src/lib/api";

export function GET() {
  return ok({ raioPadraoM: PARAMETROS.RAIO_PADRAO_M, parametros: PARAMETROS, pontos: PONTOS });
}
