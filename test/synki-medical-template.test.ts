import { describe, expect, test } from 'vitest'
import { CLOZE_OBSIDIAN_FIELDS } from '../src/synki-parser'
import {
	MEDICAL_BACK_TEMPLATE,
	MEDICAL_FRONT_TEMPLATE,
	MEDICAL_STYLING,
	MEDICAL_TEMPLATE_FIELDS,
	usesMedicalTemplate,
} from '../src/synki-medical-template'

describe('medical Anki template', () => {
	test('selects medical cards without replacing the international affairs profile', () => {
		expect(usesMedicalTemplate('medical-clinical', [])).toBe(true)
		expect(usesMedicalTemplate('international-affairs-master', MEDICAL_TEMPLATE_FIELDS.slice())).toBe(false)
		expect(usesMedicalTemplate('custom', MEDICAL_TEMPLATE_FIELDS.slice())).toBe(true)
		expect(usesMedicalTemplate('custom', ['Text', 'Back Extra', 'One by one'])).toBe(false)
	})

	test('includes the current learning modes and their required fields', () => {
		expect(MEDICAL_FRONT_TEMPLATE).toContain('{{#Thema}}')
		expect(MEDICAL_BACK_TEMPLATE).toContain('data-learn="algorithm"')
		expect(MEDICAL_BACK_TEMPLATE).toContain('data-learn="oberarzt"')
		expect(MEDICAL_BACK_TEMPLATE).toContain('data-learn="qa"')
		expect(MEDICAL_BACK_TEMPLATE).toContain('number === 3 && qaQuestions.length')
		expect(MEDICAL_BACK_TEMPLATE).toContain('id="learning-menu-button"')
		expect(MEDICAL_BACK_TEMPLATE).toContain('window.obsidianReviewAction')
		expect(MEDICAL_BACK_TEMPLATE).toContain('function userJs8()')
		expect(MEDICAL_BACK_TEMPLATE).not.toContain('Antworte mündlich, dann decke die Lösung auf.')
		expect(MEDICAL_STYLING).toContain('.topic-label')
		expect(MEDICAL_TEMPLATE_FIELDS).toContain('Klinischer Algorithmus')
		expect(MEDICAL_TEMPLATE_FIELDS).toContain('Oberarzt-Modus')
		expect(MEDICAL_TEMPLATE_FIELDS).toContain('Q&A')
		expect(MEDICAL_TEMPLATE_FIELDS).toContain('Ankinotiz')
		expect(MEDICAL_TEMPLATE_FIELDS).not.toContain('Mündliche Präsentation')
		expect(new Set(MEDICAL_TEMPLATE_FIELDS.filter((field) => field !== 'Ankinotiz')))
			.toEqual(new Set(CLOZE_OBSIDIAN_FIELDS))
	})
})
