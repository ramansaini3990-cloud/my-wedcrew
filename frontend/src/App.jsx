import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import FreelancerDashboard from './pages/FreelancerDashboard';
import CompanyDashboard from './pages/CompanyDashboard';
import NewRequirement from './pages/company/NewRequirement';
import Requirements from './pages/Requirements';
import Professionals from './pages/Professionals';
import PublicProfile from './pages/PublicProfile';
import RequirementDetail from './pages/RequirementDetail';
import Messages from './pages/Messages';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Admin imports
import ErrorBoundary from './components/ErrorBoundary';
import AdminLayout from './components/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Freelancers from './pages/admin/Freelancers';
import Companies from './pages/admin/Companies';
import AdminRequirements from './pages/admin/Requirements';
import Subscriptions from './pages/admin/Subscriptions';
import AdminComingSoon from './pages/admin/ComingSoon';
import AdminMasterData from './pages/admin/MasterData';
import AdminActivityLog from './pages/admin/ActivityLog';
import AdminFinance from './pages/admin/Finance';
import AdminEmailLogs from './pages/admin/EmailLogs';
import AdminNotifications from './pages/admin/Notifications';
import AdminSettings from './pages/admin/Settings';

import ScrollToTop from './components/ScrollToTop';
import DocumentTitle from './components/DocumentTitle';

function App() {
  return (
    <AuthProvider>
      <Router>
        <SocketProvider>
          <ScrollToTop />
          <DocumentTitle />
          <Routes>
            {/* Main App Layout */}
            <Route path="/" element={
              <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-grow">
                  <Outlet />
                </main>
                <Footer />
              </div>
            }>
              <Route index element={<Home />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="verify-email" element={<VerifyEmail />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="reset-password" element={<ResetPassword />} />
              <Route path="requirements" element={<Requirements />} />
              <Route path="requirements/:id" element={<RequirementDetail />} />
              <Route path="professionals/:id" element={<PublicProfile />} />
              <Route path="freelancers" element={<Professionals />} />
              <Route 
                path="messages" 
                element={
                  <ProtectedRoute allowedRoles={['freelancer', 'company']}>
                    <Messages />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="company/requirements/new" 
                element={
                  <ProtectedRoute allowedRoles={['company']}>
                    <NewRequirement />
                  </ProtectedRoute>
                } 
              />
            </Route>

            {/* Dashboard shells.
                Deliberately OUTSIDE the public layout above: rendering them
                inside it put the public Navbar (with its own logout and a
                "Dashboard" link) on top of the dashboard sidebar. Each
                dashboard now renders its own DashboardShell, the same way
                /admin renders AdminLayout. The paths are unchanged, so every
                existing link still works. */}
            <Route
              path="/freelancer/dashboard"
              element={
                <ProtectedRoute allowedRoles={['freelancer']}>
                  <FreelancerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/dashboard"
              element={
                <ProtectedRoute allowedRoles={['company']}>
                  <CompanyDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin Layout */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ErrorBoundary>
                    <AdminLayout />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="freelancers" element={<Freelancers />} />
              <Route path="companies" element={<Companies />} />
              <Route path="requirements" element={<AdminRequirements />} />
              <Route path="subscriptions" element={<Subscriptions />} />
              <Route path="master-data" element={<AdminMasterData />} />
              <Route path="activity-logs" element={<AdminActivityLog />} />
              <Route path="payments" element={<AdminFinance />} />
              <Route path="email-logs" element={<AdminEmailLogs />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="*" element={<AdminComingSoon />} />
            </Route>
          </Routes>
        </SocketProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;
