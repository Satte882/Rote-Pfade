import { describe, expect, it } from 'vitest'
import { answerGuides, getAnswerGuide } from '../data/answer-guides'
import { threads } from './classifier'

describe('final answer guides', () => {
  it('covers every red thread exactly once', () => {
    const threadIds = threads.map((thread) => thread.id).sort()
    const guideIds = Object.keys(answerGuides).sort()

    expect(guideIds).toEqual(threadIds)
  })

  it('provides a decisive checkpoint and compact conversation path for every thread', () => {
    for (const thread of threads) {
      const guide = getAnswerGuide(thread.id)

      expect(guide.checkpoint.trim().length).toBeGreaterThan(20)
      expect(guide.conversationSteps.length).toBeGreaterThanOrEqual(4)
      expect(guide.recognitionExamples.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('keeps problem/störung and decision as different thinking operations', () => {
    expect(getAnswerGuide('problem-stoerung').conversationSteps).toEqual([
      'Symptom',
      'Ursache',
      'Maßnahme',
      'Wirkung',
    ])
    expect(getAnswerGuide('entscheidung').conversationSteps).toEqual([
      'Kriterien',
      'Optionen',
      'Abwägung',
      'Entscheidung',
    ])
  })

  it('encodes the final spoken answer schema in the UI layer, not as another red-thread step', () => {
    expect(getAnswerGuide('wirkung').conversationSteps).toEqual([
      'Baseline',
      'KPI',
      'Messung',
      'Business Value',
    ])
  })
})
