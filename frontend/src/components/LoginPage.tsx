import React, { useState } from 'react'
import './LoginPage.css'

import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import API_BASE_URL from '../config/api'

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const errorParam = searchParams.get('error')
  const detailsParam = searchParams.get('details')
  const toast = useToast()

  // Show error if redirected back with one
  React.useEffect(() => {
    if (errorParam) {
      toast.error(`Login Failed: ${errorParam}${detailsParam ? `\nDetails: ${detailsParam}` : ''}`);
    }
  }, [errorParam, detailsParam, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const apiUrl = API_BASE_URL
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important: send cookies
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Login successful!')
        login()
        navigate('/dashboard')
      } else {
        toast.error(data.error || 'Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Network error. Please try again.')
    }
  }

  // Handle Google login - redirect to backend OAuth endpoint
  const handleGoogleLogin = () => {
    const apiUrl = API_BASE_URL
    window.location.href = `${apiUrl}/auth/google`
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail.trim()) return
    setForgotLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      })
      const data = await res.json()
      if (res.ok && data.tempPassword) {
        setTempPassword(data.tempPassword)
      } else if (res.ok) {
        toast.info('If this email is registered, a temporary password has been generated.')
        setShowForgotModal(false)
      } else {
        toast.error(data.error || 'Failed to reset password')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <>
    <div className="login-container">
      <div className="left-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Say <span className="wave">👋</span> hello to <span className="mello">mello</span>!
          </h1>
          <h2 className="hero-subtitle">
            <span className="future">FUTURE OF</span> <span className="therapy">THERAPY PRACTICE MANAGEMENT</span>
          </h2>
        </div>
        <div className="mascot">
          <img src="/MelloFevicon 1.png" alt="Mello Mascot" />
        </div>
      </div>

      <div className="right-section">
        <div className="login-card">
          <h1 className="login-title">
            Login to <img src="/mellominds logo 2 1.png" alt="MelloMinds" className="logo-image" />
          </h1>
          <p className="welcome-text">
            <span className="welcome">Welcome back!</span> <span className="please">Please login to continue</span>
          </p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  type="email"
                  id="email"
                  placeholder="enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div className="forgot-password">
              <button type="button" className="forgot-link" onClick={() => setShowForgotModal(true)}>
                Forgot Your Password?
              </button>
            </div>

            <button type="submit" className="login-button">
              Login
            </button>
          </form>

          <div className="divider">
            <span>Or Login/Signup With</span>
          </div>

          <button type="button" className="google-button" onClick={handleGoogleLogin}>
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Login/Signup with Google
          </button>

          <p className="signup-text">
            Don't have an account? <Link to="/signup">Create an account!</Link>
          </p>
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#9CA3AF', marginTop: '12px' }}>
            <Link to="/privacy-policy" style={{ color: '#9CA3AF', textDecoration: 'underline' }}>Privacy Policy</Link>
            {' · '}
            <Link to="/terms-of-service" style={{ color: '#9CA3AF', textDecoration: 'underline' }}>Terms of Service</Link>
          </p>


        </div>
      </div>
    </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setShowForgotModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f4fffe', border: '1px solid #2D7579', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D7579" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <h3 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '20px', margin: '0 0 8px 0', color: '#082421' }}>Forgot Your Password?</h3>
            <p style={{ fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E', margin: '0 0 20px 0', lineHeight: 1.6 }}>
              Please contact our support team and we'll help you reset your password.
            </p>
            <a href="mailto:mellomindsventure@gmail.com"
              style={{ display: 'inline-block', background: '#082421', color: '#fff', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', marginBottom: '12px' }}>
              mellomindsventure@gmail.com
            </a>
            <br />
            <button onClick={() => setShowForgotModal(false)}
              style={{ background: 'none', border: 'none', fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E', cursor: 'pointer', marginTop: '8px' }}>
              Close
            </button>
          </div>
        </div>
      )}
  </>
  )
}

export default LoginPage
