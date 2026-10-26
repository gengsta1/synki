import { describe, expect, test } from 'vitest'
import { buildFilteredDeckQuery } from '../src/filtered-deck-query'

const defaultOptions = { additionalSearch: '', flag: '', state: 'all' as const, tag: '' }

describe('buildFilteredDeckQuery', () => {
	test('uses a dynamic Anki deck query instead of frozen note IDs', () => {
		expect(buildFilteredDeckQuery(['Chirurgie::Diagnosen::Drainagen'], defaultOptions))
			.toBe('deck:"Chirurgie::Diagnosen::Drainagen"')
	})

	test('collapses selected subdecks under an included parent deck', () => {
		expect(buildFilteredDeckQuery([
			'Chirurgie::Operationstechnik::Narben',
			'Chirurgie::Operationstechnik::Narben::Bauchwandanatomie',
		], defaultOptions)).toBe('deck:"Chirurgie::Operationstechnik::Narben"')
	})

	test('combines distinct decks with optional Anki conditions', () => {
		expect(buildFilteredDeckQuery(['Innere::Diagnosen::Zöliakie', 'Psychiatrie::Depressionen'], {
		additionalSearch: 'prop:lapses>3', flag: '2', state: 'new', tag: 'high_yield',
	})).toBe('(deck:"Innere::Diagnosen::Zöliakie" or deck:"Psychiatrie::Depressionen") is:new "tag:high_yield" flag:2 (prop:lapses>3)')
	})
})
