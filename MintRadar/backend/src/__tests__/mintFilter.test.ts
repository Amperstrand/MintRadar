import { describe, it, expect, afterEach } from 'vitest'
import { isFilterMode, matchesMintUrl, getSeedMintUrls } from '../mintFilter.js'

// The module memoizes on the raw MINT_URL_PATTERN string, so each test can
// set the env and call the functions — no import-order gymnastics.
describe('mint URL filter mode', () => {
  afterEach(() => {
    delete process.env['MINT_URL_PATTERN']
    delete process.env['MINT_SEED_MINTS']
  })

  describe('mode detection', () => {
    it('is off when MINT_URL_PATTERN is unset', () => {
      expect(isFilterMode()).toBe(false)
    })

    it('is off for an empty string', () => {
      process.env['MINT_URL_PATTERN'] = ''
      expect(isFilterMode()).toBe(false)
    })

    it('is on for a valid regex', () => {
      process.env['MINT_URL_PATTERN'] = '^https://mint\\.example\\.com$'
      expect(isFilterMode()).toBe(true)
    })

    it('is on for an INVALID regex too (fail-closed, not fail-open)', () => {
      process.env['MINT_URL_PATTERN'] = '^https://(['
      expect(isFilterMode()).toBe(true)
    })
  })

  describe('matchesMintUrl', () => {
    it('allows any URL when the mode is off', () => {
      expect(matchesMintUrl('https://anything.example.com')).toBe(true)
    })

    it('matches URLs the pattern accepts', () => {
      process.env['MINT_URL_PATTERN'] = '^https://(ns|cdk)-[0-9a-f]{7}\\.cashu\\.exchange$'
      expect(matchesMintUrl('https://ns-a974914.cashu.exchange')).toBe(true)
      expect(matchesMintUrl('https://cdk-4312959.cashu.exchange')).toBe(true)
    })

    it('rejects URLs the pattern denies', () => {
      process.env['MINT_URL_PATTERN'] = '^https://(ns|cdk)-[0-9a-f]{7}\\.cashu\\.exchange$'
      expect(matchesMintUrl('https://mint.minibits.cash/Bitcoin')).toBe(false)
      expect(matchesMintUrl('https://mint.coinos.io')).toBe(false)
      expect(matchesMintUrl('https://testnut.cashu.space')).toBe(false)
    })

    it('matches against the normalizeUrl form (lowercase host, stripped trailing slash)', () => {
      process.env['MINT_URL_PATTERN'] = '^https://mint\\.example\\.com$'
      expect(matchesMintUrl('https://Mint.Example.com/')).toBe(true)
    })

    it('rejects everything when the regex is invalid (fail closed)', () => {
      process.env['MINT_URL_PATTERN'] = '('
      expect(matchesMintUrl('https://mint.example.com')).toBe(false)
    })
  })

  describe('getSeedMintUrls', () => {
    it('returns null when the mode is off', () => {
      process.env['MINT_SEED_MINTS'] = 'https://mint.example.com'
      expect(getSeedMintUrls()).toBeNull()
    })

    it('returns matching seeds, normalized and sorted; drops non-matching ones', () => {
      process.env['MINT_URL_PATTERN'] = '\\.cashu\\.exchange$'
      process.env['MINT_SEED_MINTS'] = 'https://ns-a974914.cashu.exchange, https://mint.minibits.cash/Bitcoin,https://cdk-4312959.cashu.exchange/'
      expect(getSeedMintUrls()).toEqual([
        'https://cdk-4312959.cashu.exchange',
        'https://ns-a974914.cashu.exchange',
      ])
    })

    it('returns an empty list for an invalid regex (nothing seeds)', () => {
      process.env['MINT_URL_PATTERN'] = '['
      process.env['MINT_SEED_MINTS'] = 'https://ns-a974914.cashu.exchange'
      expect(getSeedMintUrls()).toEqual([])
    })

    it('returns an empty list when MINT_SEED_MINTS is unset in filter mode', () => {
      process.env['MINT_URL_PATTERN'] = '\\.cashu\\.exchange$'
      expect(getSeedMintUrls()).toEqual([])
    })
  })
})
