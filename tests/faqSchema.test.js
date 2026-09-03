/**
 * tests/faqSchema.test.js — FAQ structured-data sync.
 *
 * about.html carries the FAQ twice: once as visible <details> markup and once
 * as a FAQPage JSON-LD block for search and answer engines. Google requires the
 * schema to reflect the visible page, so the two must not drift apart. These
 * tests fail if they do.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const PAGE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../about.html')
const JSON_LD_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
const FAQ_ITEM_RE = /<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g

const html = readFileSync(PAGE_PATH, 'utf8')

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Strip tags, decode entities, and collapse whitespace so texts compare cleanly. */
function toPlainText(fragment) {
  return fragment
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim()
}

function parseJsonLdBlocks() {
  return [...html.matchAll(JSON_LD_RE)].map(match => JSON.parse(match[1]))
}

function findFaqSchema() {
  return parseJsonLdBlocks().find(block => block['@type'] === 'FAQPage')
}

function readVisibleFaq() {
  return [...html.matchAll(FAQ_ITEM_RE)].map(match => ({
    question: toPlainText(match[1]),
    answer: toPlainText(match[2]),
  }))
}

describe('about.html — FAQ structured data', () => {
  it('every JSON-LD block is valid JSON', () => {
    expect(() => parseJsonLdBlocks()).not.toThrow()
    expect(parseJsonLdBlocks().length).toBeGreaterThan(0)
  })

  it('declares a FAQPage block with questions', () => {
    const faq = findFaqSchema()
    expect(faq, 'no FAQPage JSON-LD block found').toBeDefined()
    expect(Array.isArray(faq.mainEntity)).toBe(true)
    expect(faq.mainEntity.length).toBeGreaterThan(0)
  })

  it('has the same number of questions in the schema and on the page', () => {
    expect(readVisibleFaq().length).toBe(findFaqSchema().mainEntity.length)
  })

  it('schema question titles match the visible <summary> text', () => {
    const visible = readVisibleFaq()
    findFaqSchema().mainEntity.forEach((entry, i) => {
      expect(toPlainText(entry.name), `question ${i + 1} title drifted`).toBe(visible[i].question)
    })
  })

  it('every schema answer appears verbatim in the visible answer', () => {
    const visible = readVisibleFaq()
    findFaqSchema().mainEntity.forEach((entry, i) => {
      const schemaAnswer = toPlainText(entry.acceptedAnswer.text).replace(/\.$/, '')
      expect(visible[i].answer, `answer ${i + 1} ("${visible[i].question}") drifted`)
        .toContain(schemaAnswer)
    })
  })
})
