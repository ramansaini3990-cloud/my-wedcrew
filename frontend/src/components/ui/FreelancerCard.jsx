import { Star, MapPin, CheckCircle, IndianRupee } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FreelancerCard({ name, category, city, experience, price, image, rating }) {
  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className="glass-card bg-white rounded-2xl overflow-hidden group border border-brand-border hover:border-brand-primary/30 hover:shadow-xl transition-all duration-300 relative"
    >
      {/* Cover/Avatar Image */}
      <div className="h-48 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10"></div>
        <img 
          src={image || "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1000&auto=format&fit=crop"} 
          alt={name} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        {/* Badges */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
          <span className="bg-white/90 backdrop-blur border border-brand-primary/20 text-brand-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
            {category}
          </span>
        </div>
        <div className="absolute top-4 right-4 z-20">
          <span className="bg-brand-success/90 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <CheckCircle size={12} /> Verified
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 relative">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-serif font-bold text-brand-navy mb-1 group-hover:text-brand-primary transition-colors">{name}</h3>
            <p className="text-sm text-brand-textSec flex items-center gap-1">
              <MapPin size={14} className="text-brand-primary" /> {city}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-brand-surface border border-brand-border px-2 py-1 rounded-lg">
            <Star size={14} className="text-brand-primary fill-brand-primary" />
            <span className="text-sm font-bold text-brand-navy">{rating}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-brand-border">
          <div>
            <p className="text-xs text-brand-textSec uppercase tracking-wider mb-1">Experience</p>
            <p className="text-sm font-medium text-brand-navy">{experience} Years</p>
          </div>
          <div>
            <p className="text-xs text-brand-textSec uppercase tracking-wider mb-1">Starting at</p>
            <p className="text-sm font-medium text-brand-navy flex items-center">
              <IndianRupee size={12} className="mr-0.5 text-brand-primary" /> {price}/day
            </p>
          </div>
        </div>

        <button className="w-full btn-primary-outline">
          View Profile
        </button>
      </div>
    </motion.div>
  );
}
