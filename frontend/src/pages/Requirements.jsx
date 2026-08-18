import { useState, useEffect } from 'react';
import api from '../utils/api';
import RequirementCard from '../components/RequirementCard';

const categories = [
  'Wedding Photographer',
  'Cinematographer',
  'Drone Pilot',
  'Video Editor',
  'Album Designer',
  'Event Assistant'
];

const Requirements = () => {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    city: '',
    category: '',
    date: ''
  });

  const fetchRequirements = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.city) queryParams.append('city', filters.city);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.date) queryParams.append('date', filters.date);

      const response = await api.get(`/api/requirements?${queryParams.toString()}`);
      setRequirements(response.data.data);
    } catch (error) {
      console.error('Failed to fetch requirements', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="container mx-auto px-4 pt-32 pb-12 max-w-6xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-brand-primary mb-4">Premium Hiring Posts</h1>
        <p className="text-brand-textSec">Discover and apply for top-tier wedding production requirements.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <input
          type="text"
          name="city"
          placeholder="Filter by City"
          value={filters.city}
          onChange={handleFilterChange}
          className="flex-1 bg-brand-surface shadow-md border border-brand-border rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
        />
        <select
          name="category"
          value={filters.category}
          onChange={handleFilterChange}
          className="flex-1 bg-brand-surface shadow-md border border-brand-border rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="date"
          name="date"
          value={filters.date}
          onChange={handleFilterChange}
          className="flex-1 bg-brand-surface shadow-md border border-brand-border rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requirements.length > 0 ? (
            requirements.map(req => (
              <RequirementCard key={req.id} req={req} />
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-brand-textSec">
              <svg className="w-16 h-16 mx-auto mb-4 text-brand-textSec" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              No requirements found matching your criteria.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Requirements;
