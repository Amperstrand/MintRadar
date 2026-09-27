// URL filter mode: run MintRadar as a closed monitor for a class of mints.
//
// Set MINT_URL_PATTERN to a regex (JS flavor, matched against the
// normalized https URL). While set:
//   - Nostr + API discovery never run (no relay traffic, no foreign mints)
//   - The Nostr reviews sync never runs (it subscribes to relays with every
//     known mint URL as a filter — undesirable for private deployments)
//   - The daily service-profile publish never runs
//   - /api/mint/submit, /api/mints/discover and /api/mint/probe reject any
//     URL that does not match the pattern
//   - Boot seeding uses MINT_SEED_MINTS (comma-separated URLs; entries not
//     matching the pattern are skipped with a log line) instead of the
//     public KNOWN_MINTS list
//
// An invalid regex fails CLOSED (nothing matches) with an error log — a
// typo must never open the monitor to foreign mints. Unset pattern =
// default public behavior, unchanged.
import { normalizeUrl } from './discovery.js'

interface FilterState {
  source: string
  regex: RegExp | null
  invalid: boolean
}

let cached: FilterState | null = null

function filter(): FilterState {
  const source = process.env['MINT_URL_PATTERN'] ?? ''
  if (cached && cached.source === source) return cached
  let regex: RegExp | null = null
  let invalid = false
  if (source !== '') {
    try {
      regex = new RegExp(source)
    } catch {
      invalid = true
      console.error('[mint-filter] MINT_URL_PATTERN is not a valid regex — failing CLOSED (no URL will match) until fixed:', source)
    }
  }
  cached = { source, regex, invalid }
  return cached
}

export function isFilterMode(): boolean {
  const state = filter()
  return state.invalid || state.regex !== null
}

export function matchesMintUrl(url: string): boolean {
  const { regex, invalid } = filter()
  if (invalid) return false
  if (!regex) return true
  return regex.test(normalizeUrl(url))
}

export function getSeedMintUrls(): string[] | null {
  const { regex, invalid } = filter()
  if (!invalid && !regex) return null
  if (invalid) return []
  const urls = (process.env['MINT_SEED_MINTS'] ?? '')
    .split(',')
    .map((entry) => normalizeUrl(entry.trim()))
    .filter((entry) => entry.startsWith('https://'))
  const matching = urls.filter((entry) => regex !== null && regex.test(entry))
  for (const skipped of urls.filter((entry) => !matching.includes(entry))) {
    console.error('[mint-filter] seed mint does not match MINT_URL_PATTERN — skipping:', skipped)
  }
  return matching.sort()
}
