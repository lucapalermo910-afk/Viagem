import { describe, expect, it } from 'vitest'
import { abasParaViagem, comCabecalho, dataDe, horaDe, hospedagensDosDias, viagemParaAbas, COLUNAS } from './modelo'
import { conflitos, doCompromisso } from './pendencias'

const abas = {
  Dias: [[...COLUNAS.Dias], ['2030-03-02', '', 'Centro histórico', 'Levar casaco']],
  Compromissos: [[...COLUNAS.Compromissos],
    ['2030-03-02', '12:30', 60, 'Restaurante', 'Sushi Exemplo', 'Rua 1', '11:30', '14:00', '', 15, 'Sim', 'ABC', 'Silva', 2, 'Só dinheiro', 180, 'Não', 'Balcão'],
    ['2030-03-02', '10:00', 90, 'Ingresso', 'Museu', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['2030-03-03', '', '', 'Passeio', 'Parque', '', '', '', 'Sim', '', '', '', '', '', '', '', '', ''],
  ],
  Hospedagem: [[...COLUNAS.Hospedagem],
    ['Hotel Um', 'Lisboa', '2030-03-01', '15:00', '2030-03-03', '11:00', 'Rua 2', 'https://example.com', 'XYZ', 600, 'Sim', '']],
  Transporte: [[...COLUNAS.Transporte],
    ['2030-03-01', 'Voo', 'GRU', 'LIS', '22:10', '11:40', 'TP 82', '14C', 'LOC1', 'Terminal 3', 4000, 'Sim', ''],
    ['2030-03-03', 'Trem', 'Lisboa', 'Porto', '09:30', '12:20', 'AP 120', '', '', '', 150, 'Não', '']],
}

describe('abasParaViagem', () => {
  const v = abasParaViagem(abas)
  it('cria um dia para cada data, do primeiro ao último', () => {
    expect(v.dias.map((d) => d.data)).toEqual(['2030-03-01', '2030-03-02', '2030-03-03'])
  })
  it('ordena os compromissos por horário', () => {
    expect(v.dias[1].compromissos.map((c) => c.titulo)).toEqual(['Museu', 'Sushi Exemplo'])
  })
  it('usa a cidade do hotel quando a aba Dias não informa', () => {
    expect(v.dias[1].base).toBe('Lisboa')
    expect(v.dias[2].base).toBe('—') // noite do check-out não tem hotel
  })
  it('distribui o hotel e a diária pelas noites', () => {
    expect(v.dias[0].hotel?.nome).toBe('Hotel Um')
    expect(v.dias[1].diaria).toBe(300)
    expect(v.dias[2].hotel).toBeNull()
  })
  it('lê restaurante com os dados da reserva', () => {
    expect(v.dias[1].compromissos[1]).toMatchObject({
      tipo: 'restaurante', reserva: 'sim', codigo: 'ABC', nomeReserva: 'Silva', pessoas: 2, custo: 180, pago: false, trajetoMin: 15,
    })
  })
  it('lê voo e trem como transporte', () => {
    expect(v.dias[0].compromissos[0]).toMatchObject({ tipo: 'voo', titulo: 'GRU → LIS', hora: '22:10', chegada: '11:40', numero: 'TP 82', local: 'Aeroporto GRU' })
    expect(v.dias[0].tipo).toBe('voo')
    expect(v.dias[2].tipo).toBe('deslocamento')
  })
  it('acusa as pendências', () => {
    expect(v.dias[1].pendencias).toContain('Reserva a decidir') // ingresso sem resposta
    expect(v.dias[2].pendencias).toContain('Lugar fechado neste dia')
    expect(v.dias[0].pendencias).toEqual([])
  })
  it('ida e volta sem perda: exportar e reimportar dá a mesma viagem', () => {
    expect(abasParaViagem(comCabecalho(viagemParaAbas(v)))).toEqual(v)
  })
})

describe('datas e horas vindas do Excel', () => {
  it('aceita Date, número de série e texto', () => {
    expect(dataDe(new Date('2026-10-24T00:00:00Z'))).toBe('2026-10-24')
    expect(dataDe(46319)).toBe('2026-10-24')
    expect(dataDe('24/10/2026')).toBe('2026-10-24')
    expect(horaDe(0.729166666667)).toBe('17:30')
    expect(horaDe(new Date('1899-12-30T17:30:00Z'))).toBe('17:30')
    expect(horaDe('9h')).toBe('09:00')
    expect(horaDe('')).toBeUndefined()
  })
})

describe('pendências de compromisso', () => {
  it('restaurante sem resposta e ingresso não comprado', () => {
    expect(doCompromisso({ hora: null, titulo: 'R', local: null, tipo: 'restaurante' })).toEqual(['Reserva a decidir'])
    expect(doCompromisso({ hora: null, titulo: 'R', local: null, tipo: 'restaurante', reserva: 'nao' })).toEqual([])
    expect(doCompromisso({ hora: null, titulo: 'I', local: null, tipo: 'ingresso', reserva: 'nao' })).toEqual(['Ingresso não comprado'])
    expect(doCompromisso({ hora: null, titulo: 'I', local: null, tipo: 'ingresso', reserva: 'sim' })).toEqual(['Reserva sem código'])
  })
  it('fora do horário de funcionamento', () => {
    expect(doCompromisso({ hora: '17:30', titulo: 'J', local: null, duracaoMin: 60, fecha: '18:00' })).toEqual(['Fora do horário de funcionamento'])
    expect(doCompromisso({ hora: '16:30', titulo: 'J', local: null, duracaoMin: 60, abre: '07:00', fecha: '18:00' })).toEqual([])
  })
})

describe('conflitos', () => {
  const c = (hora: string, extra = {}) => ({ hora, titulo: hora, local: null, ...extra })
  it('acusa sobreposição', () => {
    expect(conflitos([c('10:00', { duracaoMin: 90 }), c('11:00')])).toEqual(['Compromissos sobrepostos'])
  })
  it('acusa trajeto que não cabe', () => {
    expect(conflitos([c('10:00', { duracaoMin: 60 }), c('11:10', { trajetoMin: 25 })])).toEqual(['Trajeto não cabe entre dois compromissos'])
    expect(conflitos([c('10:00', { duracaoMin: 60 }), c('11:30', { trajetoMin: 25 })])).toEqual([])
  })
  it('um voo ocupa até a chegada', () => {
    expect(conflitos([c('07:40', { chegada: '22:20' }), c('20:00')])).toEqual(['Compromissos sobrepostos'])
  })
})

describe('hospedagensDosDias', () => {
  it('agrupa noites seguidas no mesmo hotel', () => {
    const dia = (data: string, nome: string | null, diaria: number | null) => ({
      data, base: 'X', programa: '', detalhes: '', tipo: 'livre' as const, pendencias: [], compromissos: [],
      hotel: nome ? { nome, endereco: 'Rua', link: null } : null, diaria,
    })
    expect(hospedagensDosDias([dia('2030-03-01', 'A', 100), dia('2030-03-02', 'A', 100), dia('2030-03-03', 'B', 80), dia('2030-03-04', null, null)]))
      .toEqual([
        { nome: 'A', cidade: 'X', checkin: '2030-03-01', checkout: '2030-03-03', endereco: 'Rua', link: null, valor: 200 },
        { nome: 'B', cidade: 'X', checkin: '2030-03-03', checkout: '2030-03-04', endereco: 'Rua', link: null, valor: 80 },
      ])
  })
})
