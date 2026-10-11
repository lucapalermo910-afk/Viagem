import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import readXlsx from 'read-excel-file/node'
import { gerarExcel } from './exportar'
import { abasParaViagem, ehModeloNovo, type Abas } from './modelo'
import { viagemExemplo } from './exemplo'

const modelo = () => { const b = readFileSync('public/modelo-roteiro.xlsx'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
const lerAbas = async (arq: ArrayBuffer): Promise<Abas> =>
  Object.fromEntries((await readXlsx(Buffer.from(arq))).map((s) => [s.sheet, s.data as unknown[][]]))

describe('gerarExcel', () => {
  it('o modelo vazio é reconhecido e não tem dados', async () => {
    const abas = await lerAbas(await gerarExcel(null, modelo()))
    expect(ehModeloNovo(abas)).toBe(true)
    expect(() => abasParaViagem(abas)).toThrow(/nenhuma linha com data/)
  })
  it('exportar para Excel e reimportar devolve a mesma viagem', async () => {
    const v = viagemExemplo()
    const abas = await lerAbas(await gerarExcel(v, modelo()))
    expect(abasParaViagem(abas)).toEqual(v)
  })
})
