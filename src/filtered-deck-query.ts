export type FilteredDeckState =
	| 'all'
	| 'due'
	| 'new'
	| 'learning'
	| 'review'
	| 'overdue'
	| 'ahead'

export type FilteredDeckOptions = {
	additionalSearch: string
	flag: string
	state: FilteredDeckState
	tag: string
}

export type DeckState = { deckName: string, state: FilteredDeckState }

const STATE_TERMS: Record<FilteredDeckState, string> = {
	all: '',
	due: 'is:due',
	new: 'is:new',
	learning: 'is:learn',
	review: 'is:review',
	overdue: 'is:due prop:due<=-1',
	ahead: 'prop:due>=1',
}

function quoteDeckName(deckName: string): string {
	return `deck:"${deckName.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

/**
 * Builds a dynamic, deck-based Anki query from Obsidian's TARGET DECK values.
 * A parent-deck term also includes every one of its subdecks in Anki.
 */
export function buildFilteredDeckQuery(deckNames: readonly string[], options: FilteredDeckOptions): string {
	const uniqueDecks = [...new Set(deckNames.map((deck) => deck.trim()).filter(Boolean))]
		.sort((left, right) => left.localeCompare(right, 'de'))
	const roots = uniqueDecks.filter((deck) => !uniqueDecks.some((other) => other !== deck && deck.startsWith(`${other}::`)))
	if (roots.length === 0) return ''

	const scope = roots.length === 1 ? quoteDeckName(roots[0]!) : `(${roots.map(quoteDeckName).join(' or ')})`
	const terms = [scope, STATE_TERMS[options.state]]
	const tag = options.tag.trim()
	if (tag) terms.push(`"tag:${tag.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`)
	if (/^[0-7]$/u.test(options.flag)) terms.push(`flag:${options.flag}`)
	if (options.additionalSearch.trim()) terms.push(`(${options.additionalSearch.trim()})`)
	return terms.filter(Boolean).join(' ')
}

/** Build one status clause per deck, then apply the optional filters to the whole selection. */
export function buildFilteredDeckQueryByState(decks: readonly DeckState[], options: FilteredDeckOptions): string {
	const states = new Map<string, FilteredDeckState>()
	for (const { deckName, state } of decks) {
		if (deckName.trim()) states.set(deckName.trim(), state)
	}
	if (states.size === 0) return ''

	const names = [...states.keys()].sort((left, right) => left.localeCompare(right, 'de'))
	const clauses = names.filter((name) => {
		const parent = names.filter((candidate) => name.startsWith(`${candidate}::`)).at(-1)
		return parent === undefined || states.get(parent) !== states.get(name)
	}).map((name) => {
		const descendants = names.filter((other) => other.startsWith(`${name}::`) && states.get(other) !== states.get(name))
			.filter((other) => !names.some((between) => between !== other && between !== name && other.startsWith(`${between}::`) && between.startsWith(`${name}::`) && states.get(between) !== states.get(name)))
		const terms = [quoteDeckName(name), ...descendants.map((child) => `-${quoteDeckName(child)}`), STATE_TERMS[states.get(name)!]]
		return `(${terms.filter(Boolean).join(' ')})`
	})
	const scope = clauses.length === 1 ? clauses[0]! : `(${clauses.join(' or ')})`
	const terms = [scope]
	const tag = options.tag.trim()
	if (tag) terms.push(`"tag:${tag.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`)
	if (/^[0-7]$/u.test(options.flag)) terms.push(`flag:${options.flag}`)
	if (options.additionalSearch.trim()) terms.push(`(${options.additionalSearch.trim()})`)
	return terms.join(' ')
}
