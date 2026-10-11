export type TipoDia = 'voo' | 'deslocamento' | 'passeio' | 'livre'

export interface Hotel {
  nome: string
  endereco: string
  link: string | null
}

export type TipoComp =
  | 'passeio' | 'restaurante' | 'ingresso' | 'compras' | 'livre'
  | 'voo' | 'trem' | 'onibus' | 'outro'
  | 'checkin' | 'checkout'
export type Reserva = 'sim' | 'nao' | 'nao-precisa' | 'a-decidir'

export interface Hospedagem {
  nome: string
  cidade: string
  /** AAAA-MM-DD */
  checkin: string
  checkout: string
  horaCheckin?: string
  horaCheckout?: string
  endereco: string
  link: string | null
  codigo?: string
  valor?: number
  pago?: boolean
  obs?: string
}

export interface Compromisso {
  /** HH:MM no horário local do lugar; null quando a planilha não informa */
  hora: string | null
  titulo: string
  /** Texto de busca para o mapa */
  local: string | null
  /** Tempo previsto no lugar, em minutos (informado por quem edita) */
  duracaoMin?: number
  /** Horário de funcionamento no dia da visita (HH:MM) */
  abre?: string
  fecha?: string
  /** O lugar não abre no dia da visita */
  fechado?: boolean
  /** Tempo de trajeto informado ou lido de um print do Maps, em minutos */
  trajetoMin?: number
  /** Ausente = passeio */
  tipo?: TipoComp
  reserva?: Reserva
  codigo?: string
  nomeReserva?: string
  pessoas?: number
  pagamento?: string
  custo?: number
  pago?: boolean
  obs?: string
  /** Só para transporte */
  de?: string
  para?: string
  chegada?: string
  numero?: string
  assento?: string
  terminal?: string
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
  hospedagens?: Hospedagem[]
}
