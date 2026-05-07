/**
 * js/calc/ — All quantitative computations on a parsed multilayer model.
 *
 * Today this module owns node-level degree/strength. Future migrations
 * will pull layer density, Jaccard similarity, and meta-aggregation in
 * here too, so the dashboard and dataParser stop duplicating math.
 */

export { computeMetrics } from './nodeMetrics.js';
