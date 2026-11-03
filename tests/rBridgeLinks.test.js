/**
 * Link keys a view spec's filter is checked against: the links MiRA draws.
 * In an undirected network whose table lists A→B and B→A, MiRA draws the
 * first row; the second finds it through its reverse key (backlog item 37).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMultilayerData } from '../js/dataParser.js';
import { drawnLinkKeys } from '../js/rBridge.js';

const fixture = () => JSON.parse(
    readFileSync(new URL('./fixtures/calc_G_bipartite_complete_2x3.json', import.meta.url), 'utf8'));

describe('view spec link keys', () => {
    it('an undirected link listed in both directions: one drawn key, found from either', () => {
        const json = fixture();
        json.extended.push({ layer_from: 'BL', node_from: 'B1', layer_to: 'BL', node_to: 'P1', weight: 1 });
        const { linkKeys, reverseLinkKeys } = drawnLinkKeys(parseMultilayerData(json));
        expect(linkKeys.has('BL::P1::BL::B1')).toBe(true);
        expect(linkKeys.has('BL::B1::BL::P1')).toBe(false);
        expect(reverseLinkKeys.get('BL::B1::BL::P1')).toBe('BL::P1::BL::B1');
    });

    it('a directed link has no reverse key', () => {
        const json = { ...fixture(), directed: true };
        const { linkKeys, reverseLinkKeys } = drawnLinkKeys(parseMultilayerData(json));
        expect(linkKeys.has('BL::P1::BL::B1')).toBe(true);
        expect(reverseLinkKeys.size).toBe(0);
    });

    it('weight-0 links are not drawn, so they are not keys', () => {
        const json = fixture();
        json.extended[0].weight = 0;
        const { linkKeys } = drawnLinkKeys(parseMultilayerData(json));
        expect(linkKeys.has('BL::P1::BL::B1')).toBe(false);
    });
});
