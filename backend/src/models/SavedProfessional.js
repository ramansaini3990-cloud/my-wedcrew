import mongoose from 'mongoose';

/**
 * A company's bookmark of a professional.
 *
 * Deliberately just a bookmark: company, professional, when. It is NOT a
 * per-event shortlist - that needs a requirement reference and an ordering,
 * and is a separate feature.
 *
 * Nothing about the professional is copied in here. The list endpoint reads
 * the User record and serialises it through publicProfileService, so a saved
 * card is subject to exactly the same subscription lock as a search result.
 * Denormalising a name or photo onto this row would quietly hand a company a
 * cached copy of data their plan does not entitle them to.
 */
const savedProfessionalSchema = new mongoose.Schema({
  company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  freelancer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

savedProfessionalSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

/**
 * One save per pair, enforced by the DATABASE and not only by a read-then-write
 * check in the service - two rapid taps on the save button would otherwise race
 * past that check and create duplicates. Same pattern as the Application
 * requirement/freelancer index.
 */
savedProfessionalSchema.index({ company_id: 1, freelancer_id: 1 }, { unique: true });

export default mongoose.model('SavedProfessional', savedProfessionalSchema);
