'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { userApi } from '@/lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
    }
    fetchApiKeys();
  }, [user]);

  const fetchApiKeys = async () => {
    try {
      const response = await userApi.getApiKeys();
      setApiKeys(response.data.apiKeys);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const data: any = {};
      if (name) data.name = name;
      if (password) data.password = password;

      await userApi.update(data);
      setMessage('Profile updated successfully');
      setPassword('');
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    try {
      await userApi.createApiKey();
      await fetchApiKeys();
      setMessage('API key created successfully');
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to create API key');
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      await userApi.deleteApiKey(id);
      await fetchApiKeys();
      setMessage('API key deleted successfully');
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to delete API key');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>

      {/* Header */}
      <nav className="glass-dark border-b border-white/10 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </button>
              <h1 className="text-xl font-bold text-gradient">Profile Settings</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 relative z-10">
        {message && (
          <div className={`mb-6 glass-dark rounded-xl p-4 text-sm animate-slide-down ${\n            message.includes('success') ? 'text-green-400 border border-green-500/50' : 'text-blue-400 border border-blue-500/50'\n          }`}>
            {message}
          </div>
        )}

        {/* Account Information */}
        <div className="card-glass mb-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
            <div className="w-12 h-12 rounded-xl glass-strong flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z\" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white\">Account Information</h3>
              <p className=\"text-sm text-gray-400\">Manage your account details</p>
            </div>
          </div>
          
          <form onSubmit={handleUpdateProfile} className=\"space-y-5\">
            <div>
              <label className=\"block text-sm font-medium text-gray-300 mb-2\">
                Email Address
              </label>
              <div className=\"relative\">
                <div className=\"absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none\">
                  <svg className=\"w-5 h-5 text-gray-400\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
                    <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z\" />
                  </svg>
                </div>
                <input
                  type=\"email\"
                  value={user?.email || ''}
                  disabled
                  className=\"input-glass pl-10 opacity-60 cursor-not-allowed\"
                />
              </div>
            </div>
            
            <div>
              <label className=\"block text-sm font-medium text-gray-300 mb-2\">
                Display Name
              </label>
              <div className=\"relative group\">
                <div className=\"absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none\">
                  <svg className=\"w-5 h-5 text-gray-400 group-focus-within:text-blue-400 transition-colors\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
                    <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z\" />
                  </svg>
                </div>
                <input
                  type=\"text\"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className=\"input-glass pl-10\"
                  placeholder=\"Your name\"
                />
              </div>
            </div>
            
            <div>
              <label className=\"block text-sm font-medium text-gray-300 mb-2\">
                New Password
              </label>
              <div className=\"relative group\">
                <div className=\"absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none\">
                  <svg className=\"w-5 h-5 text-gray-400 group-focus-within:text-blue-400 transition-colors\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
                    <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z\" />
                  </svg>
                </div>
                <input
                  type=\"password\"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className=\"input-glass pl-10\"
                  placeholder=\"Leave blank to keep current password\"
                />
              </div>
            </div>
            
            <div className=\"flex justify-end pt-4\">
              <button
                type=\"submit\"
                disabled={loading}
                className=\"btn-primary disabled:opacity-50 disabled:cursor-not-allowed\"
              >
                {loading ? (
                  <span className=\"flex items-center gap-2\">
                    <svg className=\"animate-spin h-5 w-5\" viewBox=\"0 0 24 24\">
                      <circle className=\"opacity-25\" cx=\"12\" cy=\"12\" r=\"10\" stroke=\"currentColor\" strokeWidth=\"4\" fill=\"none\"></circle>
                      <path className=\"opacity-75\" fill=\"currentColor\" d=\"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z\"></path>
                    </svg>
                    Updating...
                  </span>
                ) : (
                  'Update Profile'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* API Keys */}
        <div className=\"card-glass animate-fade-in\" style={{ animationDelay: '0.1s' }}>
          <div className=\"flex items-center justify-between mb-6 pb-6 border-b border-white/10\">
            <div className=\"flex items-center gap-3\">
              <div className=\"w-12 h-12 rounded-xl glass-strong flex items-center justify-center\">
                <svg className=\"w-6 h-6 text-purple-400\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
                  <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z\" />
                </svg>
              </div>
              <div>
                <h3 className=\"text-xl font-semibold text-white\">API Keys</h3>
                <p className=\"text-sm text-gray-400\">Manage your API access keys</p>
              </div>
            </div>
            <button
              onClick={handleCreateApiKey}
              className=\"btn-primary\"
            >
              <svg className=\"w-5 h-5 mr-2\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
                <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M12 4v16m8-8H4\" />
              </svg>
              Create Key
            </button>
          </div>
          
          <div className=\"space-y-3\">
            {apiKeys.length === 0 ? (
              <div className=\"text-center py-8 text-gray-400 text-sm\">
                <svg className=\"w-12 h-12 mx-auto mb-3 opacity-50\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
                  <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z\" />
                </svg>
                No API keys yet. Create one to get started.
              </div>
            ) : (
              apiKeys.map((apiKey) => (
                <div key={apiKey.id} className=\"glass hover:glass-strong transition-all duration-300 rounded-xl p-4 group\">
                  <div className=\"flex items-center justify-between\">
                    <div className=\"flex-1 min-w-0\">
                      <div className=\"flex items-center gap-3 mb-2\">
                        <div className=\"w-8 h-8 rounded-lg glass-strong flex items-center justify-center flex-shrink-0\">
                          <svg className=\"w-4 h-4 text-purple-400\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
                            <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z\" />
                          </svg>
                        </div>
                        <code className=\"text-sm glass-dark px-3 py-1.5 rounded-lg text-blue-400 font-mono break-all\">
                          {apiKey.key}
                        </code>
                      </div>
                      <p className=\"text-xs text-gray-500 ml-11\">
                        Created {new Date(apiKey.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteApiKey(apiKey.id)}
                      className=\"ml-4 text-red-400 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100\"
                    >
                      <svg className=\"w-5 h-5\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
                        <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16\" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
        {message && (
          <div className="mb-4 bg-blue-50 border border-blue-400 text-blue-700 px-4 py-3 rounded">
            {message}
          </div>
        )}

        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Account Information
            </h3>
          </div>
          <form onSubmit={handleUpdateProfile} className="px-4 py-5 sm:p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 text-gray-900 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-gray-900"
                  placeholder="Leave blank to keep current password"
                />
              </div>
            </div>
            <div className="mt-6">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              API Keys
            </h3>
            <button
              onClick={handleCreateApiKey}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
            >
              Create API Key
            </button>
          </div>
          <ul className="divide-y divide-gray-200">
            {apiKeys.length === 0 ? (
              <li className="px-4 py-4 text-sm text-gray-500">
                No API keys yet
              </li>
            ) : (
              apiKeys.map((apiKey) => (
                <li key={apiKey.id} className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-900">
                        {apiKey.key}
                      </code>
                      <p className="text-xs text-gray-500 mt-1">
                        Created {new Date(apiKey.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteApiKey(apiKey.id)}
                      className="ml-4 text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
