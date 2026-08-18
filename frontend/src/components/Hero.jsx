import { Search } from 'lucide-react';

export default function Hero() {
  return (
    <div className="relative bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32 pt-16 sm:pt-24 lg:pt-32 px-4 sm:px-6 lg:px-8">
          <main className="mx-auto max-w-7xl">
            <div className="sm:text-center lg:text-left">
              <h1 className="text-4xl tracking-tight font-extrabold text-brand-navy sm:text-5xl md:text-6xl font-serif">
                <span className="block xl:inline">Find Verified</span>{' '}
                <span className="block text-brand-primary xl:inline">Wedding Professionals</span>
                <span className="block xl:inline"> Across India</span>
              </h1>
              <p className="mt-3 text-base text-brand-textSec sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                The premier marketplace for top-tier photographers, cinematographers, drone pilots, and wedding crew. Connect, collaborate, and create magic.
              </p>
              
              {/* Search Bar UI */}
              <div className="mt-8 sm:max-w-lg sm:mx-auto lg:mx-0 flex rounded-full shadow-lg border border-brand-border bg-white p-2">
                <div className="flex-grow flex items-center pl-4 pr-2">
                  <Search className="h-5 w-5 text-brand-primary" />
                  <input
                    type="text"
                    className="w-full pl-3 pr-3 py-2 text-brand-navy bg-transparent outline-none placeholder-brand-muted"
                    placeholder="E.g. Cinematographer in Mumbai..."
                  />
                </div>
                <button className="btn-primary rounded-full px-6 py-3 font-medium transition-colors">
                  Search
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
      <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2 bg-brand-bg flex items-center justify-center p-12">
        <div className="grid grid-cols-2 gap-4 w-full h-full max-h-[600px] opacity-80">
           <div className="bg-brand-primary/10 rounded-3xl h-full shadow-inner animate-pulse"></div>
           <div className="bg-brand-primary/5 rounded-3xl h-4/5 mt-auto shadow-inner animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}
