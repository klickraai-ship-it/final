interface ApiOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

// Enable debug logging only in development when explicitly enabled
const DEBUG = import.meta.env.DEV && import.meta.env.VITE_API_DEBUG === 'true';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('token'); // Fixed: was 'authToken', now matches App.tsx
  }

  private async handleResponse(response: Response) {
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/';
      throw new Error('Unauthorized - redirecting to login');
    }

    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({ message: 'Forbidden' }));

      // Handle demo expiry
      if (errorData.code === 'DEMO_EXPIRED') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.setItem('demoExpired', 'true');
        window.location.href = '/';
        throw new Error('Demo period expired - please upgrade to continue');
      }

      throw new Error(errorData.message || 'Forbidden');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
    const apiBaseUrl = (import.meta.env && (import.meta as any).env.VITE_API_URL) || window.location.origin;
    const url = new URL(endpoint, apiBaseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    return url.toString();
  }

  async request(endpoint: string, options: ApiOptions = {}): Promise<any> {
    const { params, headers, ...fetchOptions } = options;
    const token = this.getToken();

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const url = this.buildUrl(endpoint, params);

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...defaultHeaders,
        ...headers,
      },
    });

    return this.handleResponse(response);
  }

  async get(endpoint: string, params?: Record<string, string | number | boolean>): Promise<any> {
    if (DEBUG) console.log('API GET:', endpoint);
    const response = await fetch(this.buildUrl(endpoint, params), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(this.getToken() && { 'Authorization': `Bearer ${this.getToken()}` }),
      },
    });
    if (DEBUG) console.log('API Response:', response.status, response.statusText);
    if (!response.ok) {
      const errorText = await response.text();
      if (DEBUG) console.error('API Error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    if (DEBUG) console.log('API Data:', data);
    return data;
  }

  async post(endpoint: string, data?: any): Promise<any> {
    const url = this.buildUrl(endpoint);
    if (DEBUG) console.log('API POST:', url, data);
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...(this.getToken() && { 'Authorization': `Bearer ${this.getToken()}` }),
      },
    });
    if (DEBUG) console.log('API Response:', response.status, response.statusText);
    if (!response.ok) {
      const errorText = await response.text();
      if (DEBUG) console.error('API Error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    const responseData = await response.json();
    if (DEBUG) console.log('API Data:', responseData);
    return responseData;
  }

  async put(endpoint: string, data?: any): Promise<any> {
    const url = this.buildUrl(endpoint);
    if (DEBUG) console.log('API PUT:', url, data);
    const response = await fetch(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...(this.getToken() && { 'Authorization': `Bearer ${this.getToken()}` }),
      },
    });
    if (DEBUG) console.log('API Response:', response.status, response.statusText);
    if (!response.ok) {
      const errorText = await response.text();
      if (DEBUG) console.error('API Error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    const responseData = await response.json();
    if (DEBUG) console.log('API Data:', responseData);
    return responseData;
  }

  async delete(endpoint: string): Promise<any> {
    const url = this.buildUrl(endpoint);
    if (DEBUG) console.log('API DELETE:', url);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(this.getToken() && { 'Authorization': `Bearer ${this.getToken()}` }),
      },
    });
    if (DEBUG) console.log('API Response:', response.status, response.statusText);
    if (!response.ok) {
      const errorText = await response.text();
      if (DEBUG) console.error('API Error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    const responseData = await response.json();
    if (DEBUG) console.log('API Data:', responseData);
    return responseData;
  }

  async patch(endpoint: string, data?: any): Promise<any> {
    const url = this.buildUrl(endpoint);
    if (DEBUG) console.log('API PATCH:', url, data);
    const response = await fetch(url, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...(this.getToken() && { 'Authorization': `Bearer ${this.getToken()}` }),
      },
    });
    if (DEBUG) console.log('API Response:', response.status, response.statusText);
    if (!response.ok) {
      const errorText = await response.text();
      if (DEBUG) console.error('API Error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    const responseData = await response.json();
    if (DEBUG) console.log('API Data:', responseData);
    return responseData;
  }
}

export const api = new ApiClient();