import type { Compromisso, Dia, Viagem } from './types'

const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3))

/** Pendências que dependem só do texto livre do dia. */
function doTexto(d: Dia): string[] {
  const conteudo = [d.programa, d.detalhes].filter(Boolean).join('\n')
  if (!conteudo && d.compromissos.length === 0) return ['Dia sem programa']
  return /\?|\bou\b/i.test(conteudo) ? ['Decisão em aberto'] : []
}

/** Pendências de um compromisso isolado. */
export function doCompromisso(c: Compromisso): string[] {
  const p: string[] = []
  const exigeResposta = c.tipo === 'restaurante' || c.tipo === 'ingresso'
  if (exigeResposta && (!c.reserva || c.reserva === 'a-decidir')) p.push('Reserva a decidir')
  if (c.tipo === 'ingresso' && c.reserva === 'nao') p.push('Ingresso não comprado')
  if (c.reserva === 'sim' && !c.codigo) p.push('Reserva sem código')
  if (c.fechado) p.push('Lugar fechado neste dia')
  else if (c.hora && (c.abre || c.fecha)) {
    const ini = min(c.hora)
    const fim = ini + (c.duracaoMin ?? 0)
    if ((c.abre && ini < min(c.abre)) || (c.fecha && fim > min(c.fecha))) p.push('Fora do horário de funcionamento')
  }
  return p
}

/** Conflitos entre compromissos com horário no mesmo dia. */
export function conflitos(cs: Compromisso[]): string[] {
  const comHora = cs.filter((c) => c.hora).sort((a, b) => a.hora!.localeCompare(b.hora!))
  const p = new Set<string>()
  for (let i = 1; i < comHora.length; i++) {
    const ant = comHora[i - 1]
    const atual = comHora[i]
    // Um voo ou trem ocupa até a chegada; chegada menor que a partida é no dia seguinte.
    const fimAnt = ant.chegada && ant.chegada > ant.hora! ? min(ant.chegada) : min(ant.hora!) + (ant.duracaoMin ?? 0)
    const folga = min(atual.hora!) - fimAnt
    if (folga < 0) p.add('Compromissos sobrepostos')
    else if (atual.trajetoMin && folga < atual.trajetoMin) p.add('Trajeto não cabe entre dois compromissos')
  }
  return [...p]
}

export function pendenciasDoDia(d: Dia, v: Viagem): string[] {
  const hotel = (v.hospedagens ?? []).find((h) => h.checkin === d.data)
  return [...new Set([
    ...doTexto(d),
    ...(hotel && !hotel.endereco ? ['Hotel sem endereço'] : []),
    ...d.compromissos.flatMap(doCompromisso),
    ...conflitos(d.compromissos),
  ])]
}

/** Recalcula as pendências de todos os dias. */
export function recalcular(v: Viagem): Viagem {
  for (const d of v.dias) d.pendencias = pendenciasDoDia(d, v)
  return v
}
