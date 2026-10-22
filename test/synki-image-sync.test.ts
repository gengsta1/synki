import { describe, expect, test, vi } from 'vitest'

const TFileMock = vi.hoisted(() => class {
	constructor(public path: string) {}
})

vi.mock('obsidian', () => ({
	Notice: class {},
	TFile: TFileMock,
}))

import { renderInlineMarkdown } from '../src/synki-sync'

describe('medical image upload', () => {
	test('uploads a local HTML image and replaces its src with Anki media', async () => {
		const image = new TFileMock('6 - Main Notes/images/leberzirrhose.jpeg')
		const source = new TFileMock('6 - Main Notes/Leberzirrhose.md')
		const plugin = {
			app: {
				metadataCache: { getFirstLinkpathDest: vi.fn(() => image) },
				vault: { readBinary: vi.fn(async () => new Uint8Array([1, 2, 3])) },
			},
		}
		const client = { storeMediaFile: vi.fn(async () => undefined) }

		const result = await renderInlineMarkdown(
			plugin as never,
			source as never,
			client as never,
			'<img src="leberzirrhose.jpeg">',
		)

		expect(result).toBe('<img src="synki-6_-_Main_Notes_images_leberzirrhose.jpeg">')
		expect(client.storeMediaFile).toHaveBeenCalledWith(
			'synki-6_-_Main_Notes_images_leberzirrhose.jpeg',
			'AQID',
		)
	})
})
