/** Thresholds a creator must cross before admin can monetize their profile. */
export const MONETIZATION_RULES = {
  followers: 500,
  avgRating: 3.5,
  ratingsCount: 500,
  watchHours: 100,
} as const;
