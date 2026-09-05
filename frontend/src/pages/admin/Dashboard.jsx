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
  <div className="glass-card p-4 rounded-xl flex flex-col group hover:border-brand-primary/30 transition-colors">
    <div className="flex items-start justify-between gap-3 mb-3">
      <h3 className="text-[11px] font-semibold text-brand-textSec uppercase tracking-wider leading-4">{title}</h3>
      <div className="p-1.5 bg-brand-primary/10 text-brand-primary rounded-lg shrink-0">
        <Icon size={16} />
      </div>
    </div>
    <div className="mt-auto">
      <span className="text-2xl font-semibold text-brand-navy tabular-nums leading-none">{value}</span>
      {trend && (
        <p className={`text-[11px] mt-1.5 font-medium flex items-center ${trendUp ? 'text-brand-success' : 'text-brand-danger'}`}>
          <TrendingUp size={12} className={`mr-1 ${!trendUp && 'transform rotate-180'}`} />
          {trend} from last month
        </p>
      )}
    </div>
  </div>
);

/** Relative time for the activity feed, matching the Live Activity page. */
const timeAgo = (iso) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  // The real activity feed, read from the SAME endpoint the Live Activity page
  // uses. This panel previously rendered a hardcoded list naming people who do
  // not exist in the database.
  const [activity, setActivity] = useState([]);
  const [activityError, setActivityError] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/admin/activity-logs?limit=6');
        if (cancelled) return;
        setActivity(res.data?.data || []);
        setActivityError(false);
      } catch {
        if (!cancelled) setActivityError(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          {/* Was "Studio Overview - Welcome back, Director": company-dashboard
              copy, plus a name belonging to nobody. An "Export Report" button
              sat here with no handler; there is no export to run. */}
          <h1 className="text-xl font-semibold text-brand-navy">Dashboard</h1>
          <p className="text-[13px] text-brand-textSec mt-0.5">Platform overview</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* The +12% / +5% trends here were literals, not measurements. Nothing
            computes a month-on-month delta, so no trend is claimed. */}
        <StatCard 
          title="Total Users" 
          value={stats?.summary?.totalUsers || 0} 
          icon={Users}
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
          value={`₹${(stats?.summary?.monthlyRevenue || 0).toLocaleString('en-IN')}`} 
          icon={Wallet}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* User Growth Chart */}
        <div className="glass-card p-4 rounded-xl">
          <h3 className="text-sm font-semibold text-brand-navy mb-4">Network Growth</h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.charts?.userGrowth || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8DEE8" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #D8DEE8', boxShadow: '0 10px 25px -5px rgba(16, 24, 40, 0.10)', color: '#101828' }}
                  itemStyle={{ color: '#1D4ED8' }}
                />
                <Line type="monotone" dataKey="users" stroke="#1D4ED8" strokeWidth={3} dot={{r: 4, fill: '#1D4ED8', strokeWidth: 2, stroke: '#FFFFFF'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Growth Chart */}
        <div className="glass-card p-4 rounded-xl">
          <h3 className="text-sm font-semibold text-brand-navy mb-4">Revenue Overview</h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.charts?.revenueGrowth || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8DEE8" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #D8DEE8', boxShadow: '0 10px 25px -5px rgba(16, 24, 40, 0.10)', color: '#101828' }}
                  cursor={{fill: 'rgba(222, 96, 30, 0.06)'}}
                  itemStyle={{ color: '#1D4ED8' }}
                />
                <Bar dataKey="revenue" fill="#1D4ED8" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity - real entries from the activity log */}
      <div className="glass-card p-4 rounded-xl">
        <h3 className="text-sm font-semibold text-brand-navy mb-4">Recent Activity</h3>
        <div className="space-y-1">
          {activity.map((entry) => (
            <div key={entry.id || entry._id} className="flex items-start gap-3 p-2.5 hover:bg-brand-primary/5 rounded-lg transition-colors">
              <div className="mt-0.5 bg-brand-primary/10 p-1.5 rounded-md text-brand-primary shrink-0">
                <Activity size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-brand-navy">{entry.title}</p>
                <p className="text-[11px] text-brand-textSec mt-0.5">
                  {entry.actor?.name || 'System'} • {timeAgo(entry.created_at)}
                </p>
              </div>
            </div>
          ))}
          {!activity.length && (
            <p className="text-sm text-brand-textSec text-center py-4">
              {activityError ? 'Could not load recent activity.' : 'No recent activity'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
