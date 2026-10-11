import { linhasParaViagem } from './parser'

const d = (s: string) => new Date(s + 'T00:00:00Z')

/** Roteiro fictício, só para demonstrar a interface sem dados reais. */
export const viagemExemplo = () =>
  linhasParaViagem([
    ['Data', null, 'Base', 'Programa', null, 'Hotel', 'Diária'],
    [d('2030-03-01'), null, 'Voando', 'GRU 22:10 Terminal 3 > LIS 11:40 Terminal 1', null, null, null],
    [d('2030-03-02'), null, 'Lisboa', 'Chegada; Baixa e Chiado a pé', 'Check-in a partir das 15h', 'Hotel Exemplo Lisboa\nRua Fictícia 10, Lisboa, Portugal\nhttps://example.com/reserva', 520],
    [d('2030-03-03'), null, 'Lisboa', 'Alfama, Castelo de São Jorge, miradouros', null, null, 520],
    [d('2030-03-04'), null, 'Lisboa', 'Sintra ou Cascais?', null, null, 520],
    [d('2030-03-05'), null, 'Porto', 'Lisboa → Porto de trem', 'Partida 09h30, Santa Apolônia\nReserva: EXEMPLO123', 'Pousada Exemplo Porto', 430],
    [d('2030-03-06'), null, 'Porto', null, null, null, 430],
    [d('2030-03-07'), null, 'Porto', 'Ribeira, Livraria Lello, caves em Gaia', null, null, 430],
    [d('2030-03-08'), null, '—', 'OPO 13:05 > GRU 20:15 Terminal 3', null, null, null],
  ])
