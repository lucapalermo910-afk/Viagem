/**
 * Estimativa de trajeto por distância em linha reta.
 * É uma aproximação grosseira: não conhece linhas, baldeações nem horários.
 * Os parâmetros abaixo são premissas, não medições.
 */
export interface Ponto { lat: number; lon: number }
export interface Estimativa { min: number; km: number; modo: 'a pé' | 'transporte' }

/** O caminho real é mais longo que a linha reta. */
export const FATOR_DESVIO = 1.3
/** Até esta distância (já com desvio) assume-se caminhada. */
export const LIMITE_A_PE_KM = 1.5
export const VELOCIDADE_A_PE_KMH = 4.5
/** Tempo fixo de transporte: andar até a estação e esperar. */
export const FIXO_TRANSPORTE_MIN = 12
export const VELOCIDADE_TRANSPORTE_KMH = 25
/** Acima disto é viagem entre cidades e a estimativa não vale. */
export const LIMITE_KM = 40
/** Margem somada ao trajeto para calcular a hora de sair. */
export const FOLGA_MIN = 10

export function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

/** Devolve null quando o destino está longe demais para estimar. */
export function estimar(retaKm: number): Estimativa | null {
  const km = retaKm * FATOR_DESVIO
  if (km > LIMITE_KM) return null
  const aPe = km <= LIMITE_A_PE_KM
  const bruto = aPe
    ? (km / VELOCIDADE_A_PE_KMH) * 60
    : FIXO_TRANSPORTE_MIN + (km / VELOCIDADE_TRANSPORTE_KMH) * 60
  return { min: Math.max(5, Math.ceil(bruto / 5) * 5), km, modo: aPe ? 'a pé' : 'transporte' }
}
