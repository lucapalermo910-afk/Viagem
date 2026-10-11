// Guarda o app no aparelho para abrir sem internet.
// Os dados da viagem ficam no armazenamento do navegador, não aqui.
const CACHE = 'roteiro-v2'

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    const resp = await fetch('./', { cache: 'no-store' })
    const html = await resp.clone().text()
    // Descobre os arquivos do app (nomes mudam a cada versão) lendo a própria página.
    const arquivos = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1])
    await cache.put('./', resp)
    await cache.addAll([...new Set([...arquivos, './modelo-roteiro.xlsx'])])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  e.respondWith((async () => {
    const cache = await caches.open(CACHE)
    if (req.mode === 'navigate') {
      // Página: tenta a versão nova; sem internet, usa a guardada.
      try {
        const nova = await fetch(req)
        cache.put('./', nova.clone())
        return nova
      } catch {
        return (await cache.match('./')) ?? Response.error()
      }
    }
    const guardado = await cache.match(req)
    if (guardado) return guardado
    const resp = await fetch(req)
    if (resp.ok) cache.put(req, resp.clone())
    return resp
  })())
})
