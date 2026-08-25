import mongoose from 'mongoose';

export const AVAILABILITY_STATUSES = ['available', 'booked', 'busy', 'traveling', 'unavailable'];

/** Statuses that mean "can be hired here during this window". */
export const BOOKABLE_STATUSES = ['available'];

/**
 * Date-ranged, location-aware availability ("Travel & Availability").
 *
 * This is the location layer and is deliberately SEPARATE from the existing
 * `Availability` model, which stores single-day calendar entries and is left
 * untouched:
 *
 *   Availability       -> "which individual days am I free"  (existing calendar)
 *   AvailabilityBlock  -> "where am I, between these dates, with what status"
 *
 * They are complementary, not duplicates: search consults both. Overlap
 * validation happens between blocks (see chatUnread-style service helpers in
 * services/availabilityService.js).
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
