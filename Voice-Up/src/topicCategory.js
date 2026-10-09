const categoryDefinitions = [
  {
    name: 'Nature & Environment',
    keywords: [
      'animal', 'animals', 'octopus', 'octopuses', 'tardigrade', 'coral', 'cetacean',
      'mangrove', 'bee', 'bees', 'butterfl', 'penguin', 'jellyfish', 'spider', 'zebra',
      'bird', 'whale', 'dolphin', 'forest', 'rainforest', 'ecosystem', 'mycorrhiz',
      'permacculture', 'permaculture', 'wetland', 'river', 'ocean', 'reef', 'kelp',
      'glacier', 'iceberg', 'desert', 'volcano', 'waterfall', 'seed', 'plant', 'tree',
      'weather', 'climate', 'migration', 'hibernation', 'bioluminescence', 'fog',
      'aurora', 'rainbow', 'snowflake', 'nature', 'wildlife', 'conservation',
      'recycling', 'renewable energy', 'wind farm', 'solar power', 'agrivoltaic',
      'albedo', 'anthocyanin', 'magnetoreception', 'green space', 'garden',
      'sustainability', 'pollution', 'water', 'food', 'agriculture', 'farming',
    ],
  },
  {
    name: 'Science & Space',
    keywords: [
      'science', 'biology', 'chemistry', 'physics', 'astronomy', 'black hole', 'comet',
      'eclipse', 'planet', 'gravity', 'meteor', 'space', 'stargazing', 'telescope',
      'crisp', 'nitinol', 'placebo', 'genetic', 'medicine', 'health', 'mathemat',
      'algorithm', 'robot', 'technology', 'invention', 'engineering', 'satellite',
      'artificial intelligence', 'computer', 'data', 'innovation', 'nanotech',
      'internet', 'smartphone', 'electric', 'energy', 'machine', 'spacecraft',
      'discovery', 'experiment', 'research', 'neuroscience', 'brain', 'sound',
      'light', 'quantum', 'material', 'invention', 'medicine', 'nutrition',
    ],
  },
  {
    name: 'History & Archaeology',
    keywords: [
      'history', 'historical', 'ancient', 'archaeolog', 'antikythera', 'voynich',
      'cahokia', 'gutenberg', 'fossil', 'dinosaur', 'cave painting', 'civilization',
      'artifact', 'library', 'lighthouse', 'museum', 'past', 'heritage',
      'empire', 'kingdom', 'revolution', 'exploration', 'invention history',
    ],
  },
  {
    name: 'Arts & Culture',
    keywords: [
      'art', 'culture', 'architecture', 'storytelling', 'language', 'literature',
      'music', 'theater', 'theatre', 'film', 'painting', 'design', 'book', 'myth',
      'tradition', 'world language', 'cartography',
      'poetry', 'dance', 'creative', 'photography', 'craft', 'fashion',
      'folklore', 'novel', 'story', 'pozzolana',
    ],
  },
  {
    name: 'People & Society',
    keywords: [
      'people', 'society', 'community', 'cooperation', 'education', 'psychology',
      'dream', 'philosophy', 'ethic', 'communication', 'relationship', 'family',
      'workplace', 'leadership', 'econom', 'politic', 'law', 'justice', 'fairness',
      'culture of', 'everyday life', 'perspective', 'learning', 'public speaking',
      'friendship', 'community', 'city', 'cities', 'school', 'teacher', 'student',
      'decision', 'habit', 'memory', 'confidence', 'team', 'business', 'money',
      'problem solving', 'wellbeing', 'well-being', 'sports', 'game', 'games',
    ],
  },
  {
    name: 'Places & Geography',
    keywords: [
      'geography', 'mountain', 'island', 'continent', 'country', 'city', 'cave',
      'national park', 'island', 'map', 'travel', 'coast', 'landscape', 'cahokia',
      'poz zolana', 'pozzolana', 'floating garden', 'neighborhood', 'village',
      'border', 'capital', 'architecture', 'cartography',
    ],
  },
]

export const TOPIC_CATEGORIES = categoryDefinitions.map(({ name }) => name)

export function isTopicCategory(category) {
  return TOPIC_CATEGORIES.includes(category)
}

const generatedTopicPrefixes = [
  /^the history of /i,
  /^the science behind /i,
  /^the future of /i,
  /^the role of (.+?) in everyday life$/i,
  /^(.+?) around the world$/i,
  /^(.+?) in art and culture$/i,
  /^the connection between (.+?) and (?:nature|technology)$/i,
  /^how people learn about /i,
  /^interesting facts about /i,
  /^new discoveries related to /i,
  /^the impact of (.+?) on communities$/i,
  /^exploring /i,
  /^what makes (.+?) fascinating$/i,
  /^different perspectives on /i,
  /^how (.+?) connect to daily life$/i,
  /^lessons we can learn from /i,
  /^challenges and opportunities in /i,
  /^the importance of /i,
  /^an introduction to /i,
]

function getTopicCore(topic) {
  const normalized = topic.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
  for (const prefix of generatedTopicPrefixes) {
    const match = normalized.match(prefix)
    if (match) return match[1] || normalized.replace(prefix, '').trim()
  }
  return normalized
}

export function categorizeTopic(topic) {
  const core = getTopicCore(topic)
  const matches = categoryDefinitions
    .map(({ name, keywords }) => ({
      name,
      score: keywords.reduce((count, keyword) => count + (core.includes(keyword) ? 1 : 0), 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  return matches[0]?.name || 'General Topics'
}

export function getTopicCategory(topic, overrides = {}, fallback = '') {
  const key = topic.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
  const override = overrides[key]
  return isTopicCategory(override) ? override : fallback || categorizeTopic(topic)
}
