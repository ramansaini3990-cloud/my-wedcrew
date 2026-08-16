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

  if (loading) return <div className="text-brand-text p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-brand-text">Manage Requirements</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-brand-textSec text-sm font-medium">Total Requirements</h3>
          <p className="text-3xl font-bold text-brand-text mt-2">{stats.total || 0}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-brand-textSec text-sm font-medium">Published</h3>
          <p className="text-3xl font-bold text-green-400 mt-2">{stats.published || 0}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-brand-textSec text-sm font-medium">Closed</h3>
          <p className="text-3xl font-bold text-red-400 mt-2">{stats.closed || 0}</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-brand-textSec">
            <thead className="text-xs text-brand-textSec uppercase bg-gray-700/50">
              <tr>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">City</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((req) => (
                <tr key={req.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                  <td className="px-6 py-4 font-medium text-brand-text">{req.company_name}</td>
                  <td className="px-6 py-4">{req.category}</td>
                  <td className="px-6 py-4">{req.city}</td>
                  <td className="px-6 py-4">{new Date(req.event_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <select
                      value={req.status}
                      onChange={(e) => handleStatusChange(req.id, e.target.value)}
                      className={`bg-gray-900 border text-xs rounded-lg px-2 py-1 outline-none
                        ${req.status === 'published' ? 'text-green-400 border-green-500/30' : ''}
                        ${req.status === 'draft' ? 'text-yellow-400 border-yellow-500/30' : ''}
                        ${req.status === 'closed' ? 'text-red-400 border-red-500/30' : ''}
                      `}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(req.id)}
                      className="text-red-400 hover:text-red-300 px-3 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {requirements.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-brand-textSec">
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
