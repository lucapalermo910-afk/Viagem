import { describe, expect, it } from 'vitest'
import { extrairCompromissos, lerHotel, linhasParaViagem } from './parser'

const d = (s: string) => new Date(s + 'T00:00:00Z')
const CAB = ['Data', null, 'Base', 'Programa', null, 'Hotel', 'Diária']

describe('linhasParaViagem', () => {
  const v = linhasParaViagem([
    CAB,
    [d('2030-03-01'), 'sexta', 'Voando', 'AAA 01:35 > BBB 23:00', null, null, null],
    [d('2030-03-02'), 'sábado', 'Lisboa', null, 'Alfama', 'Hotel Exemplo\nRua Um, 10\nhttps://exemplo.test/h', 100],
    [d('2030-03-03'), 'domingo', 'Lisboa', null, null, null, 100],
    [d('2030-03-04'), 'segunda', 'Porto', 'Lisboa → Porto', null, 'Pousada Dois', 80],
    [d('2030-03-05'), 'terça', 'Porto', 'Sintra ou Cascais?', null, null, null],
    [null, null, null, 'linha sem data', null, null, null],
  ])

  it('ignora linhas sem data e mantém a ordem', () => {
    expect(v.dias.map((x) => x.data)).toEqual([
      '2030-03-01', '2030-03-02', '2030-03-03', '2030-03-04', '2030-03-05',
    ])
  })

  it('classifica o tipo de cada dia', () => {
    expect(v.dias.map((x) => x.tipo)).toEqual(['voo', 'passeio', 'livre', 'deslocamento', 'passeio'])
  })

  it('repete o hotel nas noites seguintes da estadia', () => {
    expect(v.dias[2].hotel?.nome).toBe('Hotel Exemplo')
    expect(v.dias[3].hotel?.nome).toBe('Pousada Dois')
  })

  it('não atribui hotel a dia sem diária', () => {
    expect(v.dias[0].hotel).toBeNull()
    expect(v.dias[4].hotel).toBeNull()
  })

  it('marca pendências', () => {
    expect(v.dias[2].pendencias).toContain('Dia sem programa')
    expect(v.dias[4].pendencias).toContain('Decisão em aberto')
    expect(v.dias[3].pendencias).toContain('Hotel sem endereço')
    expect(v.dias[1].pendencias).toEqual([])
  })

  it('lê a coluna sem título como detalhes', () => {
    expect(v.dias[1].detalhes).toBe('Alfama')
  })

  it('falha com mensagem clara sem cabeçalho', () => {
    expect(() => linhasParaViagem([['x', 'y']])).toThrow(/Data/)
  })
})

describe('lerHotel', () => {
  it('separa nome, endereço e link', () => {
    expect(lerHotel('Hotel A\nRua B, 1\nCidade\nhttps://x.test/a')).toEqual({
      nome: 'Hotel A', endereco: 'Rua B, 1, Cidade', link: 'https://x.test/a',
    })
  })
  it('devolve null para célula vazia', () => {
    expect(lerHotel(null)).toBeNull()
  })
})

describe('extrairCompromissos', () => {
  it('lê decolagem e pouso de cada trecho de voo', () => {
    const c = extrairCompromissos('AAA 00:05 Terminal 3 > BBB 06:55 Terminal 3\nBBB 09:05 > CCC 17:35', '', 'voo', '—')
    expect(c.map((x) => `${x.hora} ${x.titulo}`)).toEqual([
      '00:05 Decolagem de AAA', '06:55 Pouso em BBB', '09:05 Decolagem de BBB', '17:35 Pouso em CCC',
    ])
  })
  it('reconhece 16H, 16H30 e 13h50 e ignora números de endereço', () => {
    const c = extrairCompromissos('A → B', 'Guia (R$739,74)\nHorário de partida: 13h50\nLocal: 1 Chome-8 Hirooka, 920-0031', 'deslocamento', 'X')
    expect(c).toEqual([{ hora: '13:50', titulo: 'Partida: A → B', local: '1 Chome-8 Hirooka, 920-0031' }])
    expect(extrairCompromissos('', 'MIRANTE 16H OU 16H30', 'passeio', 'X')[0]).toEqual({ hora: '16:00', titulo: 'MIRANTE', local: 'MIRANTE, X' })
  })
  it('separa as paradas de um dia de passeio', () => {
    const c = extrairCompromissos('Jardim, castelo; Mercado', '', 'passeio', 'Cidade')
    expect(c.map((x) => x.titulo)).toEqual(['Jardim', 'castelo', 'Mercado'])
    expect(c[0]).toEqual({ hora: null, titulo: 'Jardim', local: 'Jardim, Cidade' })
  })
  it('não inventa paradas quando o dia ainda é uma dúvida', () => {
    expect(extrairCompromissos('Sintra ou Cascais?', '', 'passeio', 'X')).toEqual([])
  })
})
