import { describe, expect, it } from 'vitest'
import { managementLevers, managementTrainingCases } from '../data/management-training'
import { threads } from './classifier'
import { createTrainingQuestion } from './training'

describe('management training data', () => {
  it('defines exactly eight unique management levers', () => {
    const ids = managementLevers.map((lever) => lever.id)
    expect(managementLevers).toHaveLength(8)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('contains 30 unique training cases with valid thread and lever references', () => {
    const prompts = managementTrainingCases.map((trainingCase) => trainingCase.prompt)
    const threadIds = new Set(threads.map((thread) => thread.id))
    const leverIds = new Set(managementLevers.map((lever) => lever.id))

    expect(managementTrainingCases).toHaveLength(30)
    expect(new Set(prompts).size).toBe(prompts.length)

    for (const trainingCase of managementTrainingCases) {
      expect(threadIds.has(trainingCase.threadId)).toBe(true)
      expect(leverIds.has(trainingCase.leverId)).toBe(true)
      expect(trainingCase.rationale.trim().length).toBeGreaterThan(20)
    }
  })

  it('uses every management lever in the training pool', () => {
    const usedLeverIds = new Set(managementTrainingCases.map((trainingCase) => trainingCase.leverId))
    for (const lever of managementLevers) {
      expect(usedLeverIds.has(lever.id)).toBe(true)
    }
  })
})

describe('createTrainingQuestion', () => {
  it('returns four thread options and four lever options including both correct answers', () => {
    const question = createTrainingQuestion(threads)

    expect(question.options).toHaveLength(4)
    expect(new Set(question.options.map((thread) => thread.id)).size).toBe(4)
    expect(question.options.some((thread) => thread.id === question.correctThread.id)).toBe(true)

    expect(question.leverOptions).toHaveLength(4)
    expect(new Set(question.leverOptions.map((lever) => lever.id)).size).toBe(4)
    expect(question.leverOptions.some((lever) => lever.id === question.correctLever.id)).toBe(true)
    expect(question.rationale.length).toBeGreaterThan(20)
  })

  it('does not immediately repeat the previous prompt when alternatives exist', () => {
    const first = createTrainingQuestion(threads)
    const second = createTrainingQuestion(threads, first.prompt)

    expect(second.prompt).not.toBe(first.prompt)
  })
})
