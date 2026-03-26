import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LoginPage from './components/LoginPage'
import SignUpPage from '../frontend/src/components/SignUpPage'
import BookingPage from './components/BookingPage'

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/booking" element={<BookingPage />} />
      </Routes>
    </Router>
  )
}

export default App
