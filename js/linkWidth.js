/**
 * linkWidth.js — Line width of an intralayer link from its weight.
 *
 * Width is weight × 2 px, up to 8 px, so networks with weights up to 4 draw as
 * they always have. When large weights are common (the 99th percentile is
 * above 4, e.g. percentages), every weight is scaled by 4 / that percentile,
 * so the links keep their proportions instead of all reaching the cap. The
 * percentile, not the largest weight, so a few outliers do not thin every
 * other link (pilosof2017: 99% of weights below 3.6, largest 24.6). One scale
 * for all layers keeps layers comparable.
 */

const PX_PER_WEIGHT = 2;
const MAX_PX = 8;
const MIN_PX = 0.5;       // when rescaled, small weights stay visible
const UNWEIGHTED_PX = 2;  // links without a weight
const LARGE_WEIGHT = MAX_PX / PX_PER_WEIGHT;
const REFERENCE_QUANTILE = 0.99;

/** Scale for the weights of `links`: 1, or 4 / their 99th percentile when it is above 4. */
export function intraLinkWidthScale(links) {
    const weights = links.map(link => link.weight).filter(w => w > 0).sort((a, b) => a - b);
    if (!weights.length) return 1;
    const reference = weights[Math.floor(REFERENCE_QUANTILE * (weights.length - 1))];
    return reference > LARGE_WEIGHT ? LARGE_WEIGHT / reference : 1;
}

/** Width in px of a link of `weight`, with the scale from intraLinkWidthScale. */
export function intraLinkWidth(weight, scale = 1) {
    if (!weight) return UNWEIGHTED_PX;
    const px = Math.min(weight * scale * PX_PER_WEIGHT, MAX_PX);
    return scale < 1 ? Math.max(MIN_PX, px) : px; // unscaled: exactly as before
}
