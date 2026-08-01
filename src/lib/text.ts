const STOP_WORDS = new Set([
  'aber', 'alle', 'als', 'am', 'an', 'auch', 'auf', 'aus', 'bei', 'beim', 'bin', 'bis',
  'da', 'dann', 'das', 'dass', 'dem', 'den', 'der', 'des', 'die', 'dies', 'diese', 'dieser',
  'ein', 'eine', 'einem', 'einen', 'einer', 'es', 'für', 'gegen', 'hat', 'haben', 'ich',
  'im', 'in', 'ist', 'mit', 'nach', 'noch', 'oder', 'sich', 'sie', 'sind', 'so', 'über',
  'um', 'und', 'von', 'vor', 'was', 'wenn', 'wie', 'wird', 'wir', 'zu', 'zum', 'zur',
])

const ENDINGS = [
  'ierungen', 'ierung', 'keiten', 'keit', 'ungen', 'ung', 'ischen', 'ischer', 'ische',
  'lich', 'lichkeit', 'enden', 'ender', 'ende', 'ern', 'est', 'en', 'er', 'es', 'e', 'n', 's',
]

export function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9äöü\s-]/g, ' ')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stemToken(token: string): string {
  if (token.length < 5) return token
  const ending = ENDINGS.find((candidate) => token.endsWith(candidate) && token.length - candidate.length >= 4)
  return ending ? token.slice(0, -ending.length) : token
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map(stemToken)
}

export function uniqueTokens(value: string): Set<string> {
  return new Set(tokenize(value))
}

export function jaccardSimilarity(left: string, right: string): number {
  const leftTokens = uniqueTokens(left)
  const rightTokens = uniqueTokens(right)
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0

  let intersection = 0
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1
  })

  const union = new Set([...leftTokens, ...rightTokens]).size
  return union === 0 ? 0 : intersection / union
}

export function extractTopic(value: string): string {
  const normalized = normalizeText(value)
  const topicTokens = normalized
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .slice(0, 7)

  if (topicTokens.length === 0) return 'dieses Thema'
  return `„${topicTokens.join(' ')}“`
}

export function interpolate(template: string, topic: string): string {
  return template.replaceAll('{topic}', topic)
}
