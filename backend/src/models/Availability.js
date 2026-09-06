import mongoose from 'mongoose';

/**
 * Single-day availability. DISPLAY ONLY - it does not affect search.
 *
 * Rows here are read in exactly one way: routes/publicRoutes.js collects the
 * `available` ones to build the `available_dates` list on a public profile.
 * Nothing filters, excludes or ranks a professional by them. A freelancer with
 * no rows here is just as findable as one with a hundred.
 *
 * The model that DOES decide who appears in a date-filtered search is
 * AvailabilityBlock, where a non-bookable block excludes the professional for
 * the dates it covers. See models/AvailabilityBlock.js.
 *
 * These two models overlap conceptually - both answer "when is this person
 * free" - with different shapes (one day vs a date range) and different status
 * enums ('tentative' here, 'busy'/'traveling'/'unavailable' there). Only
 * AvailabilityBlock has a UI: the freelancer Availability tab owns it. The
 * remaining writer for this model is updateProfileAndAvailability in
 * controllers/freelancerController.js, which no frontend calls any more.
 * Consolidating the two is outstanding work and deliberately not started here.
 */
const availabilitySchema = new mongoose.Schema({
  freelancer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['available', 'booked', 'tentative'], default: 'available' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

availabilitySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Availability', availabilitySchema);
