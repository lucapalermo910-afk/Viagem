export type TipoDia = 'voo' | 'deslocamento' | 'passeio' | 'livre'

export interface Hotel {
  nome: string
  endereco: string
  link: string | null
}

export interface Dia {
  /** Data no formato AAAA-MM-DD */
  data: string
  base: string
  programa: string
  detalhes: string
  /** Hotel da noite; null quando não há pernoite (ex.: voo noturno) */
  hotel: Hotel | null
  diaria: number | null
  tipo: TipoDia
  pendencias: string[]
}

export interface Viagem {
  dias: Dia[]
}
