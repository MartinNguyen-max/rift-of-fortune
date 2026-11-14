import { describe, expect, it } from 'vitest'
import { openingArt } from './gameOpening'

describe('openingArt', () => {
  it('keeps the High Noon skins whoever plays which side', () => {
    expect(openingArt('duel', 'Caitlyn', 'Jhin')).toMatchObject({ you: expect.stringContaining('Caitlyn_2'), them: expect.stringContaining('Jhin_1') })
    expect(openingArt('duel', 'Jhin', 'Caitlyn')).toMatchObject({ you: expect.stringContaining('Jhin_1'), them: expect.stringContaining('Caitlyn_2') })
  })

  it('uses the finisher skin elsewhere, and flips a mirror match', () => {
    expect(openingArt('ult', 'Malphite', 'Amumu')).toMatchObject({ you: expect.stringContaining('Malphite_6'), them: expect.stringContaining('Amumu_8') })
    expect(openingArt('combo', 'Udyr', 'Udyr').mirror).toBe(true)
    expect(openingArt('cleaver', 'Katarina', 'Katarina')).toMatchObject({
      you: expect.stringContaining('Katarina_12'),
      them: expect.stringContaining('Katarina_21'),
      mirror: false,
    })
  })
})
