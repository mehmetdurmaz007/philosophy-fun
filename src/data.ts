import type { PhilosopherData, QuestionnaireData, TraditionData } from './types'

export const DATA_FILES = {
  questionnaire: Array.from({ length: 8 }, (_, i) => `questionnaire-v2-${String(i).padStart(2, '0')}.b64`),
  philosophers: [
    'p00-0.b64','p0010-0.b64','p0010-1.b64','p00-2.b64',
    'p01-0.b64','p01-1.b64','p01-2.b64',
    ...Array.from({ length: 6 }, (_, i) => `philosophers-v2-${String(i + 2).padStart(2, '0')}.b64`)
  ],
  traditions: [
    'traditions-v2-00.b64',
    't01000-0.b64','t010001-0.b64','t010001-1.b64','t01-0-1.b64','t01-1.b64','t01-2.b64',
    ...Array.from({ length: 8 }, (_, i) => `traditions-v2-${String(i + 2).padStart(2, '0')}.b64`)
  ]
} as const

async function fetchFilesGzipJson<T>(files: readonly string[]): Promise<T> {
  const segments = await Promise.all(
    files.map(file => fetch(`./data/runtime/${file}`).then(async response => {
      if (!response.ok) throw new Error(`Could not load runtime data ${file}: ${response.status}`)
      return response.text()
    }))
  )
  const binary = atob(segments.join(''))
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  if (!('DecompressionStream' in window)) throw new Error('This browser is too old for the alpha data loader.')
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).json() as T
}

export async function loadAppData() {
  const [questionnaire, philosophers, traditions] = await Promise.all([
    fetchFilesGzipJson<QuestionnaireData>(DATA_FILES.questionnaire),
    fetchFilesGzipJson<PhilosopherData>(DATA_FILES.philosophers),
    fetchFilesGzipJson<TraditionData>(DATA_FILES.traditions)
  ])
  return { questionnaire, philosophers, traditions }
}