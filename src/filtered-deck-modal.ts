import { Modal, Notice, TFile } from 'obsidian'
import type SynkiPlugin from './main'
import { buildFilteredDeckQuery, type FilteredDeckOptions, type FilteredDeckState } from './filtered-deck-query'
import { parseSynkiDocument } from './synki-parser'

type SelectableNote = {
	file: TFile
	ids: string[]
}

const STATE_CHOICES: Array<[FilteredDeckState, string]> = [
	['all', 'Alle verfügbaren Karten'],
	['due', 'Heute fällig'],
	['new', 'Neu'],
	['learning', 'Im Lernen'],
	['review', 'Wiederholung'],
	['overdue', 'Überfällig'],
	['ahead', 'Künftig fällig'],
]

export class FilteredDeckModal extends Modal {
	private readonly selected = new Set<string>()
	private readonly options: FilteredDeckOptions = { additionalSearch: '', flag: '', state: 'all', tag: '' }
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
		this.contentEl.createEl('h2', { text: 'Filtered Deck aus Hauptnotizen' })
		this.contentEl.createEl('p', {
			text: 'Mehrere Notizen auswählen. Die Suchabfrage verwendet ihre Anki-Notiz-IDs, damit Karten anderer Themen im selben Deck nicht mitkommen.',
		})
		const files = this.app.vault.getMarkdownFiles().filter((file) =>
			file.path.startsWith('6 - Main Notes/'),
		)
		const notes = await Promise.all(files.map(async (file) => {
			const parsed = parseSynkiDocument(await this.app.vault.read(file))
			return { file, ids: parsed.cards.flatMap((card) => card.noteId ? [card.noteId] : []) }
		}))
		this.notes = notes.sort((a, b) => a.file.basename.localeCompare(b.file.basename, 'de'))
		this.render()
	}

	private render(): void {
		const search = this.contentEl.createEl('input', { type: 'search', placeholder: 'Notizen suchen …' })
		search.addClass('synki-filter-search')
		search.addEventListener('input', () => { this.filter = search.value.trim().toLocaleLowerCase('de'); this.renderList() })
		const actions = this.contentEl.createDiv({ cls: 'synki-filter-actions' })
		const selectVisible = actions.createEl('button', { text: 'Sichtbare auswählen' })
		selectVisible.addEventListener('click', () => {
			for (const note of this.visibleNotes()) if (note.ids.length > 0) this.selected.add(note.file.path)
			this.renderList(); this.refreshQuery()
		})
		const reset = actions.createEl('button', { text: 'Zurücksetzen' })
		reset.addEventListener('click', () => {
			this.selected.clear(); this.options.state = 'all'; this.options.tag = ''
			this.options.flag = ''; this.options.additionalSearch = ''
			this.filter = ''; this.contentEl.empty(); this.render()
		})
		this.list = this.contentEl.createDiv({ cls: 'synki-filter-list' })
		this.renderList()

		const controls = this.contentEl.createDiv({ cls: 'synki-filter-options' })
		const stateLabel = controls.createEl('label', { text: 'Kartenstatus' })
		const state = stateLabel.createEl('select')
		for (const [value, label] of STATE_CHOICES) {
			const option = state.createEl('option', { text: label, value })
			option.selected = value === this.options.state
		}
		state.addEventListener('change', () => { this.options.state = state.value as FilteredDeckState; this.refreshQuery() })
		const tagLabel = controls.createEl('label', { text: 'Tag (optional)' })
		const tag = tagLabel.createEl('input', { type: 'text', placeholder: 'z. B. high_yield' })
		tag.value = this.options.tag
		tag.addEventListener('input', () => { this.options.tag = tag.value; this.refreshQuery() })
		const flagLabel = controls.createEl('label', { text: 'Flagge (optional)' })
		const flag = flagLabel.createEl('select')
		for (const [value, label] of [['', 'Alle'], ['0', 'Keine'], ['1', 'Rot'], ['2', 'Orange'], ['3', 'Grün'], ['4', 'Blau'], ['5', 'Rosa'], ['6', 'Türkis'], ['7', 'Violett']]) {
			const option = flag.createEl('option', { text: label, value })
			option.selected = value === this.options.flag
		}
		flag.addEventListener('change', () => { this.options.flag = flag.value; this.refreshQuery() })
		const extraLabel = controls.createEl('label', { text: 'Weitere Anki-Suchbedingungen (optional)' })
		const extra = extraLabel.createEl('input', { type: 'text', placeholder: 'z. B. prop:lapses>3' })
		extra.value = this.options.additionalSearch
		extra.addEventListener('input', () => { this.options.additionalSearch = extra.value; this.refreshQuery() })

		this.summary = this.contentEl.createEl('p', { cls: 'synki-filter-summary' })
		this.output = this.contentEl.createEl('textarea', { cls: 'synki-filter-query' })
		this.output.readOnly = true
		this.output.setAttribute('aria-label', 'Anki-Suchabfrage')
		const copy = this.contentEl.createEl('button', { text: 'Suchabfrage kopieren' })
		copy.addClass('mod-cta')
		copy.addEventListener('click', () => { void this.copyQuery() })
		this.contentEl.createEl('p', {
			text: 'In Anki: Werkzeuge → Gefilterten Stapel erstellen; Abfrage einfügen und Limit/Reihenfolge wählen. Gesperrte, vergrabene oder bereits gefilterte Karten können nicht eingesammelt werden. Notizen ohne Anki-ID zuerst synchronisieren.',
			cls: 'synki-filter-help',
		})
		this.refreshQuery()
	}

	private visibleNotes(): SelectableNote[] {
		return this.notes.filter((note) => note.file.basename.toLocaleLowerCase('de').includes(this.filter))
	}

	private renderList(): void {
		this.list.empty()
		for (const note of this.visibleNotes()) {
			const row = this.list.createEl('label', { cls: 'synki-filter-row' })
			const check = row.createEl('input', { type: 'checkbox' })
			check.checked = this.selected.has(note.file.path)
			check.disabled = note.ids.length === 0
			check.addEventListener('change', () => {
				if (check.checked) this.selected.add(note.file.path)
				else this.selected.delete(note.file.path)
				this.refreshQuery()
			})
			row.createSpan({ text: note.ids.length > 0
				? `${note.file.basename} (${note.ids.length})`
				: `${note.file.basename} (noch keine synchronisierten Karten)` })
		}
		if (this.visibleNotes().length === 0) this.list.createEl('p', { text: 'Keine passende Hauptnotiz gefunden.' })
	}

	private refreshQuery(): void {
		const selected = this.notes.filter((note) => this.selected.has(note.file.path))
		const ids = selected.flatMap((note) => note.ids)
		this.output.value = buildFilteredDeckQuery(ids, this.options)
		this.summary.textContent = `${selected.length} Notizen · ${new Set(ids).size} Anki-Notizen ausgewählt`
	}

	private async copyQuery(): Promise<void> {
		if (!this.output.value) { new Notice('Bitte zuerst mindestens eine Notiz auswählen.'); return }
		try {
			await navigator.clipboard.writeText(this.output.value)
			new Notice('Anki-Suchabfrage kopiert.')
		} catch {
			this.output.focus(); this.output.select()
			new Notice('Automatisches Kopieren nicht möglich. Die Abfrage ist markiert und kann manuell kopiert werden.')
		}
	}
}
