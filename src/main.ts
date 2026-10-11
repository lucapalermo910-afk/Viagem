import './style.css'
import { readSheet } from 'read-excel-file/browser'
import { linhasParaViagem } from './parser'
import { viagemExemplo } from './exemplo'
import type { Dia, Viagem } from './types'

const CHAVE = 'viagem:v1'
const app = document.querySelector<HTMLDivElement>('#app')!

let viagem: Viagem | null = carregar()
let soPendencias = false
let erro = ''

// ---------- armazenamento (somente neste aparelho) ----------
function carregar(): Viagem | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return bruto ? (JSON.parse(bruto) as Viagem) : null
  } catch {
    return null
  }
}
function salvar(v: Viagem | null) {
  try {
    if (v) localStorage.setItem(CHAVE, JSON.stringify(v))
    else localStorage.removeItem(CHAVE)
  } catch {
    /* sem armazenamento: a viagem vale só para esta sessão */
  }
}

// ---------- utilidades ----------
type Filho = Node | string | null | false | undefined
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...filhos: Filho[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const f of filhos) if (f) el.append(f)
  return el
}

const utc = (iso: string) => new Date(iso + 'T00:00:00Z')
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...o }).format(utc(iso)).replace('.', '')
const hojeISO = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const ehCidade = (base: string) => !!base && base !== '—' && !/voando/i.test(base)
const mapa = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

const ROTULO = { voo: 'Voo', deslocamento: 'Deslocamento', passeio: 'Passeio', livre: 'Em aberto' } as const

// ---------- importação ----------
async function importar(arquivo: File) {
  erro = ''
  try {
    const linhas = (await readSheet(arquivo)) as unknown[][]
    viagem = linhasParaViagem(linhas)
    salvar(viagem)
  } catch (e) {
    erro = e instanceof Error ? e.message : 'Não consegui ler este arquivo.'
  }
  desenhar()
}

function botaoImportar(rotulo: string, classe: string) {
  const input = h('input', { type: 'file', accept: '.xlsx', hidden: '' })
  input.addEventListener('change', () => input.files?.[0] && importar(input.files[0]))
  const b = h('button', { class: classe, type: 'button' }, rotulo)
  b.addEventListener('click', () => input.click())
  return h('span', {}, b, input)
}

// ---------- telas ----------
function telaVazia() {
  const exemplo = h('button', { class: 'btn btn-fantasma', type: 'button' }, 'Ver um exemplo')
  exemplo.addEventListener('click', () => {
    viagem = viagemExemplo()
    desenhar()
  })
  return h('main', { class: 'vazio' },
    h('p', { class: 'sobre' }, 'Roteiro de viagem'),
    h('h1', {}, 'Sua planilha, dia a dia.'),
    h('p', { class: 'lead' },
      'Importe o arquivo .xlsx do roteiro. Ele é lido neste aparelho e não é enviado a lugar nenhum.'),
    h('div', { class: 'acoes' }, botaoImportar('Importar planilha', 'btn btn-principal'), exemplo),
    erro && h('p', { class: 'erro', role: 'alert' }, erro),
    h('p', { class: 'nota' }, 'Colunas esperadas: Data, Base, Programa, Hotel e Diária.'),
  )
}

function cartao(d: Dia, hoje: string) {
  const classes = ['dia', `tipo-${d.tipo}`]
  if (d.data === hoje) classes.push('hoje')
  if (d.data < hoje) classes.push('passado')

  const corpo = h('div', { class: 'corpo' },
    h('div', { class: 'linha-topo' },
      h('span', { class: 'chip' }, ROTULO[d.tipo]),
      d.data === hoje && h('span', { class: 'chip chip-hoje' }, 'Hoje'),
      ...d.pendencias.map((p) => h('span', { class: 'chip chip-pend' }, p)),
    ),
    d.programa && h('p', { class: 'programa' }, d.programa),
    d.detalhes && h('p', { class: 'detalhes' }, d.detalhes),
    !d.programa && !d.detalhes && h('p', { class: 'vago' }, 'Nada planejado para este dia.'),
  )

  if (d.hotel) {
    const alvo = [d.hotel.nome, d.hotel.endereco].filter(Boolean).join(', ')
    corpo.append(
      h('div', { class: 'hotel' },
        h('span', { class: 'hotel-rotulo' }, 'Dorme em'),
        h('strong', {}, d.hotel.nome),
        d.hotel.endereco && h('span', { class: 'endereco' }, d.hotel.endereco),
        h('span', { class: 'links' },
          h('a', { href: mapa(alvo), target: '_blank', rel: 'noopener' }, 'Abrir no mapa'),
          d.hotel.link && h('a', { href: d.hotel.link, target: '_blank', rel: 'noopener' }, 'Ver reserva'),
        ),
      ),
    )
  }

  return h('article', { class: classes.join(' '), id: `dia-${d.data}` },
    h('div', { class: 'quando' },
      h('span', { class: 'num' }, fmt(d.data, { day: '2-digit' })),
      h('span', { class: 'sem' }, fmt(d.data, { weekday: 'short' })),
      h('span', { class: 'mes' }, fmt(d.data, { month: 'short' })),
    ),
    corpo,
  )
}

function telaViagem(v: Viagem) {
  const hoje = hojeISO()
  const dias = v.dias
  const pend = dias.filter((d) => d.pendencias.length).length
  const rota = dias.map((d) => d.base).filter(ehCidade).filter((b, i, a) => b !== a[i - 1])

  const filtro = h('button', {
    class: 'btn btn-fantasma', type: 'button', 'aria-pressed': String(soPendencias),
  }, soPendencias ? 'Mostrar todos os dias' : `Só pendências (${pend})`)
  filtro.addEventListener('click', () => {
    soPendencias = !soPendencias
    desenhar()
  })

  const limpar = h('button', { class: 'btn btn-fantasma', type: 'button' }, 'Remover dados')
  limpar.addEventListener('click', () => {
    if (!confirm('Remover o roteiro deste aparelho?')) return
    viagem = null
    soPendencias = false
    salvar(null)
    desenhar()
  })

  const lista = h('div', { class: 'lista' })
  let baseAnterior: string | null = null
  for (const d of dias) {
    if (soPendencias && !d.pendencias.length) continue
    if (d.base !== baseAnterior) {
      lista.append(h('h2', { class: 'base' }, ehCidade(d.base) ? d.base : 'Em trânsito'))
      baseAnterior = d.base
    }
    lista.append(cartao(d, hoje))
  }

  return h('main', {},
    h('header', { class: 'topo' },
      h('p', { class: 'sobre' }, 'Roteiro de viagem'),
      h('h1', {}, rota.filter((b, i) => rota.indexOf(b) === i).join(' · ') || 'Minha viagem'),
      h('p', { class: 'lead' },
        `${fmt(dias[0].data, { day: 'numeric', month: 'short' })} a ` +
        `${fmt(dias[dias.length - 1].data, { day: 'numeric', month: 'short', year: 'numeric' })}` +
        ` · ${dias.length} dias · ${pend} com pendência`),
      h('ol', { class: 'rota' }, ...rota.map((b) => h('li', {}, b))),
      h('div', { class: 'acoes' },
        pend > 0 && filtro,
        botaoImportar('Trocar planilha', 'btn btn-fantasma'),
        limpar,
      ),
      erro && h('p', { class: 'erro', role: 'alert' }, erro),
    ),
    lista,
  )
}

function desenhar() {
  app.replaceChildren(viagem ? telaViagem(viagem) : telaVazia())
}

desenhar()
document.querySelector('.dia.hoje')?.scrollIntoView({ block: 'center' })
