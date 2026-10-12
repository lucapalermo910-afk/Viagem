import { defineConfig, type Plugin } from 'vite'

// Identificador único de cada build. Serve para o app perceber que existe versão nova publicada.
const VERSAO = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)

const arquivoDeVersao = (): Plugin => ({
  name: 'arquivo-de-versao',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'versao.json', source: JSON.stringify({ versao: VERSAO }) })
  },
})

// Caminhos relativos: funciona em qualquer subpasta do GitHub Pages.
export default defineConfig({
  base: './',
  define: { __VERSAO__: JSON.stringify(VERSAO) },
  plugins: [arquivoDeVersao()],
})
