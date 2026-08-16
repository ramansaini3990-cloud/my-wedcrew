import { Camera, Video, Plane, Film, BookImage, Lightbulb } from 'lucide-react';

const categories = [
  { name: 'Photographer', icon: Camera, count: '1,200+' },
  { name: 'Cinematographer', icon: Video, count: '850+' },
  { name: 'Drone Pilot', icon: Plane, count: '420+' },
  { name: 'Video Editor', icon: Film, count: '930+' },
  { name: 'Album Designer', icon: BookImage, count: '650+' },
  { name: 'Lightman', icon: Lightbulb, count: '1,500+' },
];

export default function CategoryCards() {
  return (
    <div className="bg-gray-50 py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-brand-dark sm:text-4xl">Browse by Category</h2>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-brand-textSec">
            Find specialized talent for every aspect of your wedding production.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <div
                key={category.name}
                className="group flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-blue-100 cursor-pointer"
              >
                <div className="w-14 h-14 bg-blue-50 text-brand-blue rounded-full flex items-center justify-center group-hover:bg-brand-blue group-hover:text-brand-text transition-colors duration-300">
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-gray-900 text-center">{category.name}</h3>
                <p className="mt-1 text-xs text-brand-textSec">{category.count} pros</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
