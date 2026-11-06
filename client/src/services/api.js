import axios from 'axios';

// When deployed to production, VITE_API_URL can point to external backend (e.g. https://bookloop-api.onrender.com/api)
// In local development, defaults to '/api' which is proxied by Vite
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send and receive HTTP-only session cookies
});

export default api;
