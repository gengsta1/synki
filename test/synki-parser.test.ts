import { describe, expect, test } from 'vitest'
import { DEFAULT_SYNKI_PARSER_OPTIONS, insertSyncedNoteIds, parseSynkiDocument, splitTags } from '../src/synki-parser'

const sample = `# Cushing-Syndrom

Lerntext.

## Anki

TARGET DECK: Medicine::Diagnoses::Example
FILE TAGS: medicine example

START
Cloze_obsidian
Text: Beim zentralen Cushing kann hochdosiertes Dexamethason das Serumcortisol um mindestens {{c1::50 %::Grenzwert}} supprimieren.
Back Extra: Diese partielle Suppressibilität ist diagnostisch hilfreich.
Definitionen:
Mechanismus:
Klinik:
Dosis: zweimal 8 mg Dexamethason nachts.
Cave:
Merksprüche: Zentral lässt sich noch bremsen.
Eigene Prüfungsfragen: Wie verhält sich der Test bei ektoper ACTH-Produktion?
Symptombild: ![[Cushing-Syndrom.jpeg]]
One by one:
Tags: medicine example diagnosis
END
`

describe('synki parser', () => {
	test('splits tags from spaces and commas', () => {
		expect(splitTags('a b, c a')).toEqual(['a', 'b', 'c'])
	})

	test('parses the embedded Synki block format', () => {
		const parsed = parseSynkiDocument(sample)

		expect(parsed.errors).toEqual([])
		expect(parsed.targetDeck).toBe('Medicine::Diagnoses::Example')
		expect(parsed.fileTags).toEqual(['medicine', 'example'])
		expect(parsed.cards).toHaveLength(1)
		expect(parsed.cards[0]?.modelName).toBe('Cloze_obsidian')
		expect(parsed.cards[0]?.fields.Text).toContain('{{c1::50 %::Grenzwert}}')
		expect(parsed.cards[0]?.fields['Back Extra']).toContain('partielle')
		expect(parsed.cards[0]?.fields.Dosis).toBe('zweimal 8 mg Dexamethason nachts.')
		expect(parsed.cards[0]?.fields.Symptombild).toBe('![[Cushing-Syndrom.jpeg]]')
		expect(parsed.cards[0]?.tags).toEqual(['medicine', 'example', 'diagnosis'])
	})

	test('reads and writes stable Anki note ids', () => {
		const withExistingId = parseSynkiDocument(`${sample}<!--ANKI-NOTE-ID: 1741234567890-->`)
		expect(withExistingId.cards[0]?.noteId).toBe('1741234567890')

		const parsed = parseSynkiDocument(sample)
		const card = parsed.cards[0]
		expect(card).toBeDefined()

		const updated = insertSyncedNoteIds(sample, [{ card: card!, noteId: '1741234567890' }])
		expect(updated).toContain('END\n<!--ANKI-NOTE-ID: 1741234567890-->')
	})

	test('normalizes common Cloze_obsidian model and field aliases', () => {
		const parsed = parseSynkiDocument(`## Anki
TARGET DECK: Medicine::Diagnoses::Example

START
Cloze
Text: {{c1::answer::hint}}
Definitions: English field label
Mechanism: English mechanism
Dose: English dose
END
`)

		expect(parsed.errors).toEqual([])
		expect(parsed.cards[0]?.modelName).toBe('Cloze_obsidian')
		expect(parsed.cards[0]?.fields.Definitionen).toBe('English field label')
		expect(parsed.cards[0]?.fields.Mechanismus).toBe('English mechanism')
		expect(parsed.cards[0]?.fields.Dosis).toBe('English dose')
	})

	test('preserves multiline learning modes with the legacy medical field configuration', () => {
		const parsed = parseSynkiDocument(`## Anki
TARGET DECK: Medicine::M3

START
Cloze_obsidian
Text: Welche Diagnostik ist entscheidend? {{c1::Koloskopie}}
Thema: Morbus Crohn
Hint: Denke an die Endoskopie.
Mündliche Präsentation: Zuerst beschreibe ich die Beschwerden.
Clinical algorithm:
Ersteinschätzung | Was ist akut gefährlich? | Peritonitis ausschließen | Bei Abwehrspannung sofort chirurgisch vorstellen.
Diagnostik | Welche Untersuchung bestätigt den Verdacht? | Ileokoloskopie mit Biopsien
Oberarzt mode:
Diagnostik | Was zeigt die Histologie? | Eine diskontinuierliche chronische Entzündung.
Diagnostik | Was schließt ein unauffälliges CRP nicht aus? | Eine aktive Entzündung.
One by one: true
END
`, {
			...DEFAULT_SYNKI_PARSER_OPTIONS,
			fields: ['Text', 'Back Extra', 'One by one'],
		})

		expect(parsed.errors).toEqual([])
		expect(parsed.cards[0]?.fields.Thema).toBe('Morbus Crohn')
		expect(parsed.cards[0]?.fields.Hint).toBe('Denke an die Endoskopie.')
		expect(parsed.cards[0]?.fields['Mündliche Präsentation']).toContain('beschreibe')
		expect(parsed.cards[0]?.fields['Klinischer Algorithmus']).toContain('Diagnostik | Welche')
		expect(parsed.cards[0]?.fields['Oberarzt-Modus']).toContain('Was schließt')
		expect(parsed.cards[0]?.fields['One by one']).toBe('true')
	})
})
