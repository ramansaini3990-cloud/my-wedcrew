import { useState, useEffect } from 'react';
import api from '../../utils/api';

const AdminRequirements = () => {
  const [requirements, setRequirements] = useState([]);
  const [stats, setStats] = useState({ total: 0, published: 0, closed: 0 });
  const [loading, setLoading] = useState(true);

  const fetchRequirements = async () => {
    try {
      const { data } = await api.get('/api/admin/requirements');
      setRequirements(data.data);
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch admin requirements', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/api/admin/requirements/${id}/status`, { status: newStatus });
      fetchRequirements();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this requirement?')) {
      try {
        await api.delete(`/api/admin/requirements/${id}`);
        fetchRequirements();
      } catch (error) {
        alert('Failed to delete requirement');
      }
    }
  };

  if (loading) return <div className="text-brand-textSec p-8">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-brand-navy">Manage Requirements</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-brand-surface p-4 rounded-xl border border-brand-border shadow-sm">
          <h3 className="text-[11px] font-semibold text-brand-textSec uppercase tracking-wider">Total Requirements</h3>
          <p className="text-2xl font-semibold text-brand-navy tabular-nums mt-1.5 leading-none">{stats.total || 0}</p>
        </div>
        <div className="bg-brand-surface p-4 rounded-xl border border-brand-border shadow-sm">
          <h3 className="text-[11px] font-semibold text-brand-textSec uppercase tracking-wider">Published</h3>
          <p className="text-2xl font-semibold text-green-600 tabular-nums mt-1.5 leading-none">{stats.published || 0}</p>
        </div>
        <div className="bg-brand-surface p-4 rounded-xl border border-brand-border shadow-sm">
          <h3 className="text-[11px] font-semibold text-brand-textSec uppercase tracking-wider">Closed</h3>
          <p className="text-2xl font-semibold text-red-600 tabular-nums mt-1.5 leading-none">{stats.closed || 0}</p>
        </div>
      </div>

      <div className="bg-brand-surface rounded-xl border border-brand-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-brand-textSec">
            <thead className="text-xs text-brand-textSec uppercase bg-brand-bg border-b border-brand-border">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((req) => (
                <tr key={req.id} className="border-b border-brand-border last:border-0 hover:bg-brand-primary/5 transition-colors">
                  <td className="px-4 py-3 font-medium text-brand-navy">{req.company_name}</td>
                  <td className="px-4 py-3">{req.category}</td>
                  <td className="px-4 py-3">{req.city}</td>
                  <td className="px-4 py-3">{new Date(req.event_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={req.status}
                      onChange={(e) => handleStatusChange(req.id, e.target.value)}
                      className={`bg-brand-surface border text-xs rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary transition-shadow
                        ${req.status === 'published' ? 'text-green-700 border-green-500/40' : ''}
                        ${req.status === 'draft' ? 'text-yellow-700 border-yellow-500/40' : ''}
                        ${req.status === 'closed' ? 'text-red-700 border-red-500/40' : ''}
                      `}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(req.id)}
                      className="text-red-600 hover:text-red-700 px-3 py-1 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {requirements.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-brand-textSec">
                    No requirements found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminRequirements;
