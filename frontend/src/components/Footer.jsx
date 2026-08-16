import { Link } from 'react-router-dom';
import { Crown, Globe, MessageCircle, AtSign, Mail, MapPin, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-brand-surface border-t border-gray-200 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Brand Info */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-2 group">
              <Crown className="text-brand-gold" size={32} />
              <span className="font-serif text-3xl font-bold tracking-wider text-brand-text">
                Wed<span className="text-brand-gold">Crew</span>
              </span>
            </Link>
            <p className="text-brand-textSec text-sm leading-relaxed">
              India's premier network for luxury wedding professionals. Connecting elite cinematographers, photographers, and event crew with premium production houses.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-brand-card flex items-center justify-center text-brand-gold hover:bg-brand-gold hover:text-brand-text transition-colors border border-gray-200">
                <Globe size={18} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-brand-card flex items-center justify-center text-brand-gold hover:bg-brand-gold hover:text-brand-text transition-colors border border-gray-200">
                <MessageCircle size={18} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-brand-card flex items-center justify-center text-brand-gold hover:bg-brand-gold hover:text-brand-text transition-colors border border-gray-200">
                <AtSign size={18} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-serif text-lg text-brand-text mb-6 tracking-wide">Explore</h4>
            <ul className="space-y-4">
              <li><Link to="/freelancers" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm">Find Professionals</Link></li>
              <li><Link to="/requirements" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm">Browse Requirements</Link></li>
              <li><Link to="/pricing" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm">Membership Plans</Link></li>
              <li><Link to="/register" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm">Join as Freelancer</Link></li>
              <li><Link to="/register" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm">Join as Company</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-serif text-lg text-brand-text mb-6 tracking-wide">Legal</h4>
            <ul className="space-y-4">
              <li><Link to="/terms" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm">Privacy Policy</Link></li>
              <li><Link to="/refund" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm">Refund Policy</Link></li>
              <li><Link to="/guidelines" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm">Community Guidelines</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-serif text-lg text-brand-text mb-6 tracking-wide">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="text-brand-gold shrink-0 mt-0.5" size={18} />
                <span className="text-brand-textSec text-sm">123 Luxury Avenue, Film City, Mumbai 400065</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="text-brand-gold shrink-0" size={18} />
                <span className="text-brand-textSec text-sm">+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="text-brand-gold shrink-0" size={18} />
                <span className="text-brand-textSec text-sm">concierge@wedcrew.in</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-brand-textSec text-sm">
            &copy; {new Date().getFullYear()} WedCrew Production Network. All rights reserved.
          </p>
          <p className="text-brand-textSec text-sm flex items-center gap-1">
            Designed for <Crown size={14} className="text-brand-gold mx-1" /> Premium Productions
          </p>
        </div>
      </div>
    </footer>
  );
}
