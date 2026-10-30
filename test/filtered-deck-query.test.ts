import { describe, expect, test } from 'vitest'
import { buildFilteredDeckQuery, buildFilteredDeckQueryByState } from '../src/filtered-deck-query'

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

describe('buildFilteredDeckQueryByState', () => {
	test('uses each selected deck\'s card status', () => {
		expect(buildFilteredDeckQueryByState([
			{ deckName: 'Innere::Diagnosen::Aszites', state: 'new' },
			{ deckName: 'Innere::Diagnosen::Hepatitis', state: 'due' },
		], defaultOptions)).toBe('((deck:"Innere::Diagnosen::Aszites" is:new) or (deck:"Innere::Diagnosen::Hepatitis" is:due))')
	})

	test('applies shared filters to the entire deck selection', () => {
		expect(buildFilteredDeckQueryByState([
			{ deckName: 'A', state: 'new' }, { deckName: 'B', state: 'due' },
		], { ...defaultOptions, tag: 'high_yield', flag: '2' }))
			.toBe('((deck:"A" is:new) or (deck:"B" is:due)) "tag:high_yield" flag:2')
	})

	test('keeps nested decks with different statuses separate', () => {
		expect(buildFilteredDeckQueryByState([
			{ deckName: 'A', state: 'all' },
			{ deckName: 'A::B', state: 'new' },
			{ deckName: 'A::B::C', state: 'due' },
		], defaultOptions)).toBe('((deck:"A" -deck:"A::B") or (deck:"A::B" -deck:"A::B::C" is:new) or (deck:"A::B::C" is:due))')
	})

	test('uses a shared state for duplicate deck names', () => {
		expect(buildFilteredDeckQueryByState([
			{ deckName: 'A', state: 'new' }, { deckName: 'A', state: 'new' },
		], defaultOptions)).toBe('(deck:"A" is:new)')
	})
})
