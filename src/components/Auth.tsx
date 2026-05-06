import React, { useState } from 'react';
import { Mail, Lock, User, MessageSquare, Loader2, ArrowRight, Phone, Chrome } from 'lucide-react';
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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Sign-In failed');
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
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                <p className="text-red-400 text-sm">{error}</p>
                {error.includes('Email login is not enabled') && (
                  <button 
                    onClick={handleGoogleSignIn}
                    className="mt-2 text-xs font-bold text-white bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-full transition-colors"
                  >
                    Use Google Sign-In instead
                  </button>
                )}
              </div>
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

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#374248]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#202C33] text-gray-400">Or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[#374248] rounded-lg text-white bg-transparent hover:bg-[#2a3942] transition-colors disabled:opacity-50"
            >
              <Chrome className="w-5 h-5 text-blue-400" />
              <span className="font-medium">Continue with Google</span>
            </button>
          </form>

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
