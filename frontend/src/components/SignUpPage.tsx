import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LoginPage.css'
import { API_URL } from '../config/api'
import CustomDropdown from './CustomDropdown'
import { useToast } from '../context/ToastContext'

const SignUpPage: React.FC = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const [phoneNumber, setPhoneNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [languages, setLanguages] = useState('')

  const [country, setCountry] = useState('')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')
  const [address, setAddress] = useState('')

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }
    
    setStep(2)
  }

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!phoneNumber || !dateOfBirth) {
      setError('Phone number and date of birth are required')
      return
    }
    
    setStep(3)
  }

  const handleSelectPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          email,
          password,
          phoneNumber,
          dateOfBirth,
          gender,
          specialization,
          languages,
          country,
          state,
          city,
          pincode,
          address
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      // Registration successful, redirect to login
      toast.success('Registration successful! Please login.')
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
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
          {step === 1 ? (
            <>
              <h1 className="login-title">
                Sign Up <img src="/mellominds logo 2 1.png" alt="MelloMinds" className="logo-image" />
              </h1>
              <p className="welcome-text">
                <strong>Create your account to get started</strong>
              </p>

              {error && (
                <div style={{ 
                  padding: '10px', 
                  marginBottom: '15px', 
                  backgroundColor: '#fee', 
                  border: '1px solid #fcc', 
                  borderRadius: '4px',
                  color: '#c33'
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSignUp}>
                <div className="form-group">
                  <label htmlFor="fullName">Full Name</label>
                  <div className="input-wrapper">
                    <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <input
                      type="text"
                      id="fullName"
                      placeholder="enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
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
                      autoComplete="off"
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
                      placeholder="enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
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

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <div className="input-wrapper">
                    <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      placeholder="re-enter password to confirm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {showConfirmPassword ? (
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

                <button type="submit" className="login-button">
                  Create Account
                </button>
              </form>

              <p className="signup-text">
                Already have an account? <a href="/">Login Now!</a>
              </p>
            </>
          ) : step === 2 ? (
            <>
              <h1 className="login-title">
                Let's setup <img src="/mellominds logo 2 1.png" alt="MelloMinds" className="logo-image" />
              </h1>
              <p className="welcome-text">
                <strong>Personal & Professional Information</strong>
              </p>

              {error && (
                <div style={{ 
                  padding: '10px', 
                  marginBottom: '15px', 
                  backgroundColor: '#fee', 
                  border: '1px solid #fcc', 
                  borderRadius: '4px',
                  color: '#c33'
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleNext}>
                <div className="form-group">
                  <label htmlFor="phoneNumber">Phone Number<span style={{color: 'red'}}>*</span></label>
                  <div className="phone-input-wrapper">
                    <input
                      type="text"
                      className="country-code"
                      value="+91"
                      readOnly
                    />
                    <input
                      type="tel"
                      id="phoneNumber"
                      className="phone-input"
                      placeholder="enter phone no."
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="dateOfBirth">Date of Birth<span style={{color: 'red'}}>*</span></label>
                    <input
                      type="date"
                      id="dateOfBirth"
                      className="date-input"
                      placeholder="DD/MM/YYYY - pick a date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="gender">Gender</label>
                    <CustomDropdown
                      options={[
                        { value: '', label: 'Select gender' },
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                        { value: 'other', label: 'Other' }
                      ]}
                      value={gender}
                      onChange={(value) => setGender(value)}
                      placeholder="Select gender"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="specialization">Specialization</label>
                  <CustomDropdown
                    options={[
                      { value: '', label: 'Select specialization' },
                      { value: 'clinical', label: 'Clinical Psychology' },
                      { value: 'counseling', label: 'Counseling' },
                      { value: 'therapy', label: 'Therapy' }
                    ]}
                    value={specialization}
                    onChange={(value) => setSpecialization(value)}
                    placeholder="Select specialization"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="languages">Languages Spoken</label>
                  <CustomDropdown
                    options={[
                      { value: '', label: 'Select languages' },
                      { value: 'English', label: 'English' },
                      { value: 'Hindi', label: 'Hindi' },
                      { value: 'Bengali', label: 'Bengali' },
                      { value: 'Telugu', label: 'Telugu' },
                      { value: 'Marathi', label: 'Marathi' },
                      { value: 'Tamil', label: 'Tamil' },
                      { value: 'Gujarati', label: 'Gujarati' },
                      { value: 'Kannada', label: 'Kannada' },
                      { value: 'Malayalam', label: 'Malayalam' },
                      { value: 'Punjabi', label: 'Punjabi' },
                      { value: 'Odia', label: 'Odia' },
                      { value: 'Urdu', label: 'Urdu' },
                      { value: 'Spanish', label: 'Spanish' },
                      { value: 'French', label: 'French' },
                      { value: 'German', label: 'German' },
                      { value: 'Chinese', label: 'Chinese' },
                      { value: 'Arabic', label: 'Arabic' }
                    ]}
                    value={languages}
                    onChange={(value) => setLanguages(value)}
                    placeholder="Select languages"
                  />
                </div>

                <button type="submit" className="login-button">
                  Next →
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="login-title">
                Let's setup <img src="/mellominds logo 2 1.png" alt="MelloMinds" className="logo-image" />
              </h1>
              <p className="welcome-text">
                <strong>Location & Address Information</strong>
              </p>

              {error && (
                <div style={{ 
                  padding: '10px', 
                  marginBottom: '15px', 
                  backgroundColor: '#fee', 
                  border: '1px solid #fcc', 
                  borderRadius: '4px',
                  color: '#c33'
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSelectPlan}>
                <div className="form-group">
                  <label htmlFor="country">Country<span style={{color: 'red'}}>*</span></label>
                  <CustomDropdown
                    options={[
                      { value: '', label: 'Select country' },
                      { value: 'India', label: 'India' },
                      { value: 'USA', label: 'USA' },
                      { value: 'UK', label: 'UK' },
                      { value: 'Canada', label: 'Canada' },
                      { value: 'Australia', label: 'Australia' },
                      { value: 'Germany', label: 'Germany' },
                      { value: 'France', label: 'France' },
                      { value: 'Singapore', label: 'Singapore' },
                      { value: 'UAE', label: 'UAE' },
                      { value: 'Saudi Arabia', label: 'Saudi Arabia' },
                      { value: 'Japan', label: 'Japan' },
                      { value: 'China', label: 'China' },
                      { value: 'South Korea', label: 'South Korea' },
                      { value: 'Malaysia', label: 'Malaysia' },
                      { value: 'Thailand', label: 'Thailand' }
                    ]}
                    value={country}
                    onChange={(value) => setCountry(value)}
                    placeholder="Select country"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="state">State<span style={{color: 'red'}}>*</span></label>
                  <CustomDropdown
                    options={[
                      { value: '', label: 'Select state' },
                      { value: 'Andhra Pradesh', label: 'Andhra Pradesh' },
                      { value: 'Arunachal Pradesh', label: 'Arunachal Pradesh' },
                      { value: 'Assam', label: 'Assam' },
                      { value: 'Bihar', label: 'Bihar' },
                      { value: 'Chhattisgarh', label: 'Chhattisgarh' },
                      { value: 'Goa', label: 'Goa' },
                      { value: 'Gujarat', label: 'Gujarat' },
                      { value: 'Haryana', label: 'Haryana' },
                      { value: 'Himachal Pradesh', label: 'Himachal Pradesh' },
                      { value: 'Jharkhand', label: 'Jharkhand' },
                      { value: 'Karnataka', label: 'Karnataka' },
                      { value: 'Kerala', label: 'Kerala' },
                      { value: 'Madhya Pradesh', label: 'Madhya Pradesh' },
                      { value: 'Maharashtra', label: 'Maharashtra' },
                      { value: 'Manipur', label: 'Manipur' },
                      { value: 'Meghalaya', label: 'Meghalaya' },
                      { value: 'Mizoram', label: 'Mizoram' },
                      { value: 'Nagaland', label: 'Nagaland' },
                      { value: 'Odisha', label: 'Odisha' },
                      { value: 'Punjab', label: 'Punjab' },
                      { value: 'Rajasthan', label: 'Rajasthan' },
                      { value: 'Sikkim', label: 'Sikkim' },
                      { value: 'Tamil Nadu', label: 'Tamil Nadu' },
                      { value: 'Telangana', label: 'Telangana' },
                      { value: 'Tripura', label: 'Tripura' },
                      { value: 'Uttar Pradesh', label: 'Uttar Pradesh' },
                      { value: 'Uttarakhand', label: 'Uttarakhand' },
                      { value: 'West Bengal', label: 'West Bengal' },
                      { value: 'Delhi', label: 'Delhi' },
                      { value: 'Chandigarh', label: 'Chandigarh' },
                      { value: 'Puducherry', label: 'Puducherry' }
                    ]}
                    value={state}
                    onChange={(value) => setState(value)}
                    placeholder="Select state"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="city">City</label>
                    <input
                      type="text"
                      id="city"
                      className="date-input"
                      placeholder="enter city name"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="pincode">Pincode<span style={{color: 'red'}}>*</span></label>
                    <input
                      type="text"
                      id="pincode"
                      className="date-input"
                      placeholder="enter pincode"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="address">Office or Clinic Address<span style={{color: 'red'}}>*</span></label>
                  <input
                    type="text"
                    id="address"
                    className="date-input"
                    placeholder="enter office no./building name/street name/etc..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <button type="submit" className="login-button" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Select a plan →'}
                </button>
              </form>
            </>
          )}


        </div>
      </div>
    </div>
  )
}

export default SignUpPage
