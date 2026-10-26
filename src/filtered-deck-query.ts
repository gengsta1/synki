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
