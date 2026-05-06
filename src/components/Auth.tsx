import React, { useState } from 'react';
import { Mail, Lock, User, MessageSquare, Loader2, ArrowRight, Phone } from 'lucide-react';
import { signInWithGoogle, loginWithEmail, signUpWithEmail } from '../lib/firebase';

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        try {
          await loginWithEmail(email, password);
        } catch (err: any) {
          // If user doesn't exist, maybe try to sign them up? 
          // No, better to show the error but make it readable.
          if (err.code === 'auth/user-not-found') {
            setError('Account not found. Please sign up instead.');
          } else if (err.code === 'auth/wrong-password') {
            setError('Incorrect password. Please try again.');
          } else if (err.code === 'auth/invalid-credential') {
            setError('Invalid credentials. Check your email and password.');
          } else if (err.code === 'auth/operation-not-allowed') {
            setError('Email login is not enabled in Firebase. Please enable "Email/Password" in your Firebase console under Authentication > Sign-in method.');
          } else {
            setError(err.message || 'Login failed');
          }
        }
      } else {
        if (!name.trim()) throw new Error('Name is required');
        if (!phone.trim()) throw new Error('Phone number is required');
        await signUpWithEmail(email, password, name);
        localStorage.setItem('pending_phone', phone);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password registration is not enabled in Firebase. Please enable it in the Firebase console.');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111B21] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#202C33] rounded-2xl shadow-2xl overflow-hidden border border-[#233138]">
        <div className="bg-[#00A884] p-8 text-center text-white">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-90" />
          <h1 className="text-3xl font-light tracking-tight">ChatConnect</h1>
          <p className="mt-2 text-green-100 opacity-80">Message privately with E2E experience</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#2a3942] text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A884] transition-all border border-transparent focus:border-transparent"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#2a3942] text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A884] transition-all border border-transparent focus:border-transparent"
                  />
                </div>
              </>
            )}
            
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <input
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#2a3942] text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A884] transition-all border border-transparent focus:border-transparent"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#2a3942] text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A884] transition-all border border-transparent focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm mt-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00A884] hover:bg-[#008f6f] text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#374248]"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#202C33] px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            onClick={() => signInWithGoogle()}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-3"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>

          <p className="mt-8 text-center text-gray-400 text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#00A884] font-medium hover:underline focus:outline-none"
            >
              {isLogin ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
      
      <p className="mt-6 text-[#667781] text-xs text-center flex items-center gap-1.5 opacity-60">
        <Lock className="w-3 h-3" /> End-to-end encrypted messaging
      </p>
    </div>
  );
}
