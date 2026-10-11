import { describe, expect, it } from 'vitest'
import { horarioNoDia, horasDe, lerMaps } from './maps'

const FICHA = `Kenroku-en
4,6 (32.105) · Jardim
Aberto · Fecha às 18:00
domingo 07:00–18:00
segunda-feira 07:00–18:00
terça-feira Fechado
quarta-feira
07:00–18:00
quinta-feira 11:00–14:00, 17:00–22:00
sexta-feira Aberto 24 horas
sábado 07:00–18:00`

describe('horasDe', () => {
  it('lê formatos de 24 e de 12 horas', () => {
    expect(horasDe('09:00–17:30')).toEqual(['09:00', '17:30'])
    expect(horasDe('9 am – 5:30 pm')).toEqual(['09:00', '17:30'])
    expect(horasDe('12 am, 12 pm')).toEqual(['00:00', '12:00'])
  })
  it('ignora números que não são horário', () => {
    expect(horasDe('4,6 (32.105)')).toEqual([])
  })
})

describe('lerMaps: ficha de lugar', () => {
  const l = lerMaps(FICHA)
  it('lê a tabela da semana', () => {
    expect(l.semana[0]).toEqual({ abre: '07:00', fecha: '18:00' })
    expect(l.semana[2]).toBe('fechado')
    expect(l.semana[5]).toBe('24h')
  })
  it('aceita o horário na linha de baixo', () => {
    expect(l.semana[3]).toEqual({ abre: '07:00', fecha: '18:00' })
  })
  it('com intervalo, usa a primeira abertura e o último fechamento', () => {
    expect(l.semana[4]).toEqual({ abre: '11:00', fecha: '22:00' })
  })
  it('escolhe o dia da semana da visita', () => {
    // 24/10/2026 é sábado; 27/10/2026 é terça
    expect(horarioNoDia(l, '2026-10-24')).toEqual({ abre: '07:00', fecha: '18:00', fonte: 'tabela' })
    expect(horarioNoDia(l, '2026-10-27')).toEqual({ fechado: true, fonte: 'tabela' })
  })
  it('lê a tabela em inglês', () => {
    expect(lerMaps('Monday 9 AM–5 PM\nTuesday Closed').semana).toEqual({ 1: { abre: '09:00', fecha: '17:00' }, 2: 'fechado' })
  })
})

describe('lerMaps: sem tabela', () => {
  it('usa a linha de status, marcada como menos confiável', () => {
    expect(horarioNoDia(lerMaps('Aberto · Fecha às 17:00'), '2026-10-24')).toEqual({ abre: undefined, fecha: '17:00', fonte: 'status' })
  })
  it('devolve null quando não há horário', () => {
    expect(horarioNoDia(lerMaps('Templo bonito'), '2026-10-24')).toBeNull()
  })
})

describe('lerMaps: rota', () => {
  it('lê durações em minutos e em horas', () => {
    expect(lerMaps('25 min\n15:10–15:35\n1 h 5 min\n2 h e 10 min').trajetosMin).toEqual([25, 65, 130])
  })
  it('não confunde horário com duração', () => {
    expect(lerMaps('09:00–17:00').trajetosMin).toEqual([])
  })
})
