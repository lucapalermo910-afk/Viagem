import { describe, expect, it } from 'vitest'
import { distanciaKm, estimar } from './trajeto'

describe('distanciaKm', () => {
  it('um grau de latitude vale cerca de 111 km', () => {
    expect(distanciaKm({ lat: 35, lon: 139 }, { lat: 36, lon: 139 })).toBeCloseTo(111.2, 0)
  })
  it('é zero para o mesmo ponto', () => {
    expect(distanciaKm({ lat: 35, lon: 139 }, { lat: 35, lon: 139 })).toBe(0)
  })
})

describe('estimar', () => {
  it('trata distâncias curtas como caminhada', () => {
    // 1 km em reta = 1,3 km; a 4,5 km/h = 17,3 min; arredonda para 20
    expect(estimar(1)).toEqual({ min: 20, km: 1.3, modo: 'a pé' })
  })
  it('soma o tempo fixo no transporte', () => {
    // 8 km em reta = 10,4 km; 12 + 10,4/25*60 = 36,96 min; arredonda para 40
    expect(estimar(8)).toMatchObject({ min: 40, modo: 'transporte' })
  })
  it('nunca devolve menos de 5 minutos', () => {
    expect(estimar(0)?.min).toBe(5)
  })
  it('desiste em viagens entre cidades', () => {
    expect(estimar(35)).toBeNull()
  })
})
