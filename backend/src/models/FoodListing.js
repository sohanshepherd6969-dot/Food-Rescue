const mongoose = require('mongoose');
const { PRICES, FOOD_TYPES, KITCHEN_TYPES, LISTING_AREAS, LISTING_STATUS } = require('../constants');

const foodListingSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    imageUrl: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },
    quantityPlates: { type: Number, required: true, min: 1, max: 5000 },
    pricePerPlate: { type: Number, required: true, enum: PRICES },
    foodType: { type: String, required: true, enum: FOOD_TYPES },
    kitchenType: { type: String, required: true, enum: KITCHEN_TYPES },
    area: { type: String, required: true, enum: LISTING_AREAS },
    pickupDeadline: { type: Date, required: true },
    status: { type: String, enum: LISTING_STATUS, default: 'available', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FoodListing', foodListingSchema);
