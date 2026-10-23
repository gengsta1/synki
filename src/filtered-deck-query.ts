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

/** Exact Anki note IDs avoid accidentally including another note in the same deck. */
export function buildFilteredDeckQuery(noteIds: readonly string[], options: FilteredDeckOptions): string {
	const ids = [...new Set(noteIds.filter((id) => /^\d+$/u.test(id)))]
	if (ids.length === 0) return ''

	const scope = ids.length === 1 ? `nid:${ids[0]}` : `(${ids.map((id) => `nid:${id}`).join(' or ')})`
	const terms = [scope, STATE_TERMS[options.state]]
	const tag = options.tag.trim()
	if (tag) terms.push(`"tag:${tag.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`)
	if (/^[0-7]$/u.test(options.flag)) terms.push(`flag:${options.flag}`)
	if (options.additionalSearch.trim()) terms.push(`(${options.additionalSearch.trim()})`)
	return terms.filter(Boolean).join(' ')
}
