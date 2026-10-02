import nspell from 'nspell'
import englishAffix from '../node_modules/dictionary-en/index.aff?raw'
import englishDictionary from '../node_modules/dictionary-en/index.dic?raw'

const englishSpellcheck = nspell(englishAffix, englishDictionary)
const recognizedAcronyms = new Set(['AI', 'ADHD', 'API', 'CRISPR', 'DNA', 'GPS', 'NASA', 'RNA', 'VR', 'WiFi'])
const inappropriateTopicWords = new Set([
  'ass', 'arse', 'bastard', 'bitch', 'blowjob', 'bullshit', 'cock', 'cocksucker',
  'cunt', 'dick', 'dildo', 'douche', 'fag', 'faggot', 'fuck', 'motherfucker',
  'nigga', 'nigger', 'piss', 'porn', 'pussy', 'shit', 'slut', 'spic', 'twat',
  'whore', 'wanker',
])

export function validateTopic(value) {
  const topic = value.trim().replace(/\s+/g, ' ')
  if (topic.length < 2) return 'Enter a topic with at least two characters.'
  if (topic.length > 100) return 'Keep your topic under 100 characters.'

  const characters = [...topic]
  const meaningfulCharacters = characters.filter((character) => /[\p{L}\p{N}]/u.test(character)).length
  if (meaningfulCharacters / characters.length < 0.5) return 'Use words to describe a topic or question.'

  const words = topic.match(/[\p{L}]+(?:['’][\p{L}]+)?/gu) || []
  if (!words.length) return 'Include at least one English dictionary word in your topic.'
  const distinctWords = new Set(words.map((word) => word.toLocaleLowerCase()))
  if (words.length > 12) return 'Keep your topic focused on one subject or question.'
  if (words.length > 2 && distinctWords.size === 1) return 'Enter a clear subject or question instead of repeating the same word.'
  if (characters.some((character, index) => index > 2 && character === characters[index - 1] && character === characters[index - 2] && character === characters[index - 3])) {
    return 'That does not look like a clear topic. Try a subject or specific question.'
  }
  if (words.some((word) => inappropriateTopicWords.has(word.toLocaleLowerCase()))) {
    return 'Choose a respectful topic without abusive or explicit language.'
  }

  const misspelledWord = words.find((word) => !recognizedAcronyms.has(word.toUpperCase()) && !englishSpellcheck.correct(word) && !englishSpellcheck.correct(word.toLocaleLowerCase()))
  if (misspelledWord) return `“${misspelledWord}” is not in the English dictionary. Check its spelling or try a different topic.`

  return ''
}