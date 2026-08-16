import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { MoreVertical, Search, Filter, Edit, Trash2, ShieldCheck, Ban, Star } from 'lucide-react';

const Freelancers = () => {
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchFreelancers(page);
  }, [page]);

  const fetchFreelancers = async (pageNum) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/freelancers?page=${pageNum}&limit=10`);
      setFreelancers(res.data.data);
      setTotalPages(res.data.pagination.pages);
    } catch (error) {
      console.error('Failed to load freelancers', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-brand-text">Freelancers</h1>
          <p className="text-sm text-brand-textSec mt-1 tracking-wide">Manage platform freelancers, approvals, and status.</p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-textSec" size={16} />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full sm:w-64 pl-9 pr-4 py-2 bg-brand-bg border border-gray-200 rounded-xl text-sm text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-brand-textSec hover:text-brand-text hover:bg-white/5 transition-colors">
            <Filter size={16} />
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-brand-textSec">
            <thead className="bg-brand-surface border-b border-gray-200 font-serif text-brand-gold uppercase tracking-widest text-xs">
              <tr>
                <th className="px-6 py-4 font-bold">Name</th>
                <th className="px-6 py-4 font-bold">Profession</th>
                <th className="px-6 py-4 font-bold">Contact</th>
                <th className="px-6 py-4 font-bold">Location</th>
                <th className="px-6 py-4 font-bold">Available Dates</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Joined</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-brand-textSec">
                    <div className="flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-gold"></div></div>
                  </td>
                </tr>
              ) : freelancers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-brand-textSec">No freelancers found.</td>
                </tr>
              ) : (
                freelancers.map((f) => (
                  <tr key={f.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-brand-gold/10 text-brand-gold border border-brand-gold/20 flex items-center justify-center font-serif font-bold group-hover:scale-105 transition-transform">
                          {f.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-serif font-bold text-brand-text tracking-wide">{f.name}</p>
                          <p className="text-xs text-brand-textSec opacity-70">ID: #{f.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-brand-text capitalize">
                      {f.profession || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-brand-text">{f.email}</p>
                      <p className="text-xs text-brand-textSec mt-1">{f.phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      {f.city || 'N/A'}, {f.state || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      {f.available_dates ? (
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {f.available_dates.split(',').slice(0, 3).map((d, i) => (
                            <span key={i} className="text-[10px] bg-brand-gold/10 text-brand-gold px-2 py-0.5 rounded-full whitespace-nowrap">
                              {new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          ))}
                          {f.available_dates.split(',').length > 3 && (
                            <span className="text-[10px] bg-white/5 text-brand-textSec px-2 py-0.5 rounded-full whitespace-nowrap">
                              +{f.available_dates.split(',').length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-brand-textSec italic">No dates</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-success/10 text-brand-success border border-brand-success/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-success shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-brand-textSec hover:text-brand-gold p-2 rounded-lg hover:bg-brand-gold/10 transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-brand-surface/50">
          <p className="text-sm text-brand-textSec">
            Showing page <span className="font-bold text-brand-text">{page}</span> of <span className="font-bold text-brand-text">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-brand-text disabled:opacity-30 disabled:hover:bg-transparent hover:bg-white/5 transition-colors"
            >
              Previous
            </button>
            <button 
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-brand-text disabled:opacity-30 disabled:hover:bg-transparent hover:bg-white/5 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Freelancers;
