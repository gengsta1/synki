import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SynkiConnectClient } from '../src/synki-anki-connect'

const requestUrlMock = vi.hoisted(() => vi.fn())
vi.mock('obsidian', () => ({ requestUrl: requestUrlMock }))

const client = new SynkiConnectClient({ host: 'http://localhost', key: undefined, port: 8765 })

function actions(): Array<{ action: string; params: Record<string, unknown> }> {
	return requestUrlMock.mock.calls.map(([request]) => JSON.parse(request.body as string))
}

describe('Synki AnkiConnect deck routing', () => {
	beforeEach(() => {
		requestUrlMock.mockReset()
	})

	test('moves every card of an existing note without recreating the note', async () => {
		requestUrlMock.mockImplementation(async ({ body }: { body: string }) => {
			const request = JSON.parse(body) as { action: string }
			const result: Record<string, unknown> = {
				notesInfo: [{ noteId: 123, cards: [456, 789] }],
				getDecks: { 'Innere::Diagnosen': [456, 789] },
				changeDeck: null,
			}
			return { json: { error: null, result: result[request.action] } }
		})

		await client.moveNoteToDeck('123', 'Innere::Diagnosen::Pankreatitis::Gesamtüberblick')
		expect(actions().map((request) => request.action)).toEqual(['notesInfo', 'getDecks', 'changeDeck'])
		expect(actions()[2]?.params).toEqual({
			cards: [456, 789],
			deck: 'Innere::Diagnosen::Pankreatitis::Gesamtüberblick',
		})
	})

	test('does not move cards already in the requested subdeck', async () => {
		requestUrlMock.mockImplementation(async ({ body }: { body: string }) => {
			const request = JSON.parse(body) as { action: string }
			const result: Record<string, unknown> = {
				notesInfo: [{ noteId: 123, cards: [456] }],
				getDecks: { 'Innere::Diagnosen::Pankreatitis::Gesamtüberblick': [456] },
			}
			return { json: { error: null, result: result[request.action] } }
		})

		await client.moveNoteToDeck('123', 'Innere::Diagnosen::Pankreatitis::Gesamtüberblick')
		expect(actions().map((request) => request.action)).toEqual(['notesInfo', 'getDecks'])
	})
})
