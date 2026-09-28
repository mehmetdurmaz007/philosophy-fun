import type { PhilosopherData, QuestionnaireData, TraditionData } from './types'

async function fetchSegmentedGzipJson<T>(stem: string, count: number): Promise<T> {
  const segments = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      fetch(`./data/runtime/${stem}-${String(i).padStart(2, '0')}.b64`).then(async response => {
        if (!response.ok) throw new Error(`Could not load ${stem} segment ${i}: ${response.status}`)
        return response.text()
      })
    )
  )
  const binary = atob(segments.join(''))
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  if (!('DecompressionStream' in window)) throw new Error('This browser is too old for the alpha data loader.')
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).json() as T
}

export async function loadAppData() {
  const [questionnaire, philosophers, traditions] = await Promise.all([
    fetchSegmentedGzipJson<QuestionnaireData>('questionnaire-v2', 8),
    fetchSegmentedGzipJson<PhilosopherData>('philosophers-v2', 8),
    fetchSegmentedGzipJson<TraditionData>('traditions-v2', 10)
  ])
  return { questionnaire, philosophers, traditions }
}