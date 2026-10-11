/** Lê o texto de uma imagem no próprio aparelho. A imagem não é enviada a nenhum servidor. */
export async function lerImagem(arquivo: Blob, progresso?: (fracao: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const base = new URL('./ocr/', document.baseURI).href
  const leitor = await createWorker(['por', 'eng'], 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base,
    gzip: true,
    logger: (m) => m.status === 'recognizing text' && progresso?.(m.progress),
  })
  try {
    return (await leitor.recognize(arquivo)).data.text
  } finally {
    await leitor.terminate()
  }
}
