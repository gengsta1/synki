import back from './anki-templates/back.html?raw'
import front from './anki-templates/front.html?raw'
import css from './anki-templates/style.txt?raw'

export const MEDICAL_FRONT_TEMPLATE = front
export const MEDICAL_BACK_TEMPLATE = back
export const MEDICAL_STYLING = css

// Tags is an Anki special field; all other placeholders must exist on the note type.
export const MEDICAL_TEMPLATE_FIELDS = [
	'Text',
	'Thema',
	'Hint',
	'Back Extra',
	'Definitionen',
	'Mechanismus',
	'Klinik',
	'Dosis',
	'Cave',
	'Merksprüche',
	'Eigene Prüfungsfragen',
	'Symptombild',
	'Q&A',
	'Klinischer Algorithmus',
	'Oberarzt-Modus',
	'One by one',
	'Ankinotiz',
] as const

const MEDICAL_SIGNATURE_FIELDS = [
	'Mechanismus',
	'Klinik',
	'Dosis',
	'Cave',
	'Merksprüche',
	'Eigene Prüfungsfragen',
	'Symptombild',
]

export function usesMedicalTemplate(profile: string, configuredFields: string[]): boolean {
	if (profile === 'medical-clinical') return true
	if (profile === 'international-affairs-master') return false
	const fields = new Set(configuredFields)
	return MEDICAL_SIGNATURE_FIELDS.every((field) => fields.has(field))
}
