/**
 * tests/version.test.js — one version number everywhere.
 *
 * MiRA's version is written by hand in several files. CITATION.cff is the
 * source; every other mention must match it, and CHANGELOG.md must have a
 * section for it. To release a new version, change CITATION.cff and follow
 * the failures.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = file => readFileSync(resolve(ROOT, file), 'utf8')

const VERSION = read('CITATION.cff').match(/^version:\s*"([^"]+)"/m)?.[1]

// Each mention, as it must read for VERSION
const MENTIONS = [
  ['README.md', v => `Rendering Application** (v${v}).`],
  ['README.md', v => `version      = {${v}},`],
  ['about.html', v => `"softwareVersion": "${v}"`],
  ['about.html', v => `Application (v${v}). <em>Zenodo</em>.`],
  ['index.html', v => `"softwareVersion": "${v}"`],
  ['js/version.js', v => `export const MIRA_VERSION = '${v}';`],
  ['docs/manual.html', v => `>v${v} · What's new</a>`],
]

describe('version number', () => {
  it('CITATION.cff has a version', () => {
    expect(VERSION).toMatch(/^\d+\.\d+(\.\d+)?$/)
  })

  it.each(MENTIONS)('%s matches CITATION.cff', (file, mention) => {
    expect(read(file)).toContain(mention(VERSION))
  })

  it('CHANGELOG.md has a section for the version', () => {
    expect(read('CHANGELOG.md')).toMatch(new RegExp(`^## ${VERSION.replace(/\./g, '\\.')} `, 'm'))
  })
})
