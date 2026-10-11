import type { Compromisso, Dia, Hotel, TipoDia, Viagem } from './types'

type Celula = unknown
type Linha = Celula[]

const texto = (c: Celula): string =>
  c == null ? '' : String(c).replace(/ /g, ' ').trim()

const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function dataISO(c: Celula): string | null {
  if (c instanceof Date && !isNaN(c.getTime())) return c.toISOString().slice(0, 10)
  if (typeof c === 'number' && c > 20000 && c < 80000) {
    // Número de série do Excel (dias desde 1899-12-30)
    return new Date(Math.round((c - 25569) * 86400000)).toISOString().slice(0, 10)
  }
  const m = texto(c).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

export function lerHotel(c: Celula): Hotel | null {
  const linhas = texto(c).split('\n').map((l) => l.trim()).filter(Boolean)
  if (linhas.length === 0) return null
  const link = linhas.find((l) => /^https?:\/\//i.test(l)) ?? null
  const resto = linhas.filter((l) => l !== link)
  return { nome: resto[0] ?? '', endereco: resto.slice(1).join(', '), link }
}

function classificar(base: string, programa: string, conteudo: string): TipoDia {
  if (!conteudo) return 'livre'
  if (/voando/i.test(base) || /\b[A-Z]{3} \d{1,2}:\d{2}/.test(conteudo)) return 'voo'
  // Setas na coluna de detalhes costumam ser roteiros a pé, não troca de cidade.
  if (/→|>>/.test(programa)) return 'deslocamento'
  return 'passeio'
}

const RE_VOO = /([A-Z]{3}) (\d{1,2}:\d{2})[^>\n]*>\s*([A-Z]{3}) (\d{1,2}:\d{2})/
// Aceita 16h, 16H30, 13h50 e 01:35; não aceita números soltos como "8 Hirooka".
const RE_HORA = /\b(\d{1,2})(?:[hH](\d{2})?|:(\d{2}))(?!\w)/
const hhmm = (h: string, m = '00') => `${h.padStart(2, '0')}:${m}`

/** Extrai compromissos com horário e paradas sem horário do texto livre do dia. */
export function extrairCompromissos(
  programa: string, detalhes: string, tipo: TipoDia, base: string,
): Compromisso[] {
  const comHora: Compromisso[] = []
  const local = detalhes.match(/^local:\s*(.+)$/im)?.[1].trim() ?? null

  for (const linha of [programa, detalhes].join('\n').split('\n').map((l) => l.trim())) {
    const voo = linha.match(RE_VOO)
    if (voo) {
      const [h1, m1] = voo[2].split(':')
      const [h2, m2] = voo[4].split(':')
      comHora.push({ hora: hhmm(h1, m1), titulo: `Decolagem de ${voo[1]}`, local: `Aeroporto ${voo[1]}` })
      comHora.push({ hora: hhmm(h2, m2), titulo: `Pouso em ${voo[3]}`, local: null })
      continue
    }
    const t = linha.match(RE_HORA)
    if (t && Number(t[1]) <= 23) {
      const generica = /^hor[aá]rio/i.test(linha)
      // Tira os horários do título: "MIRANTE 16H OU 16H30" vira "MIRANTE".
      const limpo = linha.replace(new RegExp(RE_HORA, 'g'), '').replace(/(\s*\bou\b\s*)+$/i, '').trim()
      comHora.push({
        hora: hhmm(t[1], t[2] ?? t[3] ?? '00'),
        titulo: generica && programa ? `Partida: ${programa}` : limpo || linha,
        local: generica ? local : `${limpo || linha}, ${base}`,
      })
    }
  }

  const paradas: Compromisso[] =
    tipo === 'passeio' && !programa.includes('?')
      ? programa.split(/[,;→]/).map((p) => p.trim()).filter(Boolean)
          .map((p) => ({ hora: null, titulo: p, local: `${p}, ${base}` }))
      : []

  return [...comHora, ...paradas]
}

/** Pendências que dependem só do texto do dia. */
export function pendenciasDoTexto(programa: string, detalhes: string): string[] {
  const conteudo = [programa, detalhes].filter(Boolean).join('\n')
  if (!conteudo) return ['Dia sem programa']
  return /\?|\bou\b/i.test(conteudo) ? ['Decisão em aberto'] : []
}

/**
 * Converte as linhas brutas da planilha em uma viagem.
 * Espera um cabeçalho com as colunas Data, Base, Programa, Hotel e Diária.
 * A coluna sem título logo após "Programa" é lida como detalhes do dia.
 */
export function linhasParaViagem(linhas: Linha[]): Viagem {
  const iCab = linhas.findIndex((l) => l.some((c) => normalizar(texto(c)) === 'data'))
  if (iCab < 0) throw new Error('Não encontrei a coluna "Data" na planilha.')

  const cab = linhas[iCab].map((c) => normalizar(texto(c)))
  const col = (nome: string) => cab.indexOf(nome)
  const cData = col('data')
  const cBase = col('base')
  const cProg = col('programa')
  const cHotel = col('hotel')
  const cDiaria = col('diaria')
  if (cProg < 0) throw new Error('Não encontrei a coluna "Programa" na planilha.')
  const cDet = cab[cProg + 1] === '' || cab[cProg + 1] === undefined ? cProg + 1 : -1

  const dias: Dia[] = []
  let hotelAtual: Hotel | null = null

  for (const l of linhas.slice(iCab + 1)) {
    const data = dataISO(l[cData])
    if (!data) continue

    const base = cBase >= 0 ? texto(l[cBase]) : ''
    const programa = texto(l[cProg])
    const detalhes = cDet >= 0 ? texto(l[cDet]) : ''
    const bruto = cDiaria >= 0 ? l[cDiaria] : null
    const diaria = typeof bruto === 'number' && isFinite(bruto) ? bruto : null

    const hotelNovo = cHotel >= 0 ? lerHotel(l[cHotel]) : null
    if (hotelNovo) hotelAtual = hotelNovo
    // Só há pernoite quando a linha tem diária ou declara um hotel.
    const hotel = diaria != null || hotelNovo ? hotelAtual : null

    const conteudo = [programa, detalhes].filter(Boolean).join('\n')
    const pendencias = pendenciasDoTexto(programa, detalhes)
    if (hotelNovo && !hotelNovo.endereco) pendencias.push('Hotel sem endereço')

    const tipo = classificar(base, programa, conteudo)
    dias.push({
      data, base, programa, detalhes, hotel, diaria, tipo, pendencias,
      compromissos: extrairCompromissos(programa, detalhes, tipo, base),
    })
  }

  if (dias.length === 0) throw new Error('Nenhuma linha com data válida foi encontrada.')
  dias.sort((a, b) => a.data.localeCompare(b.data))
  return { dias }
}
