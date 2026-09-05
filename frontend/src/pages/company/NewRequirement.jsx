import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Calendar, Users, Briefcase, IndianRupee, Clock, Building2, Check, AlignLeft, Info } from 'lucide-react';

const categories = [
  'Wedding Photographer',
  'Cinematographer',
  'Drone Pilot',
  'Video Editor',
  'Album Designer',
  'Event Assistant'
];

const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", 
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", 
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", 
  "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", 
  "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands"
];

const NewRequirement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    state: '',
    city: '',
    event_date: '',
    end_date: '',
    category: '',
    quantity: 1,
    payment_per_freelancer: '',
    number_of_days: 1,
    event_type: '',
    venue: '',
    working_hours: '',
    accommodation: false,
    travel: false,
    food: false,
    description: '',
    status: 'draft'
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e, status) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const dataToSubmit = { ...formData, status };
      await api.post('/api/requirements', dataToSubmit);
      // Straight back to the list this requirement was just added to, rather
      // than the overview tab.
      navigate('/company/dashboard?tab=requirements');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg pt-24 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Returns to the tab this page was reached from, not the default
           overview tab. Now that tabs are addressable this is a real link, so
           it no longer depends on browser Back. */}
        <Link to="/company/dashboard?tab=requirements" className="inline-flex items-center gap-2 text-brand-textSec hover:text-brand-primary transition-colors mb-6 text-sm font-medium">
          <ArrowLeft size={16} /> Back to Requirements
        </Link>
        
        <div className="bg-white rounded-2xl shadow-sm border border-brand-border overflow-hidden">
          
          {/* Header */}
          <div className="bg-white px-8 py-8 border-b border-brand-border flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-3xl font-serif font-bold text-brand-navy mb-2">Post New Requirement</h2>
              <p className="text-brand-textSec text-sm">
                Create a detailed posting to find the perfect crew for your next project.
              </p>
            </div>
            {/* We will keep the buttons at the bottom right as well, but providing context here is nice */}
          </div>
            
          {/* Form Body */}
          <div className="p-8 bg-brand-bg/30">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-8 flex items-center gap-2 text-sm font-medium border border-red-100">
                <Info size={18} /> {error}
              </div>
            )}

            <form className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              
              {/* LEFT COLUMN: Main Details (Takes 2/3 width) */}
              <div className="lg:col-span-2 space-y-10">
                
                {/* SECTION 1: Role & Location */}
                <div className="bg-white p-6 rounded-xl border border-brand-border shadow-sm">
                  <h3 className="text-lg font-bold text-brand-navy mb-5 flex items-center gap-2 border-b border-brand-border pb-3">
                    <Briefcase className="text-brand-primary" size={20} />
                    Role & Location
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-brand-navy mb-1.5">Category Role *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Users className="text-brand-muted" size={18} />
                        </div>
                        <select
                          name="category"
                          required
                          value={formData.category}
                          onChange={handleChange}
                          className="w-full bg-white border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary appearance-none transition-shadow"
                        >
                          <option value="">Select Role Category</option>
                          {categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-brand-navy mb-1.5">Quantity Needed *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Users className="text-brand-muted" size={18} />
                        </div>
                        <input
                          type="number"
                          name="quantity"
                          min="1"
                          required
                          value={formData.quantity}
                          onChange={handleChange}
                          className="w-full bg-white border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary transition-shadow"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-brand-navy mb-1.5">State *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <MapPin className="text-brand-muted" size={18} />
                        </div>
                        <select
                          name="state"
                          required
                          value={formData.state}
                          onChange={handleChange}
                          className="w-full bg-white border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary appearance-none transition-shadow"
                        >
                          <option value="">Select State</option>
                          {indianStates.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {formData.state && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                        <label className="block text-sm font-semibold text-brand-navy mb-1.5">City *</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Building2 className="text-brand-muted" size={18} />
                          </div>
                          <input
                            type="text"
                            name="city"
                            required
                            value={formData.city}
                            onChange={handleChange}
                            placeholder="e.g. Mumbai"
                            className="w-full bg-white border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary transition-shadow placeholder:text-brand-muted"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* SECTION 2: Schedule & Details */}
                <div className="bg-white p-6 rounded-xl border border-brand-border shadow-sm">
                  <h3 className="text-lg font-bold text-brand-navy mb-5 flex items-center gap-2 border-b border-brand-border pb-3">
                    <Calendar className="text-brand-primary" size={20} />
                    Schedule & Details
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-brand-navy mb-1.5">Event Type</label>
                      <input
                        type="text"
                        name="event_type"
                        value={formData.event_type}
                        onChange={handleChange}
                        placeholder="e.g. Haldi, Sangeet, Wedding"
                        className="w-full bg-white border border-brand-border rounded-lg px-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary transition-shadow placeholder:text-brand-muted"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-brand-navy mb-1.5">Number of Days *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Clock className="text-brand-muted" size={18} />
                        </div>
                        <input
                          type="number"
                          name="number_of_days"
                          min="1"
                          required
                          value={formData.number_of_days}
                          onChange={handleChange}
                          className="w-full bg-white border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary transition-shadow"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-brand-navy mb-1.5">Start Date *</label>
                      <input
                        type="date"
                        name="event_date"
                        required
                        value={formData.event_date}
                        onChange={handleChange}
                        onKeyDown={(e) => e.preventDefault()}
                        onClick={(e) => e.target.showPicker && e.target.showPicker()}
                        className="w-full bg-white border border-brand-border rounded-lg px-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary cursor-pointer transition-shadow"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-brand-navy mb-1.5">End Date *</label>
                      <input
                        type="date"
                        name="end_date"
                        required
                        min={formData.event_date}
                        value={formData.end_date}
                        onChange={handleChange}
                        onKeyDown={(e) => e.preventDefault()}
                        onClick={(e) => e.target.showPicker && e.target.showPicker()}
                        className="w-full bg-white border border-brand-border rounded-lg px-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary cursor-pointer transition-shadow"
                      />
                    </div>
                    
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-brand-navy mb-1.5">Working Hours</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Clock className="text-brand-muted" size={18} />
                          </div>
                          <input
                            type="text"
                            name="working_hours"
                            value={formData.working_hours}
                            onChange={handleChange}
                            placeholder="e.g. 10 AM to 6 PM"
                            className="w-full bg-white border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary transition-shadow placeholder:text-brand-muted"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-brand-navy mb-1.5">Venue Address</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <MapPin className="text-brand-muted" size={18} />
                          </div>
                          <input
                            type="text"
                            name="venue"
                            value={formData.venue}
                            onChange={handleChange}
                            placeholder="Full venue address (optional)"
                            className="w-full bg-white border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary transition-shadow placeholder:text-brand-muted"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: Description */}
                <div className="bg-white p-6 rounded-xl border border-brand-border shadow-sm">
                  <h3 className="text-lg font-bold text-brand-navy mb-5 flex items-center gap-2 border-b border-brand-border pb-3">
                    <AlignLeft className="text-brand-primary" size={20} />
                    Detailed Description
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-semibold text-brand-navy mb-1.5">Requirement Details & Guidelines</label>
                    <textarea
                      name="description"
                      rows="5"
                      value={formData.description}
                      onChange={handleChange}
                      className="w-full bg-white border border-brand-border rounded-lg px-4 py-3 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary transition-shadow placeholder:text-brand-muted resize-none"
                      placeholder="Describe specific camera gear needed, experience required, dress code, or any other important details..."
                    ></textarea>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: Budget, Perks & Actions (Takes 1/3 width) */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Budget Section */}
                <div className="bg-white p-6 rounded-xl border border-brand-border shadow-sm">
                  <h3 className="text-lg font-bold text-brand-navy mb-5 flex items-center gap-2 border-b border-brand-border pb-3">
                    <IndianRupee className="text-brand-primary" size={20} />
                    Budget
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-semibold text-brand-navy mb-1.5">Payment per Freelancer/Day *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <IndianRupee className="text-brand-muted" size={18} />
                      </div>
                      <input
                        type="number"
                        name="payment_per_freelancer"
                        min="0"
                        required
                        value={formData.payment_per_freelancer}
                        onChange={handleChange}
                        placeholder="e.g. 5000"
                        className="w-full bg-white border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary transition-shadow text-lg font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Perks Section */}
                <div className="bg-brand-bg p-6 rounded-xl border border-brand-border">
                  <h3 className="text-md font-bold text-brand-navy mb-4">Additional Perks</h3>
                  <div className="space-y-4">
                    {[
                      { name: 'accommodation', label: 'Accommodation Provided' },
                      { name: 'travel', label: 'Travel Expenses Covered' },
                      { name: 'food', label: 'Food / Catering Included' }
                    ].map(perk => (
                      <label key={perk.name} className="flex items-center space-x-3 cursor-pointer group">
                        <div className={`relative flex items-center justify-center w-5 h-5 border rounded transition-colors ${formData[perk.name] ? 'bg-brand-primary border-brand-primary' : 'border-brand-border bg-white group-hover:border-brand-primary'}`}>
                          <input
                            type="checkbox"
                            name={perk.name}
                            checked={formData[perk.name]}
                            onChange={handleChange}
                            className="absolute opacity-0 w-full h-full cursor-pointer"
                          />
                          {formData[perk.name] && <Check size={14} className="text-white" />}
                        </div>
                        <span className="text-sm font-medium text-brand-navy group-hover:text-brand-primary transition-colors">
                          {perk.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Publish Action Box */}
                <div className="bg-white p-6 rounded-xl border border-brand-primary/30 shadow-sm sticky top-24">
                  <p className="text-xs text-brand-textSec mb-4 text-center">
                    Make sure all mandatory fields (*) are filled out before publishing.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e, 'published')}
                      disabled={loading}
                      className="w-full py-3 rounded-lg bg-brand-primary text-white font-bold hover:bg-brand-primaryDark shadow-md hover:shadow-lg transition-all"
                    >
                      {loading ? 'Publishing...' : 'Publish Requirement'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e, 'draft')}
                      disabled={loading}
                      className="w-full py-3 rounded-lg border border-brand-border text-brand-navy font-semibold hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5 transition-colors"
                    >
                      Save as Draft
                    </button>
                  </div>
                </div>

              </div>
              
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewRequirement;
