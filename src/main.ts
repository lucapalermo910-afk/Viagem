import './style.css'
import { readSheet } from 'read-excel-file/browser'
import { linhasParaViagem, pendenciasDoTexto } from './parser'
import { viagemExemplo } from './exemplo'
import type { Compromisso, Dia, Viagem } from './types'
import { distanciaKm, estimar, FOLGA_MIN, type Estimativa, type Ponto } from './trajeto'

const CHAVE = 'viagem:v2'
const app = document.querySelector<HTMLDivElement>('#app')!

let viagem: Viagem | null = carregar()
let soPendencias = false
let erro = ''
let aviso = ''

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
  if (viagem?.dias.some((d) => d.editado) &&
    !confirm('Importar a planilha apaga as edições feitas no app. Continuar?')) return
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

// ---------- compartilhamento por link ----------
const b64url = (bytes: Uint8Array) => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const deB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const transformar = async (bytes: Uint8Array, t: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(t)).arrayBuffer())

/** O roteiro vai inteiro dentro do link (após o #), sem passar por servidor. */
export async function linkDaViagem(v: Viagem): Promise<string> {
  const gz = await transformar(new TextEncoder().encode(JSON.stringify(v)), new CompressionStream('gzip'))
  return `${location.origin}${location.pathname}#v=${b64url(gz)}`
}
async function viagemDoLink(codigo: string): Promise<Viagem> {
  const json = new TextDecoder().decode(await transformar(deB64url(codigo), new DecompressionStream('gzip')))
  const v = JSON.parse(json) as Viagem
  if (!Array.isArray(v?.dias) || !v.dias.length || v.dias.some((d) => typeof d?.data !== 'string' || !Array.isArray(d.compromissos))) {
    throw new Error('formato')
  }
  return v
}

async function compartilhar() {
  if (!viagem) return
  if (!confirm('Quem receber o link vê o roteiro inteiro, inclusive códigos de reserva. Continuar?')) return
  const url = await linkDaViagem(viagem)
  try {
    if (navigator.share) await navigator.share({ title: 'Roteiro de viagem', url })
    else {
      await navigator.clipboard.writeText(url)
      aviso = 'Link copiado. Cole na conversa com quem viaja com você.'
    }
  } catch {
    aviso = '' // compartilhamento cancelado
  }
  desenhar()
}

async function abrirLinkCompartilhado() {
  if (!location.hash.startsWith('#v=')) return
  const codigo = location.hash.slice(3)
  history.replaceState(null, '', location.pathname + location.search)
  try {
    const recebida = await viagemDoLink(codigo)
    if (viagem && !confirm('Abrir o roteiro recebido? Ele substitui o que está neste aparelho.')) return
    viagem = recebida
    salvar(viagem)
    aviso = 'Roteiro recebido e guardado neste aparelho.'
  } catch {
    erro = 'Este link de roteiro está incompleto ou corrompido.'
  }
  desenhar()
}

// ---------- edição no app ----------
function campo(rotulo: string, controle: HTMLElement) {
  return h('label', { class: 'campo' }, h('span', {}, rotulo), controle)
}

function linhaEdicao(c: Partial<Compromisso>) {
  const hora = h('input', { type: 'time', value: c.hora ?? '', 'aria-label': 'Horário' })
  const titulo = h('input', { type: 'text', value: c.titulo ?? '', placeholder: 'O quê', 'aria-label': 'Compromisso' })
  const dur = h('input', { type: 'number', min: '0', step: '5', inputmode: 'numeric', placeholder: 'min', 'aria-label': 'Duração em minutos', value: c.duracaoMin ? String(c.duracaoMin) : '' })
  const local = h('input', { type: 'text', value: c.local ?? '', placeholder: 'Local para o mapa (opcional)', 'aria-label': 'Local' })
  const tirar = h('button', { type: 'button', class: 'btn-mini', 'aria-label': 'Remover compromisso' }, '✕')
  const linha = h('div', { class: 'ed-linha' }, hora, titulo, dur, tirar, local)
  tirar.addEventListener('click', () => linha.remove())
  return linha
}

function editarDia(d: Dia) {
  const programa = h('textarea', { rows: '2' }, d.programa)
  const detalhes = h('textarea', { rows: '4' }, d.detalhes)
  const linhas = h('div', { class: 'ed-linhas' }, ...d.compromissos.map(linhaEdicao))
  const mais = h('button', { type: 'button', class: 'btn' }, '+ Compromisso')
  mais.addEventListener('click', () => linhas.append(linhaEdicao({})))
  const cancelar = h('button', { type: 'button', class: 'btn' }, 'Cancelar')
  const form = h('form', { method: 'dialog' },
    h('h2', {}, `${fmt(d.data, { weekday: 'long', day: 'numeric', month: 'long' })}`),
    campo('Programa', programa),
    campo('Detalhes e reservas', detalhes),
    h('p', { class: 'ed-titulo' }, 'Compromissos (horário, descrição, duração em minutos)'),
    linhas, mais,
    h('div', { class: 'acoes' }, h('button', { type: 'submit', class: 'btn btn-principal' }, 'Salvar'), cancelar),
  )
  const dlg = h('dialog', { class: 'editor' }, form)
  cancelar.addEventListener('click', () => dlg.close())
  dlg.addEventListener('close', () => dlg.remove())
  form.addEventListener('submit', () => {
    d.programa = programa.value.trim()
    d.detalhes = detalhes.value.trim()
    d.compromissos = [...linhas.children].flatMap((l) => {
      const [hora, titulo, dur, local] = [...l.querySelectorAll('input')].map((i) => i.value.trim())
      if (!titulo) return []
      const c: Compromisso = { hora: hora || null, titulo, local: local || null }
      if (Number(dur) > 0) c.duracaoMin = Number(dur)
      return [c]
    })
    d.pendencias = [...pendenciasDoTexto(d.programa, d.detalhes), ...d.pendencias.filter((p) => p.startsWith('Hotel'))]
    const temConteudo = !!(d.programa || d.detalhes)
    if (d.tipo === 'livre' && temConteudo) d.tipo = 'passeio'
    if (d.tipo === 'passeio' && !temConteudo) d.tipo = 'livre'
    d.editado = true
    salvar(viagem)
    desenhar()
  })
  document.body.append(dlg)
  dlg.showModal()
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

const hhmmDe = (m: number) => `${p2(Math.floor(m / 60) % 24)}:${p2(m % 60)}`
const fimDe = (c: Compromisso) => (c.hora && c.duracaoMin ? hhmmDe(minutos(c.hora) + c.duracaoMin) : '')

function linhaCompromisso(c: Compromisso, estado = '', extra = '') {
  return h('li', { class: `comp ${estado}` },
    h('span', { class: 'comp-hora' }, c.hora ?? '•'),
    h('span', { class: 'comp-titulo' }, c.titulo,
      extra || c.duracaoMin
        ? h('small', {}, [fimDe(c) && `até ${fimDe(c)}`, !c.hora && c.duracaoMin && duracao(c.duracaoMin), extra].filter(Boolean).join(' · '))
        : null),
    c.local && h('a', { href: mapa(c.local), target: '_blank', rel: 'noopener', 'aria-label': `Mapa: ${c.titulo}` }, 'mapa'),
  )
}

function cartao(d: Dia, hoje: string, cor: string) {
  const classes = ['dia', `tipo-${d.tipo}`]
  if (d.data === hoje) classes.push('hoje')
  if (d.data < hoje) classes.push('passado')

  const editar = h('button', { type: 'button', class: 'btn-mini editar', 'aria-label': `Editar ${fmt(d.data, { day: 'numeric', month: 'long' })}` }, 'Editar')
  editar.addEventListener('click', () => editarDia(d))

  const corpo = h('div', { class: 'corpo' },
    h('div', { class: 'linha-topo' },
      h('span', { class: 'chip chip-tipo' }, `${ICONE[d.tipo]} ${ROTULO[d.tipo]}`),
      d.data === hoje && h('span', { class: 'chip chip-hoje' }, 'Hoje'),
      ...d.pendencias.map((p) => h('span', { class: 'chip chip-pend' }, p)),
      d.editado && h('span', { class: 'chip' }, 'Editado'),
      editar,
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
          d.hotel.link && /^https?:\/\//i.test(d.hotel.link) && h('a', { href: d.hotel.link, target: '_blank', rel: 'noopener' }, 'Ver reserva'),
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
  // Em dia de voo os horários são locais de cada aeroporto: sem contagem regressiva.
  const voo = d.tipo === 'voo'
  const proximo = voo ? undefined : comHora.find((c) => minutos(c.hora!) >= min)
  const emCurso = voo ? undefined : comHora.find((c) =>
    c.duracaoMin && minutos(c.hora!) <= min && min < minutos(c.hora!) + c.duracaoMin)

  add(caixa, 
    h('p', { class: 'agora-rotulo' }, `Hoje · ${ehCidade(d.base) ? d.base : 'em trânsito'} · ${relogio}`),
    proximo
      ? h('p', { class: 'agora-grande' }, `${proximo.titulo} em ${duracao(minutos(proximo.hora!) - min)}`)
      : h('p', { class: 'agora-grande' }, voo ? 'Dia de voo' : comHora.length ? 'Sem mais horários marcados hoje' : 'Dia sem horário marcado'),
    voo && h('p', { class: 'agora-texto' }, 'Cada horário está no fuso do próprio aeroporto; confira no cartão de embarque.'),
    emCurso && h('p', { class: 'agora-texto' }, `Agora: ${emCurso.titulo}, até ${fimDe(emCurso)}.`),
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
        const passou = !voo && minutos(c.hora!) + (c.duracaoMin ?? 0) < min
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

  const enviar = h('button', { class: 'btn btn-fantasma', type: 'button' }, 'Compartilhar')
  enviar.addEventListener('click', () => void compartilhar())

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
        enviar,
        limpar,
      ),
      aviso && h('p', { class: 'aviso', role: 'status' }, aviso),
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
void abrirLinkCompartilhado()
// Link aberto com o app já na tela muda só o trecho após o #.
addEventListener('hashchange', () => void abrirLinkCompartilhado())
// Mantém o painel "Agora" em dia com o relógio.
setInterval(redesenharAgora, 30_000)

// Uso sem internet: registra o service worker (só no site publicado).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* segue funcionando online */ })
}
