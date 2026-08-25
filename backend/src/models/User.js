import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['admin', 'company', 'freelancer'],
    required: true
  },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // --- Legacy free-text location/profession fields -------------------------
  // Retained for backward compatibility: existing documents, requirements,
  // search and UI already read these. They are kept in sync automatically
  // whenever the corresponding master-data reference below is set.
  city: { type: String },
  state: { type: String },
  profession: { type: String },

  // --- Master-data references (added, optional) ----------------------------
  profession_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profession', index: true },
  state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'State', index: true },
  city_id: { type: mongoose.Schema.Types.ObjectId, ref: 'City', index: true },

  // Set by the migration when a legacy string could not be matched to master
  // data, so an admin can review it instead of the value being destroyed.
  needs_master_review: { type: Boolean, default: false, index: true },

  // --- Extended profile ----------------------------------------------------
  // URL of the user's photo/logo. Rendered by the shared <Avatar /> component,
  // which falls back to initials when this is empty.
  profile_picture: { type: String, trim: true },
  bio: { type: String, trim: true, maxlength: 2000 },
  experience_years: { type: Number, min: 0, max: 80 },
  equipment: [{ type: String, trim: true }],

  /**
   * Free-form base location for cases where the selected city is not precise
   * enough (e.g. "25 km outside Udaipur, near Nathdwara").
   *
   * Coordinates are PRIVATE: public endpoints never return this object, they
   * expose only the approximate "City, State".
   */
  manual_location: {
    address: { type: String, trim: true },
    landmark: { type: String, trim: true },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    // true when the coordinates came from browser geolocation rather than typing
    shared_from_device: { type: Boolean, default: false }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('User', userSchema);
