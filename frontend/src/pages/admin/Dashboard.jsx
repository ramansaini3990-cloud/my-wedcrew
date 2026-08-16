import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { 
  Users, 
  Briefcase, 
  CreditCard, 
  Wallet,
  TrendingUp,
  UserPlus,
  Activity
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

const StatCard = ({ title, value, icon: Icon, trend, trendUp }) => (
  <div className="glass-card p-6 rounded-2xl flex flex-col group hover:border-brand-gold/30 transition-colors relative overflow-hidden">
    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 group-hover:-rotate-12">
      <Icon size={120} />
    </div>
    <div className="flex items-center justify-between mb-4 relative z-10">
      <h3 className="text-xs font-medium text-brand-textSec uppercase tracking-wider">{title}</h3>
      <div className="p-2 bg-brand-gold/10 text-brand-gold rounded-lg border border-brand-gold/20">
        <Icon size={20} />
      </div>
    </div>
    <div className="mt-auto relative z-10">
      <span className="text-3xl font-serif text-brand-text">{value}</span>
      {trend && (
        <p className={`text-xs mt-2 font-medium flex items-center ${trendUp ? 'text-brand-success' : 'text-brand-danger'}`}>
          <TrendingUp size={14} className={`mr-1 ${!trendUp && 'transform rotate-180'}`} />
          {trend} from last month
        </p>
      )}
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/api/admin/dashboard/stats');
        setStats(res.data);
      } catch (error) {
        console.error('Failed to load stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-brand-text">Studio Overview</h1>
          <p className="text-sm text-brand-gold mt-1 tracking-wider uppercase">Welcome back, Director</p>
        </div>
        <button className="btn-gold text-sm shadow-[0_0_15px_rgba(212,175,55,0.2)]">
          Export Report
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatCard 
          title="Total Users" 
          value={stats?.summary?.totalUsers || 0} 
          icon={Users}
          trend="+12%"
          trendUp={true}
        />
        <StatCard 
          title="Total Freelancers" 
          value={stats?.summary?.totalFreelancers || 0} 
          icon={UserPlus} 
        />
        <StatCard 
          title="Total Companies" 
          value={stats?.summary?.totalCompanies || 0} 
          icon={Briefcase} 
        />
        <StatCard 
          title="Monthly Revenue" 
          value={`$${(stats?.summary?.monthlyRevenue || 0).toLocaleString()}`} 
          icon={Wallet}
          trend="+5%"
          trendUp={true}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        
        {/* User Growth Chart */}
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="text-xl font-serif font-bold text-brand-text mb-6">Network Growth</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.charts?.userGrowth || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#A1A1AA', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#A1A1AA', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171A21', borderRadius: '12px', border: '1px solid #ffffff10', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', color: '#fff' }}
                  itemStyle={{ color: '#D4AF37' }}
                />
                <Line type="monotone" dataKey="users" stroke="#D4AF37" strokeWidth={3} dot={{r: 4, fill: '#D4AF37', strokeWidth: 2, stroke: '#171A21'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Growth Chart */}
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="text-xl font-serif font-bold text-brand-text mb-6">Revenue Overview</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.charts?.revenueGrowth || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#A1A1AA', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#A1A1AA', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171A21', borderRadius: '12px', border: '1px solid #ffffff10', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', color: '#fff' }}
                  cursor={{fill: '#ffffff05'}}
                  itemStyle={{ color: '#D4AF37' }}
                />
                <Bar dataKey="revenue" fill="#D4AF37" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8 glass-card p-6 rounded-2xl">
        <h3 className="text-xl font-serif font-bold text-brand-text mb-6">Recent Activity</h3>
        <div className="space-y-4">
          {stats?.recentActivity?.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4 p-4 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-gray-200">
              <div className="mt-1 bg-brand-gold/10 p-2 rounded-lg text-brand-gold border border-brand-gold/20">
                <Activity size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-brand-text">{activity.action}</p>
                <p className="text-xs text-brand-textSec mt-1">{activity.user} • {activity.time}</p>
              </div>
            </div>
          ))}
          {!stats?.recentActivity?.length && (
            <p className="text-sm text-brand-textSec text-center py-4">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
