import React, { useState } from 'react';
import { Warehouse, Lock, Mail, LogIn, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    
    setIsLoading(true);
    setErrorMsg('');
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      setErrorMsg(error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-hero">
        <div className="hero-content">
          <Warehouse size={80} className="hero-icon" />
          <h1>WIMS v3</h1>
          <p>Warehouse Inventory Monitoring System</p>
          <div className="hero-decoration">
            <div className="circle circle-1"></div>
            <div className="circle circle-2"></div>
            <div className="circle circle-3"></div>
          </div>
        </div>
      </div>
      <div className="login-form-container">
        <div className="login-form-wrapper">
          <div className="login-header">
            <h2>Welcome Back</h2>
            <p>Please enter your credentials to sign in.</p>
          </div>
          
          <form className="login-form" onSubmit={handleSubmit}>
            {errorMsg && (
              <div style={{ backgroundColor: 'var(--red-light)', color: 'var(--red)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>
                {errorMsg}
              </div>
            )}
          
            <div className="form-group">
              <label>Email</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="Enter your email"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-login" disabled={isLoading} style={{ opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
          
          <div className="login-footer">
            <p>Protected by WIMS Internal Security</p>
          </div>
        </div>
      </div>
    </div>
  );
}
