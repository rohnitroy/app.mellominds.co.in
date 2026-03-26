import React from 'react';
import './CalendarSection.css';

const CalendarSection: React.FC = () => {
  const therapySessions = [
    {
      id: 1,
      title: "Adolescent Therapy Session with Ishika Mahajan",
      price: 1700,
      duration: "50 m",
      type: "one on one",
      description: "Adolescent Therapy (13+): Support for teens dealing with academic pressure, emotional challenges, and behavioral concerns...."
    },
    {
      id: 2,
      title: "Couples Therapy Session With Ishika Mahajan",
      price: 2500,
      duration: "75 m",
      type: "group",
      description: "Couples Therapy: Guided support to help partners improve communication, resolve conflicts, and strengthen their relationship...."
    },
    {
      id: 3,
      title: "Individual Therapy Session with Ishika Mahajan",
      price: 1700,
      duration: "50 m",
      type: "one on one",
      description: "Individual Therapy (18+): One-on-one sessions focused on personal growth and emotional wellbeing...."
    }
  ];

  return (
    <div className="calendar-section">
      <h2 className="calendar-title">Select the therapy calendar</h2>
      <div className="therapy-sessions-container">
        {therapySessions.map((session) => (
          <div key={session.id} className="therapy-session-card">
            <div className="session-header">
              <h3 className="session-title">{session.title}</h3>
              <span className="session-price">₹ {session.price}</span>
            </div>
            <div className="session-details">
              <div className="session-meta">
                <span className="session-duration">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="#6c757d" strokeWidth="1"/>
                    <path d="M8 4v4l3 2" stroke="#6c757d" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  {session.duration}
                </span>
                <span className="session-type">{session.type}</span>
              </div>
              <p className="session-description">{session.description}</p>
            </div>
            <button className="book-now-btn">Book Now</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarSection;