import { Modal, Notice, TFile } from 'obsidian'
import type SynkiPlugin from './main'
import { buildFilteredDeckQueryByState, type FilteredDeckOptions, type FilteredDeckState } from './filtered-deck-query'
import { parseSynkiDocument } from './synki-parser'

type SelectableNote = {
	cardCount: number
	deckNames: string[]
	file: TFile
}

const STATE_CHOICES: Array<[FilteredDeckState, string]> = [
	['all', 'All available cards'],
	['due', 'Due today'],
	['new', 'New cards only'],
	['learning', 'Learning cards'],
	['review', 'Review cards'],
	['overdue', 'Overdue cards'],
	['ahead', 'Due in the future'],
]

export class FilteredDeckModal extends Modal {
	private readonly selected = new Set<string>()
	private readonly deckStates = new Map<string, FilteredDeckState>()
	private readonly options: FilteredDeckOptions = { additionalSearch: '', flag: '', state: 'all', tag: '' }
	private applyStateToAll = false
	private notes: SelectableNote[] = []
	private filter = ''
	private list!: HTMLElement
	private output!: HTMLTextAreaElement
	private summary!: HTMLElement

	public constructor(plugin: SynkiPlugin) {
		super(plugin.app)
	}

	public override onOpen(): void {
		void this.loadNotes()
	}

	private async loadNotes(): Promise<void> {
		this.contentEl.empty()
		this.contentEl.addClass('synki-filter-modal')
		this.contentEl.createEl('h2', { text: 'Filtered deck generator' })
		this.contentEl.createEl('p', {
			text: 'Select master notes. The query uses their TARGET DECK values and stays dynamic in Anki.',
		})
		const files = this.app.vault.getMarkdownFiles().filter((file) => isMainNote(file.path))
		const notes = await Promise.all(files.map(async (file) => {
			const parsed = parseSynkiDocument(await this.app.vault.read(file))
			const deckNames = parsed.targetDeck === null ? [] : [parsed.targetDeck]
			const cardCount = parsed.cards.reduce((total, card) => total + expectedAnkiCardCount(card.fields.Text ?? ''), 0)
			return { cardCount, deckNames, file }
		}))
		this.notes = notes.sort((a, b) => a.file.basename.localeCompare(b.file.basename, 'de'))
		this.render()
	}

	private render(): void {
		const search = this.contentEl.createEl('input', { type: 'search', placeholder: 'Search notes…' })
		search.addClass('synki-filter-search')
		search.value = this.filter
		search.addEventListener('input', () => { this.filter = search.value.trim().toLocaleLowerCase('en'); this.renderList() })
		const actions = this.contentEl.createDiv({ cls: 'synki-filter-actions' })
		const selectVisible = actions.createEl('button', { text: 'Select visible' })
		selectVisible.addEventListener('click', () => {
			for (const note of this.visibleNotes()) if (note.deckNames.length > 0 && note.cardCount > 0) this.selected.add(note.file.path)
			this.renderList(); this.refreshQuery()
		})
		const reset = actions.createEl('button', { text: 'Reset' })
		reset.addEventListener('click', () => {
			this.selected.clear(); this.deckStates.clear(); this.applyStateToAll = false
			this.options.state = 'all'; this.options.tag = ''
			this.options.flag = ''; this.options.additionalSearch = ''
			this.filter = ''; this.contentEl.empty(); this.render()
		})
		this.list = this.contentEl.createDiv({ cls: 'synki-filter-list' })
		this.renderList()

		const controls = this.contentEl.createDiv({ cls: 'synki-filter-options' })
		const applyLabel = controls.createEl('label', { cls: 'synki-filter-apply-all' })
		const applyAll = applyLabel.createEl('input', { type: 'checkbox' })
		applyAll.checked = this.applyStateToAll
		applyLabel.createSpan({ text: 'Apply card status to all selected decks' })
		applyAll.addEventListener('change', () => {
			this.applyStateToAll = applyAll.checked
			this.renderList(); this.refreshQuery()
		})
		const stateLabel = controls.createEl('label', { text: 'Card status for all decks' })
		const state = stateLabel.createEl('select')
		for (const [value, label] of STATE_CHOICES) {
			const option = state.createEl('option', { text: label, value })
			option.selected = value === this.options.state
		}
		state.disabled = !this.applyStateToAll
		applyAll.addEventListener('change', () => { state.disabled = !this.applyStateToAll })
		state.addEventListener('change', () => { this.options.state = state.value as FilteredDeckState; this.refreshQuery() })
		const tagLabel = controls.createEl('label', { text: 'Tag (optional)' })
		const tag = tagLabel.createEl('input', { type: 'text', placeholder: 'e.g. high_yield' })
		tag.value = this.options.tag
		tag.addEventListener('input', () => { this.options.tag = tag.value; this.refreshQuery() })
		const flagLabel = controls.createEl('label', { text: 'Flag (optional)' })
		const flag = flagLabel.createEl('select')
		for (const [value, label] of [['', 'Any'], ['0', 'None'], ['1', 'Red'], ['2', 'Orange'], ['3', 'Green'], ['4', 'Blue'], ['5', 'Pink'], ['6', 'Turquoise'], ['7', 'Purple']]) {
			const option = flag.createEl('option', { text: label, value })
			option.selected = value === this.options.flag
		}
		flag.addEventListener('change', () => { this.options.flag = flag.value; this.refreshQuery() })
		const extraLabel = controls.createEl('label', { text: 'Additional Anki search terms (optional)' })
		const extra = extraLabel.createEl('input', { type: 'text', placeholder: 'e.g. prop:lapses>3' })
		extra.value = this.options.additionalSearch
		extra.addEventListener('input', () => { this.options.additionalSearch = extra.value; this.refreshQuery() })

		this.summary = this.contentEl.createEl('p', { cls: 'synki-filter-summary' })
		this.output = this.contentEl.createEl('textarea', { cls: 'synki-filter-query' })
		this.output.readOnly = true
		this.output.setAttribute('aria-label', 'Anki search query')
		const copy = this.contentEl.createEl('button', { text: 'Copy search query' })
		copy.addClass('mod-cta')
		copy.addEventListener('click', () => { void this.copyQuery() })
		this.contentEl.createEl('p', {
			text: 'In Anki: Tools → Create Filtered Deck. Paste the query, then choose a limit and order. Suspended, buried, or already filtered cards may be unavailable. This generator does not sync cards.',
			cls: 'synki-filter-help',
		})
		this.refreshQuery()
	}

	private visibleNotes(): SelectableNote[] {
		return this.notes.filter((note) => note.file.basename.toLocaleLowerCase('en').includes(this.filter))
	}

	private renderList(): void {
		this.list.empty()
		for (const note of this.visibleNotes()) {
			const row = this.list.createDiv({ cls: 'synki-filter-row' })
			const noteLabel = row.createEl('label')
			const check = noteLabel.createEl('input', { type: 'checkbox' })
			check.checked = this.selected.has(note.file.path)
			check.disabled = note.deckNames.length === 0 || note.cardCount === 0
			check.addEventListener('change', () => {
				if (check.checked) this.selected.add(note.file.path)
				else this.selected.delete(note.file.path)
				this.refreshQuery()
			})
			noteLabel.createSpan({ text: note.deckNames.length > 0 && note.cardCount > 0
				? `${note.file.basename} (${note.cardCount} source cards) · ${note.deckNames.join(', ')}`
				: `${note.file.basename} (no complete Anki section)` })
			if (note.deckNames.length > 0 && note.cardCount > 0) {
				const state = row.createEl('select', { cls: 'synki-filter-deck-state' })
				state.setAttribute('aria-label', `Card status for ${note.deckNames[0]}`)
				const deckName = note.deckNames[0]!
				for (const [value, label] of STATE_CHOICES) {
					const option = state.createEl('option', { text: label, value })
					option.selected = value === (this.deckStates.get(deckName) ?? 'all')
				}
				state.disabled = this.applyStateToAll
				state.addEventListener('change', () => {
					this.deckStates.set(deckName, state.value as FilteredDeckState)
					this.selected.add(note.file.path)
					this.renderList(); this.refreshQuery()
				})
			}
		}
		if (this.visibleNotes().length === 0) this.list.createEl('p', { text: 'No matching master notes found.' })
	}

	private refreshQuery(): void {
		const selected = this.notes.filter((note) => this.selected.has(note.file.path))
		const deckNames = selected.flatMap((note) => note.deckNames)
		const cardCount = selected.reduce((total, note) => total + note.cardCount, 0)
		this.output.value = buildFilteredDeckQueryByState([...new Set(deckNames)].map((deckName) => ({
			deckName,
			state: this.applyStateToAll ? this.options.state : (this.deckStates.get(deckName) ?? 'all'),
		})), this.options)
		this.summary.textContent = `${selected.length} notes · ${cardCount} source cards · ${new Set(deckNames).size} decks`
	}

	private async copyQuery(): Promise<void> {
		if (!this.output.value) { new Notice('Select at least one note first.'); return }
		try {
			await navigator.clipboard.writeText(this.output.value)
			new Notice('Anki search query copied.')
		} catch {
			this.output.focus(); this.output.select()
			new Notice('Could not copy automatically. The query is selected for manual copying.')
		}
	}
}

function expectedAnkiCardCount(text: string): number {
	const clozeNumbers = new Set([...text.matchAll(/\{\{c(\d+)::/giu)].map((match) => match[1]))
	return Math.max(1, clozeNumbers.size)
}

function isMainNote(path: string): boolean {
	return path.startsWith('6 - Main Notes/') || path.includes('/6 - Main Notes/')
}
