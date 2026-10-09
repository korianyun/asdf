const inappropriateWords = new Set([
  'anal', 'anus', 'arse', 'arsehole', 'ass', 'asshat', 'asshole', 'asslicker',
  'asswipe', 'balls', 'ballsack', 'banging', 'bastard', 'bellend', 'beaver',
  'bimbo', 'bitch', 'bitching', 'blowjob', 'boob', 'boobs', 'boner', 'bollocks',
  'breast', 'breasts', 'bullshit', 'buttfuck', 'butthead', 'clit', 'clitoris',
  'cock', 'cockhead', 'cocksucker', 'cooch', 'coochie', 'crap', 'cum', 'cumbubble',
  'cumdumpster', 'cumshot', 'cunt', 'dammit', 'damn', 'dick', 'dickhead', 'dildo',
  'dipshit', 'douche', 'douchebag', 'dumbass', 'ejaculate', 'ejaculation',
  'erection', 'fag', 'faggot', 'fanny', 'fellatio', 'fuck', 'fucked', 'fucker',
  'fuckface', 'fuckhead', 'fucking', 'fucks', 'gash', 'genitals', 'goddamn',
  'handjob', 'hardon', 'hell', 'hentai', 'hooker', 'horny', 'humping', 'jackass',
  'jerkoff', 'jizz', 'labia', 'milf', 'motherfucker', 'motherfucking', 'nigga',
  'nigger', 'nude', 'nudes', 'orgasm', 'orgasmic', 'penis', 'phallus', 'piss',
  'pissed', 'pisser', 'pissing', 'porn', 'porno', 'pornography', 'prick',
  'pube', 'pubes', 'pussy', 'queef', 'rape', 'raped', 'raper', 'rapist', 'rectum',
  'rimjob', 'scrotum', 'semen', 'sex', 'sexual', 'shag', 'shagging', 'shit',
  'shite', 'shitface', 'shithead', 'shithole', 'shitty', 'skank', 'slut', 'smegma',
  'spic', 'spunk', 'testicle', 'tits', 'tosser', 'tramp', 'twat', 'vagina',
  'wank', 'wanker', 'wankstain', 'whore', 'xxx',
])

const substitutions = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '|': 'i' }
const maxBlockedWordLength = Math.max(...[...inappropriateWords].map((word) => word.length))

function normalizeWord(value) {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[01345789@$!|]/g, (character) => substitutions[character])
    .replace(/[^a-z]/g, '')
}

function normalizedVariants(value) {
  const normalized = normalizeWord(value)
  return [normalized.replace(/(.)\1{2,}/gu, '$1$1'), normalized.replace(/(.)\1+/gu, '$1')]
}

export function isFamilyFriendlyText(value) {
  const words = value.match(/[\p{L}\p{N}@!$|]+/gu) || []
  if (words.some((word) => normalizedVariants(word).some((variant) => inappropriateWords.has(variant)))) return false

  for (let start = 0; start < words.length; start += 1) {
    let combined = ''
    for (let end = start; end < words.length && end < start + maxBlockedWordLength; end += 1) {
      const normalized = normalizeWord(words[end])
      if (!normalized || normalized.length > 3) break
      combined += words[end]
      if (normalizeWord(combined).length > maxBlockedWordLength) break
      if (normalizedVariants(combined).some((variant) => inappropriateWords.has(variant))) return false
    }
  }

  return true
}
