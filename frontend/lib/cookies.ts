// Cookie utility functions for secure token storage

const TOKEN_KEY = 'vantflow_auth_token';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export const cookieUtils = {
  /**
   * Set authentication token in cookie
   */
  setToken: (token: string) => {
    if (typeof window !== 'undefined') {
      // Set as httpOnly-like cookie (client-side fallback)
      const expires = new Date(Date.now() + MAX_AGE).toUTCString();
      document.cookie = `${TOKEN_KEY}=${token}; expires=${expires}; path=/; SameSite=Strict; Secure`;
      
      // Also store in localStorage as fallback
      localStorage.setItem(TOKEN_KEY, token);
    }
  },

  /**
   * Get authentication token from cookie
   */
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;

    // Try to get from cookie first
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === TOKEN_KEY) {
        return value;
      }
    }

    // Fallback to localStorage
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Remove authentication token
   */
  removeToken: () => {
    if (typeof window !== 'undefined') {
      // Remove cookie
      document.cookie = `${TOKEN_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      
      // Remove from localStorage
      localStorage.removeItem(TOKEN_KEY);
    }
  },
};
