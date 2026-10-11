import './style.css'
import { readSheet } from 'read-excel-file/browser'
import { linhasParaViagem } from './parser'
import { viagemExemplo } from './exemplo'
import type { Compromisso, Dia, Viagem } from './types'
import { distanciaKm, estimar, FOLGA_MIN, type Estimativa, type Ponto } from './trajeto'

const CHAVE = 'viagem:v2'
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

const add = (el: HTMLElement, ...filhos: Filho[]) => {
  for (const f of filhos) if (f) el.append(f)
}

const utc = (iso: string) => new Date(iso + 'T00:00:00Z')
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...o }).format(utc(iso)).replace('.', '')
const p2 = (n: number) => String(n).padStart(2, '0')
/** Relógio do aparelho. Para testar: acrescente ?agora=2026-10-19T14:00 ao endereço. */
function agora(): Date {
  const sim = new URLSearchParams(location.search).get('agora')
  const d = sim ? new Date(sim) : new Date()
  return isNaN(d.getTime()) ? new Date() : d
}
const isoDe = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const hojeISO = () => isoDe(agora())
const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3))
const duracao = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${min % 60 ? p2(min % 60) : ''}`
const rota = (q: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=transit`
const CORES = ['#e4572e', '#2e86ab', '#3f9b6b', '#8e5bd0', '#d18b00', '#d6457a']
const corDe = (base: string, bases: string[]) => CORES[Math.max(0, bases.indexOf(base)) % CORES.length]
const ICONE = { voo: '✈️', deslocamento: '🚄', passeio: '📍', livre: '🌤️' } as const
const ehCidade = (base: string) => !!base && base !== '—' && !/voando/i.test(base)
const mapa = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

const ROTULO = { voo: 'Voo', deslocamento: 'Deslocamento', passeio: 'Passeio', livre: 'Dia livre' } as const

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

function linhaCompromisso(c: Compromisso, estado = '', extra = '') {
  return h('li', { class: `comp ${estado}` },
    h('span', { class: 'comp-hora' }, c.hora ?? '•'),
    h('span', { class: 'comp-titulo' }, c.titulo, extra && h('small', {}, extra)),
    c.local && h('a', { href: mapa(c.local), target: '_blank', rel: 'noopener', 'aria-label': `Mapa: ${c.titulo}` }, 'mapa'),
  )
}

function cartao(d: Dia, hoje: string, cor: string) {
  const classes = ['dia', `tipo-${d.tipo}`]
  if (d.data === hoje) classes.push('hoje')
  if (d.data < hoje) classes.push('passado')

  const corpo = h('div', { class: 'corpo' },
    h('div', { class: 'linha-topo' },
      h('span', { class: 'chip chip-tipo' }, `${ICONE[d.tipo]} ${ROTULO[d.tipo]}`),
      d.data === hoje && h('span', { class: 'chip chip-hoje' }, 'Hoje'),
      ...d.pendencias.map((p) => h('span', { class: 'chip chip-pend' }, p)),
    ),
    d.programa && h('p', { class: 'programa' }, d.programa),
    d.detalhes && h('p', { class: 'detalhes' }, d.detalhes),
    !d.programa && !d.detalhes && h('p', { class: 'vago' }, 'Nada planejado ainda.'),
    d.compromissos.length > 0 && h('ul', { class: 'comps' }, ...d.compromissos.map((c) => linhaCompromisso(c))),
  )

  if (d.hotel) {
    const alvo = [d.hotel.nome, d.hotel.endereco].filter(Boolean).join(', ')
    corpo.append(
      h('div', { class: 'hotel' },
        h('span', { class: 'hotel-rotulo' }, '🛏️ Dorme em'),
        h('strong', {}, d.hotel.nome),
        d.hotel.endereco && h('span', { class: 'endereco' }, d.hotel.endereco),
        h('span', { class: 'links' },
          h('a', { href: mapa(alvo), target: '_blank', rel: 'noopener' }, 'Abrir no mapa'),
          d.hotel.link && h('a', { href: d.hotel.link, target: '_blank', rel: 'noopener' }, 'Ver reserva'),
        ),
      ),
    )
  }

  return h('article', { class: classes.join(' '), id: `dia-${d.data}`, style: `--cor:${cor}` },
    h('div', { class: 'quando' },
      h('span', { class: 'num' }, fmt(d.data, { day: '2-digit' })),
      h('span', { class: 'sem' }, fmt(d.data, { weekday: 'short' })),
      h('span', { class: 'mes' }, fmt(d.data, { month: 'short' })),
    ),
    corpo,
  )
}

// ---------- localização e trajeto estimado ----------
const CHAVE_GEO = 'viagem:geo:v1'
let pos: Ponto | null = null
let geoErro = ''
/** Coordenadas por texto de busca; null = não encontrado. */
const geo: Record<string, Ponto | null> = (() => {
  try { return JSON.parse(localStorage.getItem(CHAVE_GEO) ?? '{}') } catch { return {} }
})()
const fila: string[] = []
let buscando = false

const redesenharAgora = () => {
  if (viagem) document.querySelector('#agora')?.replaceChildren(painelAgora(viagem))
}

function pedirLocalizacao() {
  if (!('geolocation' in navigator)) {
    geoErro = 'Este navegador não informa a localização.'
    return redesenharAgora()
  }
  navigator.geolocation.watchPosition(
    (p) => {
      pos = { lat: p.coords.latitude, lon: p.coords.longitude }
      geoErro = ''
      redesenharAgora()
    },
    () => {
      geoErro = 'Não consegui obter sua localização. Verifique a permissão do navegador.'
      redesenharAgora()
    },
    { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 },
  )
}

/** Busca coordenadas dos lugares, um por vez (limite de uso do OpenStreetMap). */
async function localizarLugares(lugares: string[]) {
  for (const l of lugares) if (!(l in geo) && !fila.includes(l)) fila.push(l)
  if (buscando) return
  buscando = true
  while (fila.length) {
    const q = fila.shift()!
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`)
      if (!r.ok) throw new Error(String(r.status))
      const [a] = (await r.json()) as { lat: string; lon: string }[]
      geo[q] = a ? { lat: Number(a.lat), lon: Number(a.lon) } : null
      try { localStorage.setItem(CHAVE_GEO, JSON.stringify(geo)) } catch { /* sem cache */ }
      redesenharAgora()
    } catch {
      break // sem internet: tenta de novo na próxima atualização
    }
    await new Promise((ok) => setTimeout(ok, 1100))
  }
  buscando = false
}

type Trajeto = Estimativa | 'longe' | 'desconhecido' | 'buscando' | null
function trajetoAte(c: Compromisso): Trajeto {
  if (!pos || !c.local) return null
  if (!(c.local in geo)) return 'buscando'
  const g = geo[c.local]
  if (!g) return 'desconhecido'
  return estimar(distanciaKm(pos, g)) ?? 'longe'
}
const textoTrajeto = (t: Trajeto) =>
  t === null ? '' : t === 'buscando' ? 'localizando…' : t === 'desconhecido' ? 'lugar não localizado'
  : t === 'longe' ? 'outra cidade' : `≈ ${duracao(t.min)} ${t.modo}`

// ---------- painel "Agora" ----------
function painelAgora(v: Viagem) {
  const t = agora()
  const hoje = isoDe(t)
  const min = t.getHours() * 60 + t.getMinutes()
  const dias = v.dias
  const caixa = h('section', { class: 'agora', 'aria-live': 'polite' })
  const relogio = `${p2(t.getHours())}:${p2(t.getMinutes())}`

  if (hoje < dias[0].data) {
    const falta = Math.round((utc(dias[0].data).getTime() - utc(hoje).getTime()) / 86400000)
    const primeiro = dias[0].compromissos.find((c) => c.hora)
    add(caixa, 
      h('p', { class: 'agora-rotulo' }, 'Contagem regressiva'),
      h('p', { class: 'agora-grande' }, falta === 1 ? 'Falta 1 dia' : `Faltam ${falta} dias`),
      primeiro && h('p', { class: 'agora-texto' },
        `Começa ${fmt(dias[0].data, { weekday: 'long', day: 'numeric', month: 'long' })}, às ${primeiro.hora}: ${primeiro.titulo}.`),
      primeiro && primeiro.hora! < '05:00' && h('p', { class: 'agora-aviso' },
        'É de madrugada: você sai de casa na noite anterior.'),
    )
    return caixa
  }
  const d = dias.find((x) => x.data === hoje)
  if (!d) {
    add(caixa, h('p', { class: 'agora-rotulo' }, 'Viagem concluída'), h('p', { class: 'agora-grande' }, 'Boas lembranças!'))
    return caixa
  }

  const comHora = d.compromissos.filter((c) => c.hora).sort((a, b) => a.hora!.localeCompare(b.hora!))
  const semHora = d.compromissos.filter((c) => !c.hora)
  const proximo = comHora.find((c) => minutos(c.hora!) >= min)

  add(caixa, 
    h('p', { class: 'agora-rotulo' }, `Hoje · ${ehCidade(d.base) ? d.base : 'em trânsito'} · ${relogio}`),
    proximo
      ? h('p', { class: 'agora-grande' }, `${proximo.titulo} em ${duracao(minutos(proximo.hora!) - min)}`)
      : h('p', { class: 'agora-grande' }, comHora.length ? 'Sem mais horários marcados hoje' : 'Dia sem horário marcado'),
    proximo && h('p', { class: 'agora-texto' }, `Marcado para ${proximo.hora}.`),
    proximo?.local && h('a', { class: 'btn btn-principal', href: rota(proximo.local), target: '_blank', rel: 'noopener' },
      'Ver tempo de trajeto daqui'),
  )
  // Hora de sair, estimada pela distância em linha reta até o próximo compromisso.
  const tp = proximo ? trajetoAte(proximo) : null
  if (proximo && tp && typeof tp === 'object') {
    const sair = minutos(proximo.hora!) - tp.min - FOLGA_MIN
    add(caixa, h('p', { class: 'agora-sair' },
      sair <= min ? 'Saia agora' : `Saia até ${p2(Math.floor(sair / 60))}:${p2(sair % 60)}`,
      h('small', {}, `Estimativa: ${duracao(tp.min)} ${tp.modo} (${tp.km.toFixed(1).replace('.', ',')} km) mais ${FOLGA_MIN} min de folga. Confirme no Maps.`),
    ))
  } else if (proximo && tp) {
    add(caixa, h('p', { class: 'agora-texto' }, `Trajeto: ${textoTrajeto(tp)}.`))
  }

  const comLocal = d.compromissos.filter((c) => c.local)
  if (!pos && comLocal.length) {
    const b = h('button', { class: 'btn', type: 'button' }, 'Estimar trajeto daqui')
    b.addEventListener('click', pedirLocalizacao)
    add(caixa, b, geoErro && h('p', { class: 'erro', role: 'alert' }, geoErro))
  }
  if (pos) void localizarLugares(comLocal.map((c) => c.local!))

  if (comHora.length || semHora.length) {
    add(caixa, h('ul', { class: 'comps' },
      ...comHora.map((c) => {
        const passou = minutos(c.hora!) < min
        return linhaCompromisso(c, c === proximo ? 'proximo' : passou ? 'feito' : '', passou ? '' : textoTrajeto(trajetoAte(c)))
      }),
      ...semHora.map((c) => linhaCompromisso(c, '', textoTrajeto(trajetoAte(c)))),
    ))
  }
  if (d.hotel) add(caixa, h('p', { class: 'agora-texto' }, `🛏️ Hoje você dorme em ${d.hotel.nome}.`))
  return caixa
}

function telaViagem(v: Viagem) {
  const hoje = hojeISO()
  const dias = v.dias
  const pend = dias.filter((d) => d.pendencias.length).length
  const trajeto = dias.map((d) => d.base).filter(ehCidade).filter((b, i, a) => b !== a[i - 1])
  const bases = trajeto.filter((b, i) => trajeto.indexOf(b) === i)

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
      lista.append(h('h2', { class: 'base', style: `--cor:${corDe(d.base, bases)}` }, ehCidade(d.base) ? d.base : 'Em trânsito'))
      baseAnterior = d.base
    }
    lista.append(cartao(d, hoje, corDe(d.base, bases)))
  }

  return h('main', {},
    h('header', { class: 'topo' },
      h('p', { class: 'sobre' }, 'Roteiro de viagem'),
      h('h1', {}, bases.join(' · ') || 'Minha viagem'),
      h('p', { class: 'lead' },
        `${fmt(dias[0].data, { day: 'numeric', month: 'short' })} a ` +
        `${fmt(dias[dias.length - 1].data, { day: 'numeric', month: 'short', year: 'numeric' })}` +
        ` · ${dias.length} dias · ${pend} com pendência`),
      h('ol', { class: 'rota' }, ...trajeto.map((b) => h('li', { style: `--cor:${corDe(b, bases)}` }, b))),
      h('div', { class: 'acoes' },
        pend > 0 && filtro,
        botaoImportar('Trocar planilha', 'btn btn-fantasma'),
        limpar,
      ),
      erro && h('p', { class: 'erro', role: 'alert' }, erro),
    ),
    h('div', { id: 'agora' }, painelAgora(v)),
    lista,
  )
}

function desenhar() {
  app.replaceChildren(viagem ? telaViagem(viagem) : telaVazia())
}

desenhar()
// Mantém o painel "Agora" em dia com o relógio.
setInterval(redesenharAgora, 30_000)
