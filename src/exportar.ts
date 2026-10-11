import { COLUNAS, DATAS, HORAS, viagemParaAbas, type NomeAba } from './modelo'
import type { Viagem } from './types'

/**
 * Preenche o modelo de Excel com a viagem e devolve o arquivo pronto.
 * Com v = null, devolve o modelo vazio. Listas, formatos e fórmulas do modelo são mantidos.
 */
export async function gerarExcel(v: Viagem | null, modelo: ArrayBuffer): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(modelo)
  if (v) {
    const dados = viagemParaAbas(v)
    for (const nome of Object.keys(COLUNAS) as NomeAba[]) {
      const ws = wb.getWorksheet(nome)
      if (!ws) throw new Error(`O modelo não tem a aba ${nome}.`)
      dados[nome].forEach((linha, i) => {
        linha.forEach((valor, j) => {
          if (valor === '' || valor == null) return
          const coluna = COLUNAS[nome][j]
          const celula = ws.getCell(i + 2, j + 1)
          if (DATAS.has(coluna)) celula.value = new Date(`${valor}T00:00:00Z`)
          else if (HORAS.has(coluna)) {
            const [h, m] = String(valor).split(':').map(Number)
            celula.value = (h * 60 + m) / 1440
          } else celula.value = valor as string | number
        })
      })
    }
  }
  wb.calcProperties.fullCalcOnLoad = true
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}
