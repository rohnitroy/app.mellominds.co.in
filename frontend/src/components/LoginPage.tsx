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
        navigate('/')
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

  return (
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
              <a href="#forgot">Forgot Your Password?</a>
            </div>

            <button type="submit" className="login-button">
              Login
            </button>
          </form>

          <div className="divider">
            <span>Or Login With</span>
          </div>

          <button type="button" className="google-button" onClick={handleGoogleLogin}>
            Login with Google Account
          </button>

          <p className="signup-text">
            Don't have an account? <Link to="/signup">Create an account!</Link>
          </p>


        </div>
      </div>
    </div>
  )
}

export default LoginPage
