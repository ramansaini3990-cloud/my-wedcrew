import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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

// Admin imports
import ErrorBoundary from './components/ErrorBoundary';
import AdminLayout from './components/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Freelancers from './pages/admin/Freelancers';
import Companies from './pages/admin/Companies';
import AdminRequirements from './pages/admin/Requirements';

function App() {
  return (
    <AuthProvider>
      <Router>
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
            {/* Additional admin routes can be added here later */}
            <Route path="*" element={<div className="p-8 text-center text-xl text-brand-textSec">Page under construction...</div>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
