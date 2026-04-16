/**
 * eligibilityEngine.js — Task 3 spec-compliant implementation.
 *
 * Exports:
 *   hardFilter(scheme, profile) → boolean
 *   scoreScheme(scheme, profile) → number (0-100)
 *   fuzzyMatch(scheme, profile) → { isFuzzy, reason, type, months? } | null
 *   getEligibleSchemes(allSchemes, profile) →
 *     { confirmed, fuzzy, totalEstimatedValue, topCategory }
 *   buildSchemeGraph(allSchemes) → Map
 *
 * Legacy compat exports (used by useEligibility, CrossSchemeChain, etc.):
 *   evaluateOne, evaluateAll, totalBenefitValue, relatedEligible, daysUntil
 */

import { SCHEMES, SCHEME_BY_ID } from '../data/schemes.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const daysUntil = (isoDate) => {
  if (!isoDate) return Infinity;
  const target = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

const OCCUPATION_RELATIVES = {
  farmer:        ['daily_wage'],
  daily_wage:    ['farmer', 'homemaker'],
  student:       ['unemployed'],
  unemployed:    ['student'],
  small_business:['daily_wage'],
  homemaker:     ['daily_wage'],
};

// ─── 1. hardFilter ────────────────────────────────────────────────────────────
/**
 * Returns false if the profile definitively fails any hard eligibility rule.
 * null values are treated as "no restriction" and always pass.
 */
export function hardFilter(scheme, profile) {
  if (!scheme || !profile) return false;
  const e = scheme.eligibility || {};

  // Age
  const age = profile.age ?? null;
  if (age !== null) {
    if (e.min_age != null && age < e.min_age) return false;
    if (e.max_age != null && age > e.max_age) return false;
  }

  // Gender
  if (e.gender && e.gender !== 'any' && profile.gender && e.gender !== profile.gender) return false;

  // Caste
  if (Array.isArray(e.caste_required) && e.caste_required.length > 0) {
    if (!profile.caste || !e.caste_required.includes(profile.caste)) return false;
  }

  // Income
  if (e.income_max_annual != null && profile.annual_income != null) {
    if (profile.annual_income > e.income_max_annual) return false;
  }

  // Occupation (only restrict if scheme lists specific occupations, not 'any')
  if (Array.isArray(e.occupation) && e.occupation.length > 0 && !e.occupation.includes('any')) {
    if (profile.occupation && !e.occupation.includes(profile.occupation)) return false;
  }

  return true;
}

// ─── 2. scoreScheme ──────────────────────────────────────────────────────────
// Precompute max benefit for normalization (cached once)
let _maxBenefit = null;
function getMaxBenefit(allSchemes = SCHEMES) {
  if (_maxBenefit !== null) return _maxBenefit;
  _maxBenefit = Math.max(1, ...allSchemes.map(s => s.benefit_amount || 0));
  return _maxBenefit;
}

/**
 * Returns a score 0-100 for a scheme that has already passed hardFilter.
 */
export function scoreScheme(scheme, profile, allSchemes = SCHEMES) {
  let score = 0;

  // 1. DEADLINE URGENCY (25 pts)
  if (scheme.is_ongoing) {
    score += 10; // ongoing: always available, lower urgency
  } else {
    const days = daysUntil(scheme.deadline);
    if (days <= 7)       score += 25;
    else if (days <= 30) score += 20;
    else if (days <= 90) score += 15;
    else if (days < Infinity) score += 10;
    else score += 8; // no deadline info
  }

  // 2. BENEFIT VALUE (25 pts)
  const amt = scheme.benefit_amount;
  if (amt == null || amt === 0) {
    score += 10; // non-cash benefits still valuable
  } else {
    score += (amt / getMaxBenefit(allSchemes)) * 25;
  }

  // 3. DISTRICT SUCCESS RATE (20 pts)
  const districtApps = scheme.district_applicants || {};
  const totalApps = scheme.total_applicants_this_month || 1;
  const myDistrictApps = districtApps[profile.district] ?? 0;
  const ratio = myDistrictApps / totalApps;
  if (ratio > 0.15)     score += 20;
  else if (ratio > 0.08) score += 15;
  else if (ratio > 0.03) score += 10;
  else                   score += 5;

  // 4. OCCUPATION RELEVANCE (20 pts)
  const occupation = scheme.eligibility?.occupation || [];
  if (occupation.length === 0 || occupation.includes('any')) {
    score += 12;
  } else if (profile.occupation && occupation.includes(profile.occupation)) {
    score += 20;
  } else {
    // Related occupation
    const related = OCCUPATION_RELATIVES[profile.occupation] || [];
    if (related.some(o => occupation.includes(o))) score += 15;
    else score += 5;
  }

  // 5. APPLICATION SIMPLICITY (10 pts)
  const docCount = (scheme.documents_required || []).length;
  if (docCount <= 2)      score += 10;
  else if (docCount <= 4) score += 7;
  else                    score += 4;

  return Math.min(100, score);
}

// ─── 3. fuzzyMatch ───────────────────────────────────────────────────────────
/**
 * Called on schemes that FAILED hardFilter.
 * Returns a fuzzy match descriptor or null if the scheme truly doesn't apply.
 */
export function fuzzyMatch(scheme, profile) {
  const e = scheme.eligibility || {};
  const age = profile.age ?? null;

  // Age within 24 months of min_age
  if (age !== null && e.min_age != null && age < e.min_age) {
    const ageDiff = e.min_age - age;
    if (ageDiff <= 2) {
      return {
        isFuzzy: true,
        type: 'age',
        reason: `Eligible in ${Math.ceil(ageDiff * 12)} months`,
        months: Math.ceil(ageDiff * 12),
      };
    }
  }

  // Income within 15% over limit
  if (e.income_max_annual != null && profile.annual_income != null) {
    if (profile.annual_income > e.income_max_annual) {
      const ratio = profile.annual_income / e.income_max_annual;
      if (ratio <= 1.15) {
        return {
          isFuzzy: true,
          type: 'income',
          reason: 'May qualify — check with Panchayat office',
        };
      }
    }
  }

  // Caste mismatch but scheme also lists General
  if (Array.isArray(e.caste_required) && e.caste_required.length > 0) {
    if (e.caste_required.includes('General') && profile.caste !== 'General') {
      return {
        isFuzzy: true,
        type: 'caste',
        reason: 'Open to all categories',
      };
    }
  }

  return null;
}

// ─── 4. getEligibleSchemes ────────────────────────────────────────────────────
/**
 * Main eligibility function used by Feed and WowReveal.
 */
export function getEligibleSchemes(allSchemes, profile) {
  if (!profile || !allSchemes) {
    return { confirmed: [], fuzzy: [], totalEstimatedValue: 0, topCategory: 'farming' };
  }

  const confirmed = [];
  const fuzzyMatches = [];

  for (const scheme of allSchemes) {
    if (hardFilter(scheme, profile)) {
      const s = scoreScheme(scheme, profile, allSchemes);
      confirmed.push({ scheme, score: s });
    } else {
      const f = fuzzyMatch(scheme, profile);
      if (f) fuzzyMatches.push({ scheme, fuzzy: f, score: f.type === 'age' ? 40 : 30 });
    }
  }

  confirmed.sort((a, b) => b.score - a.score);
  const topFuzzy = fuzzyMatches
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const DEFAULT_VALUE = 50000;
  const totalEstimatedValue = confirmed.reduce(
    (sum, { scheme }) => sum + (scheme.benefit_amount || DEFAULT_VALUE),
    0,
  );

  // topCategory: most common category in confirmed
  const catCounts = {};
  confirmed.forEach(({ scheme }) => {
    catCounts[scheme.category] = (catCounts[scheme.category] || 0) + 1;
  });
  const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'farming';

  return { confirmed, fuzzy: topFuzzy, totalEstimatedValue, topCategory };
}

// ─── 5. buildSchemeGraph ─────────────────────────────────────────────────────
/**
 * Builds a weighted adjacency Map for cross-scheme chaining.
 * Returns Map<scheme_id, { related: [{id, weight, reason}] }>
 */
export function buildSchemeGraph(allSchemes = SCHEMES) {
  const graph = new Map();
  const docToSchemes = new Map();

  for (const s of allSchemes) {
    graph.set(s.id, { related: [] });
    for (const doc of s.documents_required || []) {
      const key = doc.toLowerCase().replace(/\s+/g, '_');
      if (!docToSchemes.has(key)) docToSchemes.set(key, []);
      docToSchemes.get(key).push(s.id);
    }
  }

  for (const s of allSchemes) {
    const node = graph.get(s.id);
    const seen = new Set();

    // Same category — weak link
    for (const other of allSchemes) {
      if (other.id === s.id || seen.has(other.id)) continue;
      if (other.category === s.category) {
        node.related.push({ id: other.id, weight: 0.5, reason: 'same_category' });
        seen.add(other.id);
      }
    }

    // Shared required documents — strong link
    for (const doc of s.documents_required || []) {
      const key = doc.toLowerCase().replace(/\s+/g, '_');
      for (const otherId of docToSchemes.get(key) || []) {
        if (otherId === s.id || seen.has(otherId)) continue;
        node.related.push({ id: otherId, weight: 0.9, reason: 'shared_document' });
        seen.add(otherId);
      }
    }

    // Overlapping occupation targets — medium link
    for (const other of allSchemes) {
      if (other.id === s.id || seen.has(other.id)) continue;
      const sOcc = s.eligibility?.occupation || [];
      const oOcc = other.eligibility?.occupation || [];
      const overlap = sOcc.some(o => oOcc.includes(o)) && sOcc.length > 0 && oOcc.length > 0;
      if (overlap) {
        node.related.push({ id: other.id, weight: 0.7, reason: 'occupation_overlap' });
        seen.add(other.id);
      }
    }

    // Sort by weight descending
    node.related.sort((a, b) => b.weight - a.weight);
  }

  return graph;
}

// ─── Legacy compat ───────────────────────────────────────────────────────────
/** Legacy: used by CrossSchemeChain */
export const evaluateOne = (scheme, profile) => {
  if (!scheme || !profile) return { status: 'unknown', score: 0 };
  if (hardFilter(scheme, profile)) {
    const score = scoreScheme(scheme, profile) / 100;
    return { status: 'eligible', score, reasons: [] };
  }
  const f = fuzzyMatch(scheme, profile);
  if (f) return { status: 'close_match', score: 0.35, reasons: [f.type], fuzzy: f };
  return { status: 'not_eligible', score: 0, reasons: [] };
};

/** Legacy: used by SahayakMode and useEligibility hook */
export const evaluateAll = (profile, allSchemes = SCHEMES) => {
  const { confirmed, fuzzy } = getEligibleSchemes(allSchemes, profile);
  return {
    eligible: confirmed.map(({ scheme, score }) => ({ scheme, score: score / 100, status: 'eligible' })),
    close_matches: fuzzy.map(({ scheme, fuzzy: f, score }) => ({
      scheme, score: score / 100, status: 'close_match', fuzzy: f
    })),
  };
};

export const totalBenefitValue = (entries) =>
  entries.reduce((sum, e) => sum + (e.scheme?.benefit_amount || 0), 0);

/** Cross-scheme chain: follow related_scheme_ids + graph for eligible schemes */
export const relatedEligible = (schemeId, profile) => {
  const src = SCHEME_BY_ID[schemeId];
  if (!src) return [];
  const graph = buildSchemeGraph(SCHEMES);
  const node = graph.get(schemeId);
  const candidateIds = [
    ...(src.related_scheme_ids || []),
    ...(node?.related || []).filter(r => r.weight >= 0.5).map(r => r.id),
  ];
  const seen = new Set();
  const out = [];
  for (const rid of candidateIds) {
    if (seen.has(rid)) continue;
    seen.add(rid);
    const r = SCHEME_BY_ID[rid];
    if (!r) continue;
    if (hardFilter(r, profile)) {
      out.push({ scheme: r, score: scoreScheme(r, profile) / 100 });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
};
