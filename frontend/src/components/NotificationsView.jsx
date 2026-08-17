import { useState, useEffect } from 'react';
import { Bell, CheckCircle, Clock, XCircle, Briefcase } from 'lucide-react';
import api from '../utils/api';

export default function NotificationsView({ onNotificationClick }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/notifications');
      setNotifications(res.data.data);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const handleItemClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  if (loading) return <div className="p-12 text-center text-brand-textSec">Loading notifications...</div>;

  if (notifications.length === 0) return (
    <div className="p-12 text-center flex flex-col items-center justify-center">
      <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
        <Bell className="text-brand-textSec/50" size={32} />
      </div>
      <h3 className="text-lg font-bold text-brand-navy mb-1">No notifications</h3>
      <p className="text-brand-textSec text-sm">You're all caught up!</p>
    </div>
  );

  return (
    <div className="divide-y divide-gray-100">
      {notifications.map((notif) => (
        <div 
          key={notif.id} 
          onClick={() => handleItemClick(notif)}
          className={`p-6 cursor-pointer hover:bg-gray-50 transition-colors ${!notif.is_read ? 'bg-brand-primary/5' : ''}`}
        >
          <div className="flex gap-4">
            <div className={`mt-1 flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
              notif.type.includes('accepted') ? 'bg-green-100 text-green-600' :
              notif.type.includes('rejected') ? 'bg-red-100 text-red-600' :
              notif.type.includes('shortlisted') ? 'bg-blue-100 text-blue-600' :
              'bg-brand-primary/10 text-brand-primary'
            }`}>
              <Bell size={18} />
            </div>
            <div>
              <h4 className={`text-sm font-bold ${!notif.is_read ? 'text-brand-navy' : 'text-gray-700'}`}>{notif.title}</h4>
              <p className="text-sm text-brand-textSec mt-1">{notif.message}</p>
              <p className="text-xs text-gray-400 mt-2">{new Date(notif.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}