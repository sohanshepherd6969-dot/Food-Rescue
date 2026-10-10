// Fixed values from the spec. The backend validates against these lists.
module.exports = {
  ROLES: ['donor', 'distributor', 'admin'],
  PUBLIC_ROLES: ['donor', 'distributor'], // admin is never created by public sign-up
  PRICES: [0, 5, 10], // Free, Rs 5/plate, Rs 10/plate
  FOOD_TYPES: ['Pure Veg', 'Non-Veg', 'Mixed'],
  KITCHEN_TYPES: ['Vegetarian', 'Non-Vegetarian', 'Mixed'],
  AREAS: ['All Bangalore', 'Koramangala', 'Indiranagar', 'Jayanagar', 'Whitefield'],
  // A listing sits in one real area; 'All Bangalore' is only a filter / user default.
  LISTING_AREAS: ['Koramangala', 'Indiranagar', 'Jayanagar', 'Whitefield'],
  LISTING_STATUS: ['available', 'claimed', 'completed', 'cancelled', 'removed'],
  CLAIM_STATUS: ['claimed', 'completed', 'cancelled'],
  REPORT_STATUS: ['open', 'reviewed', 'resolved', 'dismissed'],
};
