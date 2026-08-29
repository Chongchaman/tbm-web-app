/**
 * TBM Ring Planner API Service
 * Bridges the standalone React app with the Google Apps Script backend.
 */

// REPLACE THIS with your deployed Web App URL from Google Apps Script
// (Deploy > New Deployment > Web App > Execute as me > Anyone has access)
const GAS_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

export const callApi = async (action, params = {}) => {
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors', // Important for GAS to allow the redirect, BUT it prevents reading the body
      // Actually, GAS needs a redirect. Standalone apps usually use 'no-cors' if they don't need the return
      // BUT we NEED the return. The standard way for GAS is to use a proxy or just handle the redirect.
      // In modern browsers, simple POST to GAS works if configured correctly.
      redirect: 'follow', 
      body: JSON.stringify({ action, params }),
    });

    // NOTE: Due to CORS and GAS redirect, a simple fetch to GAS can be tricky.
    // If you see CORS errors, ensure your GAS is deployed as "Anyone" (even anonymous).
    // Or use a library like 'gas-client' or a simple wrapper.
    
    // For now, we'll assume a standard JSON response pattern.
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API Error [${action}]:`, error);
    return { ok: false, msg: error.message };
  }
};

// Alternative approach for GAS: Using a Hidden Form or JSONP (old) 
// but modern Fetch with 'follow' redirect usually works if GAS returns ContentService.MimeType.JSON

export const api = {
  login: (username, password) => callApi('login', { username, password }),
  getRingLog: () => callApi('getRingLog'),
  saveRing: (data) => callApi('saveRing', data),
  calculatePlan: (params) => callApi('calculatePlan', params),
  getDashboardData: () => callApi('getDashboardData'),
  getPatterns: () => callApi('getPatterns'),
  // Add other methods as needed
};
