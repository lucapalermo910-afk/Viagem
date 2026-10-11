import { describe, expect, it } from 'vitest'
import { lerHotel, linhasParaViagem } from './parser'

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
