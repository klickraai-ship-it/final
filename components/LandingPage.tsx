import { useState, useEffect } from 'react';
import { DollarSign, Check, Clock, Mail, Lock, User, Building } from 'lucide-react';
import { api } from '../client/src/lib/api';

interface PaymentConfig {
  providers: ('razorpay' | 'paypal')[];
  pricing: {
    amount: number;
    currency: string;
  };
  demoMode: {
    enabled: boolean;
    durationMinutes: number;
  };
}

export default function LandingPage() {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignup, setShowSignup] = useState(false);
  const [signupMode, setSignupMode] = useState<'demo' | 'paid'>('paid');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    companyName: '',
  });
  const [selectedProvider, setSelectedProvider] = useState<'razorpay' | 'paypal'>('razorpay');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [demoExpired, setDemoExpired] = useState(false);

  useEffect(() => {
    fetchConfig();
    
    // Check if redirected due to demo expiry
    const expired = localStorage.getItem('demoExpired');
    if (expired === 'true') {
      setDemoExpired(true);
      setShowSignup(true);
      setSignupMode('paid');
      localStorage.removeItem('demoExpired');
    }
  }, []);

  const fetchConfig = async () => {
    try {
      const { data } = await api.get('/api/payment/config');
      setConfig(data);
      if (data.providers.length > 0) {
        setSelectedProvider(data.providers[0]);
      }
    } catch (error) {
      console.error('Failed to fetch payment config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProcessing(true);

    try {
      const { data } = await api.post('/api/payment/demo', formData);
      
      // Store auth token (consistent with app's expectation)
      localStorage.setItem('authToken', data.sessionToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Redirect to dashboard
      window.location.href = '/';
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create demo account');
    } finally {
      setProcessing(false);
    }
  };

  const handlePaidSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProcessing(true);

    try {
      // Create payment order
      const { data: order } = await api.post('/api/payment/create-order', {
        provider: selectedProvider,
        email: formData.email,
      });

      if (selectedProvider === 'razorpay') {
        // Load Razorpay checkout
        loadRazorpayCheckout(order);
      } else {
        // Load PayPal checkout
        loadPayPalCheckout(order);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create payment order');
      setProcessing(false);
    }
  };

  const loadRazorpayCheckout = (order: any) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      const options = {
        key: order.clientData.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Newsletter Platform',
        description: 'One-time payment for newsletter platform access',
        handler: async (response: any) => {
          await verifyPayment('razorpay', {
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          }
        },
        prefill: {
          email: formData.email,
          name: formData.name,
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    };
    document.body.appendChild(script);
  };

  const loadPayPalCheckout = (order: any) => {
    // PayPal integration would go here
    // For now, show message
    setError('PayPal integration coming soon. Please use Razorpay.');
    setProcessing(false);
  };

  const verifyPayment = async (provider: string, paymentData: any) => {
    try {
      const { data } = await api.post('/api/payment/verify', {
        provider,
        ...formData,
        ...paymentData,
      });

      // Store auth token (consistent with app's expectation)
      localStorage.setItem('authToken', data.sessionToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to dashboard
      window.location.href = '/';
    } catch (error: any) {
      setError(error.response?.data?.message || 'Payment verification failed');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!showSignup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <div className="container mx-auto px-4 py-16">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl blur-lg opacity-75"></div>
                <div className="relative h-16 w-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <span className="text-white font-black text-3xl">0</span>
                </div>
              </div>
              <div className="text-left">
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Zero AI</h1>
                <span className="text-lg font-medium text-gray-300 tracking-widest">MAIL</span>
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Professional Newsletter Platform
            </h2>
            <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-3xl mx-auto">
              Send beautiful newsletters, track engagement, and grow your audience with our powerful email marketing platform.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-6xl mx-auto">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-white">
              <div className="text-4xl mb-4">📧</div>
              <h3 className="text-xl font-bold mb-3">WYSIWYG Editor</h3>
              <p className="text-gray-200">Create stunning HTML emails with our intuitive drag-and-drop editor powered by TipTap.</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-white">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold mb-3">Advanced Analytics</h3>
              <p className="text-gray-200">Track opens, clicks, and engagement with comprehensive analytics dashboards.</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-white">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-bold mb-3">Subscriber Management</h3>
              <p className="text-gray-200">Manage unlimited subscribers with double opt-in and GDPR compliance built-in.</p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-white">
              <div className="text-4xl mb-4">🗓️</div>
              <h3 className="text-xl font-bold mb-3">Campaign Scheduling</h3>
              <p className="text-gray-200">Schedule campaigns in advance and send at optimal times for maximum engagement.</p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-white">
              <div className="text-4xl mb-4">🌍</div>
              <h3 className="text-xl font-bold mb-3">Web Version Viewing</h3>
              <p className="text-gray-200">Every email includes a web version for better accessibility and tracking.</p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-white">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold mb-3">High Performance</h3>
              <p className="text-gray-200">Handle 10,000+ email lists with fast delivery powered by AWS SES.</p>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-white text-center mb-12">
              Simple, Transparent Pricing
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Demo Card */}
              {config?.demoMode.enabled && (
                <div className="bg-white rounded-2xl p-8 shadow-2xl border-4 border-yellow-400">
                  <div className="flex items-center gap-3 mb-4">
                    <Clock className="text-yellow-500" size={32} />
                    <h3 className="text-2xl font-bold text-gray-900">Try Demo Mode</h3>
                  </div>
                  <div className="mb-6">
                    <div className="text-4xl font-bold text-gray-900 mb-2">FREE</div>
                    <div className="text-gray-600">{config.demoMode.durationMinutes} minutes trial</div>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-2">
                      <Check className="text-green-500 mt-1 flex-shrink-0" size={20} />
                      <span className="text-gray-700">Full platform access</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="text-green-500 mt-1 flex-shrink-0" size={20} />
                      <span className="text-gray-700">All features enabled</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="text-green-500 mt-1 flex-shrink-0" size={20} />
                      <span className="text-gray-700">No credit card required</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="text-green-500 mt-1 flex-shrink-0" size={20} />
                      <span className="text-gray-700">Upgrade anytime</span>
                    </li>
                  </ul>
                  <button
                    onClick={() => {
                      setSignupMode('demo');
                      setShowSignup(true);
                    }}
                    className="w-full py-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-colors text-lg"
                  >
                    Start Demo
                  </button>
                </div>
              )}

              {/* Paid Card */}
              <div className="bg-white rounded-2xl p-8 shadow-2xl border-4 border-indigo-500">
                <div className="flex items-center gap-3 mb-4">
                  <DollarSign className="text-indigo-600" size={32} />
                  <h3 className="text-2xl font-bold text-gray-900">Full Access</h3>
                </div>
                <div className="mb-6">
                  <div className="text-4xl font-bold text-gray-900 mb-2">
                    ${config?.pricing.amount || 65}
                  </div>
                  <div className="text-gray-600">One-time payment • Lifetime access</div>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2">
                    <Check className="text-green-500 mt-1 flex-shrink-0" size={20} />
                    <span className="text-gray-700">Unlimited subscribers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="text-green-500 mt-1 flex-shrink-0" size={20} />
                    <span className="text-gray-700">Unlimited campaigns</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="text-green-500 mt-1 flex-shrink-0" size={20} />
                    <span className="text-gray-700">Advanced analytics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="text-green-500 mt-1 flex-shrink-0" size={20} />
                    <span className="text-gray-700">Priority support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="text-green-500 mt-1 flex-shrink-0" size={20} />
                    <span className="text-gray-700">AWS SES integration</span>
                  </li>
                </ul>
                <button
                  onClick={() => {
                    setSignupMode('paid');
                    setShowSignup(true);
                  }}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors text-lg"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <button
          onClick={() => setShowSignup(false)}
          className="text-gray-600 hover:text-gray-800 mb-4"
        >
          ← Back
        </button>

        {demoExpired && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex items-start">
              <Clock className="text-yellow-400 mr-3 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Demo Period Expired</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Your 10-minute demo has ended. Upgrade now to continue using all features and keep your data.
                </p>
              </div>
            </div>
          </div>
        )}

        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {signupMode === 'demo' ? 'Start Your Demo' : 'Get Full Access'}
        </h2>
        <p className="text-gray-600 mb-6">
          {signupMode === 'demo' 
            ? `${config?.demoMode.durationMinutes} minutes free trial - No credit card required` 
            : `One-time payment of $${config?.pricing.amount}`}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={signupMode === 'demo' ? handleDemoSignup : handlePaidSignup}>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline mr-2" size={16} />
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                disabled={processing}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="inline mr-2" size={16} />
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                disabled={processing}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Lock className="inline mr-2" size={16} />
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                minLength={6}
                disabled={processing}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="inline mr-2" size={16} />
                Company Name (Optional)
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={processing}
              />
            </div>

            {signupMode === 'paid' && config && config.providers.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {config.providers.includes('razorpay') && (
                    <button
                      type="button"
                      onClick={() => setSelectedProvider('razorpay')}
                      className={`py-3 px-4 border-2 rounded-lg font-medium transition-colors ${
                        selectedProvider === 'razorpay'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                      disabled={processing}
                    >
                      Razorpay
                    </button>
                  )}
                  {config.providers.includes('paypal') && (
                    <button
                      type="button"
                      onClick={() => setSelectedProvider('paypal')}
                      className={`py-3 px-4 border-2 rounded-lg font-medium transition-colors ${
                        selectedProvider === 'paypal'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                      disabled={processing}
                    >
                      PayPal
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={processing}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-colors ${
              signupMode === 'demo'
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {processing ? 'Processing...' : (signupMode === 'demo' ? 'Start Demo Now' : 'Proceed to Payment')}
          </button>

          <p className="text-center text-sm text-gray-600 mt-4">
            Already have an account?{' '}
            <a href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Sign In
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
