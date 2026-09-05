import { Link } from 'react-router-dom';
import { Crown, Mail, MapPin, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-brand-navy pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Brand Info */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-2 group">
              <Crown className="text-brand-primary" size={32} />
              <span className="font-serif text-xl font-bold tracking-wide text-white whitespace-nowrap">
                mywed<span className="text-brand-primary">crew</span><span className="text-white/55">.com</span>
              </span>
            </Link>
            <p className="text-white/60 text-[13px] leading-relaxed">
              India's premier network for luxury wedding professionals. Connecting elite cinematographers, photographers, and event crew with premium production houses.
            </p>
            <div className="flex gap-4">
              {/* Three social icons linked to href="#" - they went nowhere and
                 no accounts are configured. Restore them when there are real
                 profile URLs to point at. The concierge address below is a
                 working contact route in the meantime. */}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-serif text-[15px] font-bold text-white mb-5 tracking-wide">Explore</h4>
            <ul className="space-y-4">
              <li><Link to="/freelancers" className="text-white/60 hover:text-brand-primary transition-colors text-[13px]">Find Professionals</Link></li>
              <li><Link to="/requirements" className="text-white/60 hover:text-brand-primary transition-colors text-[13px]">Browse Requirements</Link></li>
              <li><Link to="/#pricing" className="text-white/60 hover:text-brand-primary transition-colors text-[13px]">Membership Plans</Link></li>
              <li><Link to="/register" className="text-white/60 hover:text-brand-primary transition-colors text-[13px]">Join as Freelancer</Link></li>
              <li><Link to="/register" className="text-white/60 hover:text-brand-primary transition-colors text-[13px]">Join as Company</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-serif text-[15px] font-bold text-white mb-5 tracking-wide">Legal</h4>
            <ul className="space-y-4">
              <li><Link to="/terms" className="text-white/60 hover:text-brand-primary transition-colors text-[13px]">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-white/60 hover:text-brand-primary transition-colors text-[13px]">Privacy Policy</Link></li>
              <li><Link to="/refund" className="text-white/60 hover:text-brand-primary transition-colors text-[13px]">Refund Policy</Link></li>
              <li><Link to="/guidelines" className="text-white/60 hover:text-brand-primary transition-colors text-[13px]">Community Guidelines</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-serif text-[15px] font-bold text-white mb-5 tracking-wide">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="text-brand-primary shrink-0 mt-0.5" size={18} />
                <span className="text-white/50 text-[12px]">123 Luxury Avenue, Film City, Mumbai 400065</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="text-brand-primary shrink-0" size={18} />
                <span className="text-white/50 text-[12px]">+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="text-brand-primary shrink-0" size={18} />
                <span className="text-white/50 text-[12px]">concierge@wedcrew.in</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-7 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/50 text-[12px]">
            &copy; {new Date().getFullYear()} mywedcrew.com. All rights reserved.
          </p>
          <p className="text-brand-textSec text-sm flex items-center gap-1">
            Designed for <Crown size={14} className="text-brand-primary mx-1" /> Premium Productions
          </p>
        </div>
      </div>
    </footer>
  );
}
