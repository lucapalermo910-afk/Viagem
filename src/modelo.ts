/**
 * Modelo novo da planilha: abas Dias, Compromissos, Hospedagem e Transporte.
 * Aqui ficam só conversões puras entre linhas de planilha e a viagem.
 */
import type { Compromisso, Dia, Hospedagem, Reserva, TipoComp, Viagem } from './types'
import { recalcular } from './pendencias'

export type Celula = unknown
export type Abas = Record<string, Celula[][]>

export const COLUNAS = {
  Dias: ['Data', 'Cidade', 'Programa', 'Notas'],
  Compromissos: ['Data', 'Início', 'Duração (min)', 'Tipo', 'Nome', 'Local', 'Abre', 'Fecha', 'Fechado no dia', 'Trajeto (min)',
    'Reserva', 'Código', 'Nome na reserva', 'Pessoas', 'Pagamento', 'Custo', 'Pago', 'Observações'],
  Hospedagem: ['Hotel', 'Cidade', 'Check-in', 'Hora check-in', 'Check-out', 'Hora check-out', 'Endereço', 'Link', 'Código',
    'Valor total', 'Pago', 'Observações'],
  Transporte: ['Data', 'Tipo', 'De', 'Para', 'Partida', 'Chegada', 'Número', 'Assento', 'Código', 'Terminal', 'Custo', 'Pago', 'Observações'],
} as const
export type NomeAba = keyof typeof COLUNAS
/** Colunas que guardam data ou horário, para quem grava o arquivo. */
export const DATAS = new Set(['Data', 'Check-in', 'Check-out'])
export const HORAS = new Set(['Início', 'Abre', 'Fecha', 'Partida', 'Chegada', 'Hora check-in', 'Hora check-out'])

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const txt = (c: Celula) => (c == null ? '' : String(c).replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').trim())
const num = (c: Celula) => {
  const n = typeof c === 'number' ? c : Number(txt(c).replace(/\./g, '').replace(',', '.'))
  return txt(c) !== '' && isFinite(n) ? n : undefined
}
const sim = (c: Celula) => norm(txt(c)) === 'sim'
const p2 = (n: number) => String(n).padStart(2, '0')

export function dataDe(c: Celula): string | null {
  if (c instanceof Date && !isNaN(c.getTime())) return c.toISOString().slice(0, 10)
  if (typeof c === 'number' && c > 20000 && c < 80000) return new Date(Math.round((c - 25569) * 86400000)).toISOString().slice(0, 10)
  const t = txt(c)
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return br ? `${br[3]}-${p2(Number(br[2]))}-${p2(Number(br[1]))}` : null
}

export function horaDe(c: Celula): string | undefined {
  if (c instanceof Date && !isNaN(c.getTime())) return `${p2(c.getUTCHours())}:${p2(c.getUTCMinutes())}`
  if (typeof c === 'number' && c >= 0 && c < 1) {
    const m = Math.round(c * 1440)
    return `${p2(Math.floor(m / 60) % 24)}:${p2(m % 60)}`
  }
  const m = txt(c).match(/^(\d{1,2})[:hH](\d{2})?/)
  return m && Number(m[1]) < 24 ? `${p2(Number(m[1]))}:${m[2] ?? '00'}` : undefined
}

const TIPOS: Record<string, TipoComp> = {
  passeio: 'passeio', restaurante: 'restaurante', ingresso: 'ingresso', compras: 'compras', livre: 'livre',
  voo: 'voo', trem: 'trem', onibus: 'onibus', outro: 'outro',
}
export const ROTULO_TIPO: Record<TipoComp, string> = {
  passeio: 'Passeio', restaurante: 'Restaurante', ingresso: 'Ingresso', compras: 'Compras', livre: 'Livre',
  voo: 'Voo', trem: 'Trem', onibus: 'Ônibus', outro: 'Outro', checkin: 'Check-in', checkout: 'Check-out',
}
const RESERVAS: Record<string, Reserva> = { sim: 'sim', nao: 'nao', 'nao precisa': 'nao-precisa', 'a decidir': 'a-decidir' }
export const ROTULO_RESERVA: Record<Reserva, string> = { sim: 'Sim', nao: 'Não', 'nao-precisa': 'Não precisa', 'a-decidir': 'A decidir' }
export const TRANSPORTES = new Set<TipoComp>(['voo', 'trem', 'onibus', 'outro'])

/** Onde ir para embarcar: aeroporto, ponto de encontro informado ou a origem. */
export const localTransporte = (c: Pick<Compromisso, 'tipo' | 'de' | 'terminal'>): string | null =>
  c.tipo === 'voo' ? (c.de ? (/^[A-Z]{3}$/.test(c.de) ? `Aeroporto ${c.de}` : c.de) : null) : c.terminal || c.de || null

/** Lê uma aba pelo nome das colunas, em qualquer ordem. */
function registros(linhas: Celula[][] | undefined): Record<string, Celula>[] {
  if (!linhas?.length) return []
  const cab = linhas[0].map((c) => norm(txt(c)))
  return linhas.slice(1)
    .filter((l) => l.some((c) => txt(c) !== ''))
    .map((l) => Object.fromEntries(cab.map((nome, j) => [nome, l[j]])))
}
const limpo = <T extends object>(o: T): T => {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined || o[k] === '') delete o[k]
  return o
}
const somaDias = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)

export const ehModeloNovo = (abas: Abas) => 'Compromissos' in abas || 'Hospedagem' in abas || 'Transporte' in abas

export function abasParaViagem(abas: Abas): Viagem {
  const porDia = new Map<string, Compromisso[]>()
  const por = (data: string) => porDia.get(data) ?? porDia.set(data, []).get(data)!

  for (const r of registros(abas.Compromissos)) {
    const data = dataDe(r.data)
    const titulo = txt(r.nome)
    if (!data || !titulo) continue
    por(data).push(limpo<Compromisso>({
      hora: horaDe(r.inicio) ?? null, titulo, local: txt(r.local) || null,
      duracaoMin: num(r['duracao (min)']), abre: horaDe(r.abre), fecha: horaDe(r.fecha),
      fechado: sim(r['fechado no dia']) || undefined, trajetoMin: num(r['trajeto (min)']),
      tipo: TIPOS[norm(txt(r.tipo))] ?? 'passeio', reserva: RESERVAS[norm(txt(r.reserva))],
      codigo: txt(r.codigo), nomeReserva: txt(r['nome na reserva']), pessoas: num(r.pessoas),
      pagamento: txt(r.pagamento), custo: num(r.custo), pago: txt(r.pago) ? sim(r.pago) : undefined, obs: txt(r.observacoes),
    }))
  }

  for (const r of registros(abas.Transporte)) {
    const data = dataDe(r.data)
    const de = txt(r.de)
    const para = txt(r.para)
    if (!data || !(de || para)) continue
    const tipo = TIPOS[norm(txt(r.tipo))]
    por(data).push(limpo<Compromisso>({
      hora: horaDe(r.partida) ?? null, titulo: [de, para].filter(Boolean).join(' → '),
      local: null,
      tipo: tipo && TRANSPORTES.has(tipo) ? tipo : 'outro', de, para, chegada: horaDe(r.chegada),
      numero: txt(r.numero), assento: txt(r.assento), codigo: txt(r.codigo), terminal: txt(r.terminal),
      custo: num(r.custo), pago: txt(r.pago) ? sim(r.pago) : undefined, obs: txt(r.observacoes),
    }))
    const c = por(data)[por(data).length - 1]
    c.local = localTransporte(c)
  }

  const hospedagens: Hospedagem[] = []
  for (const r of registros(abas.Hospedagem)) {
    const nome = txt(r.hotel)
    const checkin = dataDe(r['check-in'])
    const checkout = dataDe(r['check-out'])
    if (!nome || !checkin || !checkout) continue
    hospedagens.push(limpo<Hospedagem>({
      nome, cidade: txt(r.cidade), checkin, checkout,
      horaCheckin: horaDe(r['hora check-in']), horaCheckout: horaDe(r['hora check-out']),
      endereco: txt(r.endereco), link: txt(r.link) || null, codigo: txt(r.codigo),
      valor: num(r['valor total']), pago: txt(r.pago) ? sim(r.pago) : undefined, obs: txt(r.observacoes),
    }))
    // limpo() remove campos vazios, mas estes dois são obrigatórios no tipo.
    const h = hospedagens[hospedagens.length - 1]
    h.cidade ??= ''
    h.endereco ??= ''
    h.link ??= null
  }
  hospedagens.sort((a, b) => a.checkin.localeCompare(b.checkin))

  const info = new Map<string, { cidade: string; programa: string; notas: string }>()
  for (const r of registros(abas.Dias)) {
    const data = dataDe(r.data)
    if (data) info.set(data, { cidade: txt(r.cidade), programa: txt(r.programa), notas: txt(r.notas) })
  }

  const datas = [...porDia.keys(), ...info.keys(), ...hospedagens.flatMap((h) => [h.checkin, h.checkout])].sort()
  if (!datas.length) throw new Error('Não encontrei nenhuma linha com data nas abas do modelo.')

  const dias: Dia[] = []
  for (let data = datas[0]; data <= datas[datas.length - 1]; data = somaDias(data, 1)) {
    const hosp = hospedagens.find((h) => h.checkin <= data && data < h.checkout)
    const i = info.get(data)
    const compromissos = (porDia.get(data) ?? []).sort((a, b) => (a.hora ?? '99').localeCompare(b.hora ?? '99'))
    const noites = hosp ? Math.max(1, Math.round((Date.parse(hosp.checkout) - Date.parse(hosp.checkin)) / 86400000)) : 0
    const programa = i?.programa ?? ''
    dias.push({
      data,
      base: i?.cidade || hosp?.cidade || '—',
      programa,
      detalhes: i?.notas ?? '',
      hotel: hosp ? { nome: hosp.nome, endereco: hosp.endereco, link: hosp.link } : null,
      diaria: hosp?.valor != null ? hosp.valor / noites : null,
      tipo: compromissos.some((c) => c.tipo === 'voo') ? 'voo'
        : compromissos.some((c) => c.tipo && TRANSPORTES.has(c.tipo)) ? 'deslocamento'
        : compromissos.length || programa ? 'passeio' : 'livre',
      pendencias: [],
      compromissos,
    })
  }
  return recalcular({ dias, hospedagens })
}

/** Deriva as hospedagens de uma viagem importada no formato antigo (hotel repetido por noite). */
export function hospedagensDosDias(dias: Dia[]): Hospedagem[] {
  const hs: Hospedagem[] = []
  for (const d of dias) {
    if (!d.hotel) continue
    const ult = hs[hs.length - 1]
    if (ult && ult.nome === d.hotel.nome && ult.checkout === d.data) {
      ult.checkout = somaDias(d.data, 1)
      if (d.diaria != null) ult.valor = (ult.valor ?? 0) + d.diaria
    } else {
      hs.push(limpo<Hospedagem>({
        nome: d.hotel.nome, cidade: d.base, checkin: d.data, checkout: somaDias(d.data, 1),
        endereco: d.hotel.endereco, link: d.hotel.link, valor: d.diaria ?? undefined,
      }))
      const h = hs[hs.length - 1]
      h.endereco ??= ''
      h.link ??= null
    }
  }
  for (const h of hs) if (h.valor != null) h.valor = Math.round(h.valor * 100) / 100
  return hs
}

/** Reaplica hotel e diária de cada noite a partir das hospedagens (a fonte da verdade). */
export function distribuirHospedagens(v: Viagem): Viagem {
  for (const d of v.dias) {
    const h = (v.hospedagens ?? []).find((x) => x.checkin <= d.data && d.data < x.checkout)
    const noites = h ? Math.max(1, Math.round((Date.parse(h.checkout) - Date.parse(h.checkin)) / 86400000)) : 0
    d.hotel = h ? { nome: h.nome, endereco: h.endereco, link: h.link } : null
    d.diaria = h?.valor != null ? h.valor / noites : null
  }
  return v
}

const simNao = (b: boolean | undefined) => (b === undefined ? '' : b ? 'Sim' : 'Não')

/** Linhas de dados (sem cabeçalho) de cada aba, na ordem de COLUNAS. Datas em AAAA-MM-DD e horas em HH:MM. */
export function viagemParaAbas(v: Viagem): Record<NomeAba, Celula[][]> {
  const comps: Celula[][] = []
  const transp: Celula[][] = []
  for (const d of v.dias) {
    for (const c of d.compromissos) {
      if (c.tipo && TRANSPORTES.has(c.tipo)) {
        transp.push([d.data, ROTULO_TIPO[c.tipo], c.de ?? c.titulo, c.para ?? '', c.hora ?? '', c.chegada ?? '', c.numero ?? '',
          c.assento ?? '', c.codigo ?? '', c.terminal ?? '', c.custo ?? '', simNao(c.pago), c.obs ?? ''])
      } else {
        comps.push([d.data, c.hora ?? '', c.duracaoMin ?? '', ROTULO_TIPO[c.tipo ?? 'passeio'], c.titulo, c.local ?? '', c.abre ?? '',
          c.fecha ?? '', c.fechado ? 'Sim' : '', c.trajetoMin ?? '', c.reserva ? ROTULO_RESERVA[c.reserva] : '', c.codigo ?? '',
          c.nomeReserva ?? '', c.pessoas ?? '', c.pagamento ?? '', c.custo ?? '', simNao(c.pago), c.obs ?? ''])
      }
    }
  }
  return {
    Dias: v.dias.map((d) => [d.data, d.base === '—' ? '' : d.base, d.programa, d.detalhes]),
    Compromissos: comps,
    Hospedagem: (v.hospedagens ?? []).map((h) => [h.nome, h.cidade, h.checkin, h.horaCheckin ?? '', h.checkout, h.horaCheckout ?? '',
      h.endereco, h.link ?? '', h.codigo ?? '', h.valor ?? '', simNao(h.pago), h.obs ?? '']),
    Transporte: transp,
  }
}

/** Monta abas completas (com cabeçalho) a partir das linhas de dados: útil para testes e reimportação. */
export const comCabecalho = (dados: Record<NomeAba, Celula[][]>): Abas =>
  Object.fromEntries((Object.keys(COLUNAS) as NomeAba[]).map((n) => [n, [[...COLUNAS[n]], ...dados[n]]]))
