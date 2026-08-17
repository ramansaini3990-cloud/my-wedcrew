import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Camera, Video, Plane, Scissors, Star, ShieldCheck, Clock, MapPin, CheckCircle } from 'lucide-react';

export default function Home() {
  const categories = [
    { name: 'Cinematographer', icon: Video, count: '320+' },
    { name: 'Traditional Photographer', icon: Camera, count: '450+' },
    { name: 'Drone Pilot', icon: Plane, count: '150+' },
    { name: 'Video Editor', icon: Scissors, count: '280+' },
  ];

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="bg-brand-bg text-brand-text min-h-screen">
      
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Video/Image Overlay */}
        <div className="absolute inset-0 z-0 bg-brand-navy">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline
            poster="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069&auto=format&fit=crop"
            className="w-full h-full object-cover object-center opacity-60"
          >
            <source src="/videos/wedding-hero.mp4" type="video/mp4" />
          </video>
          {/* Cinematic overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/60 via-brand-navy/30 to-brand-bg"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center mt-20">
          <motion.div
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.8 }}
            variants={fadeUp}
          >
            <span className="text-brand-gold uppercase tracking-[0.3em] text-sm font-semibold mb-6 block drop-shadow-md">
              INDIA'S PREMIUM WEDDING PRODUCTION NETWORK
            </span>
            <h1 className="text-5xl md:text-7xl font-serif font-bold text-white leading-tight mb-6 drop-shadow-lg">
              Bring Your Wedding <br />
              <span className="text-brand-gold italic">Vision to Life.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-200 max-w-3xl mx-auto mb-10 font-light leading-relaxed drop-shadow-md">
              Hire verified cinematographers, drone pilots, and elite event crew for high-end destination weddings and cinematic films.
            </p>
            
            {/* Glassmorphism Search */}
            <div className="max-w-2xl mx-auto bg-white/90 backdrop-blur-md rounded-full p-2 flex items-center mb-10 shadow-2xl border border-white/20">
              <div className="pl-6 pr-4">
                <Search className="text-brand-primary" size={24} />
              </div>
              <input 
                type="text" 
                placeholder="Search for 'Cinematographer in Udaipur'..." 
                className="w-full bg-transparent border-none text-brand-navy placeholder-gray-500 focus:outline-none text-lg py-3"
              />
              <button className="btn-primary rounded-full px-8 py-3 shrink-0 ml-2 shadow-lg">
                Search
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link to="/freelancers" className="text-white hover:text-brand-gold transition-colors font-medium tracking-wide drop-shadow-md">Browse Professionals</Link>
              <div className="w-1.5 h-1.5 rounded-full bg-brand-gold hidden sm:block"></div>
              <Link to="/register" className="text-white hover:text-brand-gold transition-colors font-medium tracking-wide drop-shadow-md">Join as a Freelancer</Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-24 bg-brand-surface border-y border-gray-200 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            transition={{ duration: 0.6 }} variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-serif font-bold text-brand-navy mb-4">Elite Categories</h2>
            <div className="w-24 h-1 bg-primary-gradient mx-auto rounded-full"></div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="glass-card p-8 group hover:border-brand-primary/50 cursor-pointer transition-all duration-300 hover:-translate-y-2 relative overflow-hidden bg-white shadow-lg border border-gray-100 rounded-2xl"
              >
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 group-hover:-rotate-12">
                  <cat.icon size={120} className="text-brand-primary" />
                </div>
                <cat.icon size={36} className="text-brand-primary mb-6 relative z-10" />
                <h3 className="text-xl font-serif font-bold text-brand-navy mb-2 relative z-10">{cat.name}</h3>
                <p className="text-brand-textSec text-sm relative z-10">{cat.count} verified experts</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              transition={{ duration: 0.6 }} variants={fadeUp}
            >
              <h2 className="text-4xl font-serif font-bold text-brand-navy mb-6 leading-tight">
                The Gold Standard in <br/> Wedding Production
              </h2>
              <p className="text-brand-textSec text-lg mb-8 leading-relaxed font-light">
                We've built an exclusive ecosystem designed specifically for production houses managing high-net-worth client events. Quality, reliability, and cinematic excellence are guaranteed.
              </p>
              
              <div className="space-y-6">
                {[
                  { icon: ShieldCheck, title: 'KYC Verified Profiles', desc: 'Every crew member undergoes strict background and equipment verification.' },
                  { icon: Clock, title: 'Real-time Availability', desc: 'Book instantly using our synced calendar system to avoid double-bookings.' },
                  { icon: MapPin, title: 'Pan-India Network', desc: 'Source local talent for destination weddings without bearing travel costs.' }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="mt-1 w-12 h-12 shrink-0 rounded-full bg-brand-surface border border-brand-primary/20 flex items-center justify-center text-brand-primary shadow-sm">
                      <item.icon size={20} />
                    </div>
                    <div>
                      <h4 className="text-lg font-serif font-bold text-brand-navy mb-1">{item.title}</h4>
                      <p className="text-brand-textSec text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-primary-gradient rounded-3xl transform rotate-3 scale-[1.02] opacity-20 blur-xl"></div>
              <img 
                src="https://images.unsplash.com/photo-1606800052052-a08af7148866?q=80&w=2070&auto=format&fit=crop" 
                alt="Cinematic production" 
                className="relative rounded-3xl object-cover h-[600px] w-full border border-gray-200 shadow-2xl"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing/Subscriptions */}
      <section className="py-24 bg-brand-surface border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            transition={{ duration: 0.6 }} variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-serif font-bold text-brand-navy mb-4">Elite Memberships</h2>
            <div className="w-24 h-1 bg-primary-gradient mx-auto rounded-full mb-6"></div>
            <p className="text-brand-textSec max-w-2xl mx-auto">Choose a plan that fits your production scale.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Standard */}
            <div className="glass-card rounded-2xl p-8 border border-gray-200 relative bg-white">
              <h3 className="text-xl font-serif text-brand-navy mb-2">Essential</h3>
              <div className="text-3xl font-bold text-brand-navy mb-6">₹1,999<span className="text-lg text-brand-textSec font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8">
                <li className="flex gap-3 text-sm text-brand-textSec"><CheckCircle size={18} className="text-brand-primary shrink-0" /> Basic profile listing</li>
                <li className="flex gap-3 text-sm text-brand-textSec"><CheckCircle size={18} className="text-brand-primary shrink-0" /> Standard support</li>
                <li className="flex gap-3 text-sm text-brand-textSec opacity-50"><CheckCircle size={18} className="text-gray-400 shrink-0" /> No featured listing</li>
              </ul>
              <button className="w-full btn-primary-outline">Choose Plan</button>
            </div>

            {/* Premium - Highlighted */}
            <div className="glass-card rounded-2xl p-8 border-2 border-brand-primary relative transform md:-translate-y-4 shadow-xl bg-white">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-primary-gradient text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                Most Popular
              </div>
              <h3 className="text-xl font-serif text-brand-primary mb-2">Signature</h3>
              <div className="text-4xl font-bold text-brand-navy mb-6">₹4,999<span className="text-lg text-brand-textSec font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8">
                <li className="flex gap-3 text-sm text-brand-textSec"><CheckCircle size={18} className="text-brand-primary shrink-0" /> Featured profile listing</li>
                <li className="flex gap-3 text-sm text-brand-textSec"><CheckCircle size={18} className="text-brand-primary shrink-0" /> Priority booking requests</li>
                <li className="flex gap-3 text-sm text-brand-textSec"><CheckCircle size={18} className="text-brand-primary shrink-0" /> Dedicated account manager</li>
              </ul>
              <button className="w-full btn-primary">Upgrade to Signature</button>
            </div>

            {/* Studio */}
            <div className="glass-card rounded-2xl p-8 border border-gray-200 relative bg-white">
              <h3 className="text-xl font-serif text-brand-navy mb-2">Studio</h3>
              <div className="text-3xl font-bold text-brand-navy mb-6">₹9,999<span className="text-lg text-brand-textSec font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8">
                <li className="flex gap-3 text-sm text-brand-textSec"><CheckCircle size={18} className="text-brand-primary shrink-0" /> Multiple crew accounts</li>
                <li className="flex gap-3 text-sm text-brand-textSec"><CheckCircle size={18} className="text-brand-primary shrink-0" /> Unlimited requirements</li>
                <li className="flex gap-3 text-sm text-brand-textSec"><CheckCircle size={18} className="text-brand-primary shrink-0" /> Premium API access</li>
              </ul>
              <button className="w-full btn-primary-outline">Contact Sales</button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
