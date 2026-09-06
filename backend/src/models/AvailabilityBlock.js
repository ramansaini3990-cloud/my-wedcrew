import mongoose from 'mongoose';

export const AVAILABILITY_STATUSES = ['available', 'booked', 'busy', 'traveling', 'unavailable'];

/** Statuses that mean "can be hired here during this window". */
export const BOOKABLE_STATUSES = ['available'];

/**
 * Date-ranged, location-aware availability ("Travel & Availability").
 *
 * THIS IS THE ONLY MODEL THAT AFFECTS SEARCH.
 *
 * An earlier version of this comment claimed "search consults both" this model
 * and `Availability`. That was never true and it misled people. What the code
 * actually does, in routes/publicRoutes.js:
 *
 *   AvailabilityBlock  -> decides WHO APPEARS. `?date=` search is exclusion-
 *                         based: a professional is returned for a date unless a
 *                         block whose status is outside BOOKABLE_STATUSES
 *                         covers it. `?city_id=` additionally matches people
 *                         whose bookable block puts them in that city, which is
 *                         what `include_travel` switches off.
 *
 *   Availability       -> decides NOTHING. It is read only to build the
 *                         `available_dates` string list shown on a public
 *                         profile. No filter, exclusion or ranking reads it.
 *
 * The two overlap conceptually - both answer "when is this person free" - and
 * consolidating them onto this model is outstanding work. Until that happens,
 * do not assume a row here has a counterpart there, or the reverse.
 *
 * Overlap validation happens between blocks; see services/availabilityService.js.
 */
const availabilityBlockSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },

  status: { type: String, enum: AVAILABILITY_STATUSES, default: 'available', index: true },

  // Where the user will be during this window.
  state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'State', index: true },
  city_id: { type: mongoose.Schema.Types.ObjectId, ref: 'City', index: true },

  // Denormalised for display and for legacy/unmapped values.
  state: { type: String, trim: true },
  city: { type: String, trim: true },

  manual_location: {
    address: { type: String, trim: true },
    landmark: { type: String, trim: true },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 }
  },

  notes: { type: String, trim: true, maxlength: 500 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Supports "who is in city X between date A and B" without a collection scan.
availabilityBlockSchema.index({ user_id: 1, start_date: 1, end_date: 1 });
availabilityBlockSchema.index({ city_id: 1, status: 1, start_date: 1, end_date: 1 });

availabilityBlockSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('AvailabilityBlock', availabilityBlockSchema);
