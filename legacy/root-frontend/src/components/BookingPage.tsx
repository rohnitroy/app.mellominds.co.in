import React from 'react';
import Header from './Header';
import TherapistProfile from './TherapistProfile';
import CalendarSection from './CalendarSection';
import Footer from './Footer';
import './BookingPage.css';

const BookingPage: React.FC = () => {
  return (
    <div className="booking-page">
      <Header />
      <main className="main-content">
        <div className="content-container">
          <TherapistProfile />
          <CalendarSection />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BookingPage;