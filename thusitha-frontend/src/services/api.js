const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // දේශීය ජාලයක (local network) ක්‍රියාත්මක වේදැයි පරීක්ෂා කිරීම
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isPrivateIP = /^10\.\d+\.\d+\.\d+$/.test(hostname) || 
                        /^192\.168\.\d+\.\d+$/.test(hostname) || 
                        /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname);
                        
    if (isLocalhost || isPrivateIP) {
      // වත්මන් IP එකට 5000 (backend) port එක එකතු කර ආපසු ලබාදීම
      return `${protocol}//${hostname}:5000`;
    }
  }

  return envUrl || 'http://localhost:5000';
};

export const API_URL = getApiUrl();
export const BASE_URL = API_URL;

export const request = async (endpoint, { body, isFormData = false, noAuth = false, ...customConfig } = {}) => {
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  // sessionStorage (not localStorage) so each browser tab keeps its own independent login -
  // localStorage is shared across every tab of the same origin, so logging into a different
  // account in one tab would silently switch the session in every other open tab too.
  const token = sessionStorage.getItem('token');
  if (token && !noAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method: body ? 'POST' : 'GET',
    ...customConfig,
    headers: {
      ...headers,
      ...customConfig.headers,
    },
  };

  if (body && !isFormData) {
    config.body = JSON.stringify(body);
  } else if (body && isFormData) {
    config.body = body; // For FormData, browser sets Content-Type
  }

  // Ensure endpoint starts with /api if it's not already there
  const fullUrl = endpoint.startsWith('/api') ? `${API_URL}${endpoint}` : `${API_URL}/api${endpoint}`;

  const response = await fetch(fullUrl, config);

  if (!response.ok) {
    const contentType = response.headers.get('content-type'); // Get Content-Type header
    if (contentType?.includes('application/json')) { // Use optional chaining
      const errorData = await response.json();
      const message = errorData.message || errorData.error || `API Error: ${response.status}`;

      // Distinguish "your session itself is invalid" (missing/expired token - the auth
      // middleware rejects the request before it ever reaches a route) from a normal,
      // valid-session permission error (checkRole rejecting a role from one specific
      // action). Only the former should force a clean re-login - otherwise a Teacher
      // clicking something Admin-only would get silently logged out instead of just
      // seeing "you're not allowed to do that".
      const isAuthFailure = !noAuth && (
        response.status === 401 ||
        (response.status === 403 && (message === 'No token provided.' || message === 'Failed to authenticate token.'))
      );
      if (isAuthFailure) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }

      throw new Error(message);
    } else {
      throw new Error(`API Error: ${response.status} - Server returned non-JSON response.`);
    }
  }

  return await response.json();
};