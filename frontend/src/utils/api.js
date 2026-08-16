import axios from 'axios';

// Determine the base URL dynamically based on the current hostname
// This ensures that if the app is accessed via a local IP (e.g., 192.168.x.x), 
// it will automatically point to the backend on that same IP.
const hostname = window.location.hostname;
const defaultBaseUrl = `http://${hostname}:5000`;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token header to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle generic errors like network failures and 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Network Error, CORS error, or server is down
      console.error('Network/CORS Error: Please ensure the backend is running and accessible.');
    } else if (error.response.status === 401) {
      // Unauthorized: clear token and redirect to login if appropriate
      localStorage.removeItem('token');
      // window.location.href = '/login'; // Optional: trigger a hard redirect on 401
    }
    return Promise.reject(error);
  }
);

export default api;
