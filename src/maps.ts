/**
 * Interpreta o texto lido de um print do Google Maps (ficha de um lugar ou rota).
 * Tudo aqui é sugestão: quem usa confere os valores antes de salvar.
 */
export interface Faixa { abre: string; fecha: string }
export type DiaSemana = Faixa | 'fechado' | '24h'
export interface LeituraMaps {
  /** 0 = domingo … 6 = sábado */
  semana: Partial<Record<number, DiaSemana>>
  /** "Fecha às 17:00" / "Abre às 09:00": valem para o dia em que o print foi tirado */
  fechaAs?: string
  abreAs?: string
  /** Durações de rota encontradas, em minutos, na ordem em que aparecem */
  trajetosMin: number[]
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const DIAS: [RegExp, number][] = [
  [/^(domingo|dom\b|sunday|sun\b)/, 0], [/^(segunda|seg\b|monday|mon\b)/, 1],
  [/^(terca|ter\b|tuesday|tue\b)/, 2], [/^(quarta|qua\b|wednesday|wed\b)/, 3],
  [/^(quinta|qui\b|thursday|thu\b)/, 4], [/^(sexta|sex\b|friday|fri\b)/, 5],
  [/^(sabado|sab\b|saturday|sat\b)/, 6],
]
const HORA = /(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm)?/g

/** Lê todos os horários de um trecho: "09:00", "9h30", "5 PM", "5:30 pm". */
export function horasDe(trecho: string): string[] {
  const achados: string[] = []
  for (const m of trecho.matchAll(HORA)) {
    if (m[2] === undefined && m[3] === undefined) continue // número solto não é horário
    let h = Number(m[1])
    if (m[3] === 'pm' && h < 12) h += 12
    if (m[3] === 'am' && h === 12) h = 0
    if (h > 24 || Number(m[2] ?? 0) > 59) continue
    achados.push(`${String(h % 24).padStart(2, '0')}:${m[2] ?? '00'}`)
  }
  return achados
}

function diaDaLinha(resto: string): DiaSemana | null {
  if (/fechado|closed/.test(resto)) return 'fechado'
  if (/24 ?horas|24 ?hours/.test(resto)) return '24h'
  const hs = horasDe(resto)
  // Com intervalo de almoço, guarda a primeira abertura e o último fechamento.
  return hs.length >= 2 ? { abre: hs[0], fecha: hs[hs.length - 1] } : null
}

export function lerMaps(texto: string): LeituraMaps {
  const linhas = texto.split('\n').map((l) => semAcento(l).trim()).filter(Boolean)
  const r: LeituraMaps = { semana: {}, trajetosMin: [] }

  linhas.forEach((linha, i) => {
    const dia = DIAS.find(([re]) => re.test(linha))
    if (dia) {
      const resto = linha.replace(dia[0], '').replace(/^-?feira/, '')
      // O horário pode ter caído na linha de baixo.
      const valor = diaDaLinha(resto) ?? (linhas[i + 1] && !DIAS.some(([re]) => re.test(linhas[i + 1])) ? diaDaLinha(linhas[i + 1]) : null)
      if (valor && !(dia[1] in r.semana)) r.semana[dia[1]] = valor
      return
    }
    const fecha = linha.match(/(?:fecha|closes)\b[^0-9]*(.+)/)
    if (fecha && !r.fechaAs) r.fechaAs = horasDe(fecha[1])[0]
    const abre = linha.match(/(?:abre|opens)\b[^0-9]*(.+)/)
    if (abre && !r.abreAs) r.abreAs = horasDe(abre[1])[0]

    for (const m of linha.matchAll(/(?:(\d{1,2})\s*h(?:r|rs|ora|oras)?\.?\s*(?:e\s*)?)?(\d{1,3})\s*min\b/g)) {
      const total = Number(m[1] ?? 0) * 60 + Number(m[2])
      if (total > 0 && total < 24 * 60) r.trajetosMin.push(total)
    }
  })
  return r
}

export interface HorarioDoDia { abre?: string; fecha?: string; fechado?: boolean; fonte: 'tabela' | 'status' }

/** Horário de funcionamento para a data da visita (AAAA-MM-DD). */
export function horarioNoDia(l: LeituraMaps, dataISO: string): HorarioDoDia | null {
  const v = l.semana[new Date(dataISO + 'T00:00:00Z').getUTCDay()]
  if (v === 'fechado') return { fechado: true, fonte: 'tabela' }
  if (v === '24h') return { abre: '00:00', fecha: '23:59', fonte: 'tabela' }
  if (v) return { ...v, fonte: 'tabela' }
  if (l.abreAs || l.fechaAs) return { abre: l.abreAs, fecha: l.fechaAs, fonte: 'status' }
  return null
}
