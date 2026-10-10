/* Demo data for FoodRescue.
   Run: npm run seed
   - Creates the Super Admin from ADMIN_EMAIL / ADMIN_PASSWORD (if missing).
   - Deletes and recreates ONLY demo accounts (emails ending @foodrescue.demo) and their data.
     Real sign-ups are never touched.
   - Pickup deadlines are set relative to now (a few hours to 3 days ahead).
     Re-run the seed before a demo so the marketplace isn't empty. */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const User = require('./src/models/User');
const FoodListing = require('./src/models/FoodListing');
const PickupClaim = require('./src/models/PickupClaim');
const Review = require('./src/models/Review');
const Report = require('./src/models/Report');
const ensureAdmin = require('./src/utils/ensureAdmin');
const { configured: cloudinaryReady } = require('./src/utils/cloudinary');

const DEMO_DOMAIN = '@foodrescue.demo';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@1234';
const photo = (id) => `https://images.unsplash.com/photo-${id}?w=900&q=70&auto=format&fit=crop`;

const IMG = {
  vegBiryani: photo('1563379091339-03b21ab4a4f8'),
  chickenBiryani: photo('1589302168068-964664d93dc0'),
  eggBiryani: photo('1645177628172-a94c1f96e6db'),
  chickenPulao: photo('1631515243349-e0cb75fb8d3a'),
  vegPulao: photo('1512058564366-18510be2db19'),
  thali: photo('1546833999-b9f581a1996d'),
  butterChicken: photo('1565557623262-b51c2513a641'),
  paneerTikka: photo('1567188040759-fb8a883dc6d8'),
  paneerRice: photo('1588166524941-3bf61a9c41db'),
  fishCurry: photo('1574653853027-5382a3d23a15'),
  curryCombo: photo('1585937421612-70a008356fbe'),
  chickenSukka: photo('1505253758473-96b7015fcd40'),
  samosa: photo('1601050690597-df0568f70950'),
  pavBhaji: photo('1606491956689-2ea866880c84'),
  salad: photo('1540189549336-e6e99c3679fe'),
};

const DONORS = [
  { key: 'aditi', name: 'Aditi Sharma', organizationName: 'Aditi Hostel', area: 'Koramangala' },
  { key: 'spice', name: 'Ravi Kumar', organizationName: 'Spice Route Restaurant', area: 'Indiranagar' },
  { key: 'green', name: 'Meera Rao', organizationName: 'Green Leaf Caterers', area: 'Jayanagar' },
  { key: 'tech', name: 'Arjun Nair', organizationName: 'TechPark Cafeteria', area: 'Whitefield' },
];
const DISTRIBUTORS = [
  { key: 'rahul', name: 'Rahul Verma', organizationName: 'Feed Bangalore NGO', area: 'All Bangalore' },
  { key: 'priya', name: 'Priya Iyer', organizationName: 'Annapurna Volunteers', area: 'Jayanagar' },
  { key: 'hope', name: 'Sameer Khan', organizationName: 'Hope Kitchen Collective', area: 'Whitefield' },
];

const hours = (h) => new Date(Date.now() + h * 3600 * 1000);

// [donor, title, description, image, plates, price, foodType, kitchenType, area, deadline(h), outcome]
// outcome: available | claimed:<distributor> | completed:<distributor>:<stars> | cancelled
const LISTINGS = [
  ['aditi', 'Vegetable Biryani', 'Fresh vegetable biryani prepared today. Surplus food from hostel mess. Packed and ready for pickup.', 'vegBiryani', 50, 0, 'Pure Veg', 'Vegetarian', 'Koramangala', 6, 'available'],
  ['aditi', 'Dal Rice', 'Dal tadka with steamed rice from the hostel lunch service.', 'vegPulao', 30, 5, 'Pure Veg', 'Vegetarian', 'Koramangala', 4, 'claimed:rahul'],
  ['aditi', 'Veg Thali Meals', 'Full thali: chapati, two sabzis, dal, rice and curd.', 'thali', 40, 0, 'Pure Veg', 'Vegetarian', 'Koramangala', -20, 'completed:priya:5'],
  ['aditi', 'Pav Bhaji', 'Evening snack batch, bhaji in sealed containers, pav packed separately.', 'pavBhaji', 25, 5, 'Pure Veg', 'Vegetarian', 'Koramangala', 30, 'available'],
  ['spice', 'Chicken Biryani', 'Hyderabadi-style chicken biryani from a cancelled party order.', 'chickenBiryani', 60, 10, 'Non-Veg', 'Non-Vegetarian', 'Indiranagar', 8, 'available'],
  ['spice', 'Butter Chicken & Naan', 'Butter chicken with naan, kept hot. Best collected within a few hours.', 'butterChicken', 20, 10, 'Non-Veg', 'Non-Vegetarian', 'Indiranagar', 5, 'available'],
  ['spice', 'Paneer Tikka', 'Grilled paneer tikka starters from the buffet.', 'paneerTikka', 15, 5, 'Pure Veg', 'Non-Vegetarian', 'Indiranagar', 3, 'available'],
  ['spice', 'Chicken Pulao', 'Lunch buffet surplus, chicken pulao with raita.', 'chickenPulao', 35, 5, 'Non-Veg', 'Non-Vegetarian', 'Indiranagar', -30, 'completed:rahul:4'],
  ['green', 'Paneer Butter Masala & Rice', 'Wedding catering surplus, paneer butter masala with jeera rice.', 'paneerRice', 80, 0, 'Pure Veg', 'Vegetarian', 'Jayanagar', 10, 'available'],
  ['green', 'Mixed Curry Combo', 'Chole, dal makhani and chicken curry in separate trays.', 'curryCombo', 45, 5, 'Mixed', 'Mixed', 'Jayanagar', 12, 'available'],
  ['green', 'Samosa Platter', 'Fresh samosas with green chutney from an event.', 'samosa', 100, 0, 'Pure Veg', 'Vegetarian', 'Jayanagar', 7, 'available'],
  ['green', 'Veg Pulao', 'Vegetable pulao, packed in foil trays.', 'vegPulao', 50, 0, 'Pure Veg', 'Vegetarian', 'Jayanagar', -50, 'completed:priya:5'],
  ['tech', 'Fish Curry Meals', 'Kerala fish curry with rice from the cafeteria lunch counter.', 'fishCurry', 25, 10, 'Non-Veg', 'Non-Vegetarian', 'Whitefield', 6, 'available'],
  ['tech', 'Egg Biryani', 'Egg biryani, 2 eggs per plate.', 'eggBiryani', 40, 5, 'Non-Veg', 'Mixed', 'Whitefield', 9, 'available'],
  ['tech', 'Fresh Garden Salad', 'Untouched salad bowls from a corporate lunch.', 'salad', 30, 0, 'Pure Veg', 'Vegetarian', 'Whitefield', 48, 'available'],
  ['tech', 'Chicken Sukka & Rice', 'Mangalorean chicken sukka with rice.', 'chickenSukka', 20, 10, 'Non-Veg', 'Non-Vegetarian', 'Whitefield', -40, 'completed:hope:3'],
  ['tech', 'Veg Thali', 'Cafeteria thali surplus.', 'thali', 25, 0, 'Pure Veg', 'Vegetarian', 'Whitefield', 72, 'cancelled'],
];

// Upload each demo photo to Cloudinary once (if keys are set); otherwise use the direct link.
async function resolveImages() {
  const out = {};
  for (const [key, url] of Object.entries(IMG)) {
    if (!cloudinaryReady) { out[key] = { url, publicId: '' }; continue; }
    const r = await cloudinary.uploader.upload(url, { folder: 'foodrescue/demo', public_id: key, overwrite: true });
    out[key] = { url: r.secure_url, publicId: r.public_id };
  }
  console.log(cloudinaryReady ? 'Demo images uploaded to Cloudinary.' : 'Cloudinary not configured: using direct image links.');
  return out;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Remove previous demo donors/distributors and their data (never admins or real sign-ups).
  const oldDemo = await User.find({ role: { $ne: 'admin' }, email: { $regex: DEMO_DOMAIN.replace('.', '\\.') + '$' } }, '_id');
  const ids = oldDemo.map((u) => u._id);
  await Promise.all([
    FoodListing.deleteMany({ donorId: { $in: ids } }),
    PickupClaim.deleteMany({ $or: [{ donorId: { $in: ids } }, { distributorId: { $in: ids } }] }),
    Review.deleteMany({ $or: [{ reviewerId: { $in: ids } }, { revieweeId: { $in: ids } }] }),
    Report.deleteMany({ reporterId: { $in: ids } }),
  ]);
  await User.deleteMany({ _id: { $in: ids } });
  await ensureAdmin();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = {};
  for (const [role, list] of [['donor', DONORS], ['distributor', DISTRIBUTORS]]) {
    for (const u of list) {
      const { key, ...fields } = u;
      users[key] = await User.create({ ...fields, role, email: `${u.key}${DEMO_DOMAIN}`, passwordHash, phone: '98450' + String(Math.floor(10000 + Math.random() * 89999)) });
    }
  }

  const images = await resolveImages();
  let count = 0;
  for (const [donor, title, description, img, plates, price, foodType, kitchenType, area, h, outcome] of LISTINGS) {
    const [state, distKey, stars] = outcome.split(':');
    const createdAt = hours(Math.min(h, 0) - 2);
    const listing = await FoodListing.create({
      donorId: users[donor]._id, title, description, imageUrl: images[img].url, imagePublicId: images[img].publicId,
      quantityPlates: plates, pricePerPlate: price, foodType, kitchenType, area,
      pickupDeadline: hours(h), status: state, createdAt,
    });
    if (state === 'claimed' || state === 'completed') {
      const claim = await PickupClaim.create({
        listingId: listing._id, donorId: users[donor]._id, distributorId: users[distKey]._id,
        status: state, claimedAt: hours(Math.min(h, 0) - 1), completedAt: state === 'completed' ? hours(Math.min(h, 0) - 0.5) : undefined,
      });
      if (stars) {
        await Review.create({ claimId: claim._id, listingId: listing._id, reviewerId: users[distKey]._id, revieweeId: users[donor]._id, rating: Number(stars), comment: 'Food was fresh and well packed.' });
      }
    }
    count++;
  }

  const anyListing = await FoodListing.findOne({ donorId: users.spice._id, status: 'available' });
  await Report.create({ reporterId: users.priya._id, targetType: 'listing', targetListingId: anyListing._id, targetUserId: users.spice._id, reason: 'Pickup address was unclear; donor did not answer the phone.' });

  console.log(`Seeded ${DONORS.length} donors, ${DISTRIBUTORS.length} distributors, ${count} listings.`);
  console.log(`Demo logins: <key>${DEMO_DOMAIN} / ${DEMO_PASSWORD}  (e.g. aditi${DEMO_DOMAIN}, rahul${DEMO_DOMAIN})`);
  await mongoose.disconnect();
}

main().catch(async (err) => { console.error('Seed failed:', err.message); await mongoose.disconnect(); process.exit(1); });
