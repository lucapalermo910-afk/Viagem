export type TipoDia = 'voo' | 'deslocamento' | 'passeio' | 'livre'

export interface Hotel {
  nome: string
  endereco: string
  link: string | null
}

export interface Compromisso {
  /** HH:MM no horário local do lugar; null quando a planilha não informa */
  hora: string | null
  titulo: string
  /** Texto de busca para o mapa */
  local: string | null
  /** Tempo previsto no lugar, em minutos (informado por quem edita) */
  duracaoMin?: number
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
  compromissos: Compromisso[]
  /** Alterado no app depois da importação */
  editado?: boolean
}

export interface Viagem {
  dias: Dia[]
}
