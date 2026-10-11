// Copia os arquivos do leitor de imagens (Tesseract) para public/ocr.
// Assim a leitura de prints roda no próprio aparelho, sem enviar a imagem a ninguém.
import { cpSync, mkdirSync, readdirSync } from 'node:fs'

const destino = 'public/ocr'
mkdirSync(destino, { recursive: true })
cpSync('node_modules/tesseract.js/dist/worker.min.js', `${destino}/worker.min.js`)
for (const f of readdirSync('node_modules/tesseract.js-core')) {
  if (/^tesseract-core(-\w+)?-lstm\.wasm(\.js)?$/.test(f)) cpSync(`node_modules/tesseract.js-core/${f}`, `${destino}/${f}`)
}
for (const lingua of ['por', 'eng']) {
  cpSync(`node_modules/@tesseract.js-data/${lingua}/4.0.0_best_int/${lingua}.traineddata.gz`, `${destino}/${lingua}.traineddata.gz`)
}
