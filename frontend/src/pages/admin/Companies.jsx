import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { MoreVertical, Search, Filter, Briefcase } from 'lucide-react';

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchCompanies(page);
  }, [page]);

  const fetchCompanies = async (pageNum) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/companies?page=${pageNum}&limit=10`);
      setCompanies(res.data.data);
      setTotalPages(res.data.pagination.pages);
    } catch (error) {
      console.error('Failed to load companies', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-brand-navy">Companies</h1>
          <p className="text-[13px] text-brand-textSec mt-0.5">Manage registered companies and their details.</p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-brand-textSec" size={15} />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full sm:w-56 pl-8 pr-3 h-9 bg-brand-bg border border-brand-border rounded-lg text-[13px] text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary"
            />
          </div>
          <button className="flex items-center gap-2 px-3 h-9 border border-brand-border rounded-lg text-[13px] font-medium text-brand-navy hover:text-brand-primary hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-colors">
            <Filter size={16} />
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-card rounded-xl overflow-hidden border border-brand-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-brand-textSec">
            <thead className="bg-brand-surface border-b border-brand-border text-brand-textSec uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3 font-bold">Company Name</th>
                <th className="px-4 py-3 font-bold">Contact Details</th>
                <th className="px-4 py-3 font-bold">Location</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Joined Date</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-brand-textSec">
                    <div className="flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div></div>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-brand-textSec">No companies found.</td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.id} className="hover:bg-brand-primary/5 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-brand-surface text-brand-primary border border-brand-border flex items-center justify-center font-semibold text-[13px] group-hover:scale-105 transition-transform">
                          <Briefcase size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-brand-navy">{c.name}</p>
                          <p className="text-xs text-brand-textSec opacity-70">ID: #{c.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-brand-text">{c.email}</p>
                      <p className="text-xs text-brand-textSec mt-1">{c.phone || 'N/A'}</p>
                    </td>
                    <td className="px-4 py-3">
                      {c.city || 'N/A'}, {c.state || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-success/10 text-brand-success border border-brand-success/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-success shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-brand-textSec hover:text-brand-primary p-2 rounded-lg hover:bg-brand-primary/10 transition-colors">
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
        <div className="px-4 py-3 border-t border-brand-border flex items-center justify-between bg-brand-surface/50">
          <p className="text-sm text-brand-textSec">
            Showing page <span className="font-bold text-brand-text">{page}</span> of <span className="font-bold text-brand-text">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-4 py-2 border border-brand-border rounded-lg text-sm font-medium text-brand-navy hover:text-brand-primary hover:border-brand-primary/40 disabled:opacity-30 disabled:hover:bg-transparent hover:bg-brand-primary/5 transition-colors">
              Previous
            </button>
            <button 
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-4 py-2 border border-brand-border rounded-lg text-sm font-medium text-brand-navy hover:text-brand-primary hover:border-brand-primary/40 disabled:opacity-30 disabled:hover:bg-transparent hover:bg-brand-primary/5 transition-colors">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Companies;
