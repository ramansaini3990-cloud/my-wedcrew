import { Star, MapPin, CheckCircle, IndianRupee } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FreelancerCard({ name, category, city, experience, price, image, rating }) {
  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className="glass-card rounded-2xl overflow-hidden group border border-gray-200 hover:border-brand-gold/30 hover:shadow-[0_10px_40px_rgba(212,175,55,0.15)] transition-all duration-300 relative"
    >
      {/* Cover/Avatar Image */}
      <div className="h-48 relative overflow-hidden">
        <div className="absolute inset-0 bg-dark-gradient z-10"></div>
        <img 
          src={image || "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1000&auto=format&fit=crop"} 
          alt={name} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        {/* Badges */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
          <span className="bg-brand-bg/80 backdrop-blur border border-brand-gold/30 text-brand-gold text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            {category}
          </span>
        </div>
        <div className="absolute top-4 right-4 z-20">
          <span className="bg-brand-success/90 backdrop-blur text-brand-text text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <CheckCircle size={12} /> Verified
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 relative">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-serif font-bold text-brand-text mb-1 group-hover:text-brand-gold transition-colors">{name}</h3>
            <p className="text-sm text-brand-textSec flex items-center gap-1">
              <MapPin size={14} className="text-brand-gold" /> {city}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-brand-surface border border-gray-200 px-2 py-1 rounded-lg">
            <Star size={14} className="text-brand-gold fill-brand-gold" />
            <span className="text-sm font-bold text-brand-text">{rating}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-gray-200">
          <div>
            <p className="text-xs text-brand-textSec uppercase tracking-wider mb-1">Experience</p>
            <p className="text-sm font-medium text-brand-text">{experience} Years</p>
          </div>
          <div>
            <p className="text-xs text-brand-textSec uppercase tracking-wider mb-1">Starting at</p>
            <p className="text-sm font-medium text-brand-text flex items-center">
              <IndianRupee size={12} className="mr-0.5 text-brand-gold" /> {price}/day
            </p>
          </div>
        </div>

        <button className="w-full btn-outline">
          View Profile
        </button>
      </div>
    </motion.div>
  );
}
