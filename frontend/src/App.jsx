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
import Messages from './pages/Messages';

// Admin imports
import ErrorBoundary from './components/ErrorBoundary';
import AdminLayout from './components/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Freelancers from './pages/admin/Freelancers';
import Companies from './pages/admin/Companies';
import AdminRequirements from './pages/admin/Requirements';
import Subscriptions from './pages/admin/Subscriptions';
import AdminComingSoon from './pages/admin/ComingSoon';

import ScrollToTop from './components/ScrollToTop';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <ScrollToTop />
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
              <Route path="requirements" element={<Requirements />} />
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
                path="freelancer/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['freelancer']}>
                    <FreelancerDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="company/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['company']}>
                    <CompanyDashboard />
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
              <Route path="*" element={<AdminComingSoon />} />
            </Route>
          </Routes>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
