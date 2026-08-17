import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';

const Subscriptions = () => {
  const { token } = useContext(AuthContext);
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    planId: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    amount: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subsRes, plansRes, freelancersRes, companiesRes] = await Promise.all([
        axios.get('http://localhost:5000/api/admin/subscriptions', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:5000/api/admin/plans', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:5000/api/admin/freelancers', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:5000/api/admin/companies', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setSubscriptions(subsRes.data);
      setPlans(plansRes.data);
      setUsers([...freelancersRes.data.data, ...companiesRes.data.data]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    try {
      await axios.post('http://localhost:5000/api/admin/plans', {
        name: 'PREMIUM',
        description: 'Premium plan with chat access',
        price: 4999,
        billing_period: 'monthly',
        currency: 'INR',
        features: ['chat', 'profile_visibility'],
        isActive: true
      }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
      alert('Default PREMIUM plan created successfully!');
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Failed to create plan');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.user_id || !formData.planId) return alert('Please select a user and a plan');
    
    try {
      await axios.post('http://localhost:5000/api/admin/subscriptions', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowForm(false);
      fetchData();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to assign subscription');
    }
  };

  const updateStatus = async (id, status) => {
    if (!window.confirm(`Are you sure you want to change status to ${status}?`)) return;
    try {
      await axios.put(`http://localhost:5000/api/admin/subscriptions/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div className="p-6">Loading subscriptions...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-brand-navy">User Subscriptions</h2>
        <div className="flex gap-4">
          {plans.length === 0 && (
            <button onClick={handleCreatePlan} className="px-4 py-2 bg-brand-gold text-white rounded font-medium hover:bg-yellow-600">
              Create Default Plan
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-brand-primary text-white rounded font-medium hover:bg-brand-primaryLight">
            {showForm ? 'Cancel' : 'Assign Subscription'}
          </button>
        </div>
      </div>
      
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-8 border border-gray-200">
          <h3 className="text-lg font-bold mb-4 text-brand-navy">Assign New Subscription</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
              <select 
                required
                value={formData.user_id} 
                onChange={e => setFormData({...formData, user_id: e.target.value})}
                className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">-- Select User --</option>
                {users.map(u => (
                  <option key={u._id || u.id} value={u._id || u.id}>{u.name} ({u.role}) - {u.email}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Plan</label>
              <select 
                required
                value={formData.planId} 
                onChange={e => setFormData({...formData, planId: e.target.value})}
                className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">-- Select Plan --</option>
                {plans.map(p => (
                  <option key={p._id || p.id} value={p._id || p.id}>{p.name} - ₹{p.price}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input 
                type="date" required
                value={formData.start_date}
                onChange={e => setFormData({...formData, start_date: e.target.value})}
                className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input 
                type="date" required
                value={formData.end_date}
                onChange={e => setFormData({...formData, end_date: e.target.value})}
                className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Override Amount (Optional)</label>
              <input 
                type="number"
                placeholder="Leave blank to use plan price"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            
            <div className="md:col-span-2 mt-2">
              <button type="submit" className="px-6 py-2 bg-brand-primary text-white rounded font-medium shadow hover:bg-brand-primaryLight w-full md:w-auto">
                Activate Subscription
              </button>
            </div>
          </form>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-100 text-gray-700 text-sm">
                <th className="p-4 border-b font-semibold">User</th>
                <th className="p-4 border-b font-semibold">Plan</th>
                <th className="p-4 border-b font-semibold">Amount</th>
                <th className="p-4 border-b font-semibold">Dates</th>
                <th className="p-4 border-b font-semibold">Status</th>
                <th className="p-4 border-b font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50 border-b">
                  <td className="p-4">
                    <div className="font-medium text-brand-navy">{sub.user_id?.name || 'Unknown User'}</div>
                    <div className="text-xs text-gray-500">{sub.user_id?.email}</div>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-brand-gold">{sub.plan_name}</span>
                  </td>
                  <td className="p-4 text-brand-text">₹{sub.amount}</td>
                  <td className="p-4 text-sm text-gray-600">
                    <div>Start: {new Date(sub.start_date).toLocaleDateString()}</div>
                    <div>End: {new Date(sub.end_date).toLocaleDateString()}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 inline-flex rounded-full text-xs font-bold tracking-wide ${
                      sub.status === 'active' ? 'bg-green-100 text-green-700' :
                      sub.status === 'expired' ? 'bg-red-100 text-red-700' :
                      sub.status === 'cancelled' ? 'bg-gray-200 text-gray-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {sub.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4">
                    {sub.status === 'active' ? (
                      <button onClick={() => updateStatus(sub.id, 'paused')} className="text-yellow-600 hover:text-yellow-700 mr-3 text-sm font-medium transition-colors">Pause</button>
                    ) : (
                      <button onClick={() => updateStatus(sub.id, 'active')} className="text-green-600 hover:text-green-700 mr-3 text-sm font-medium transition-colors">Activate</button>
                    )}
                    <button onClick={() => updateStatus(sub.id, 'expired')} className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors">Expire</button>
                  </td>
                </tr>
              ))}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-gray-500 font-medium">
                    No subscriptions found. Use the "Assign Subscription" button above to create one.
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

export default Subscriptions;
