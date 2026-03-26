import React from 'react';
import './TherapistProfile.css';

const TherapistProfile: React.FC = () => {
  return (
    <div className="therapist-profile">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            <div className="avatar-circle"></div>
          </div>
          <div className="profile-info">
            <h2 className="therapist-name">Aastha Saraf</h2>
            <p className="qualification"><strong>Qualification:</strong> M.Sc. Psychology, Ph.D. Clinical Psychology</p>
            <p className="experience"><strong>Experience:</strong> 3+ years | <strong>Languages:</strong> English, Hindi & Odia</p>
          </div>
        </div>
      </div>

      <div className="about-section">
        <h3 className="section-title">About therapist:</h3>
        <p className="about-text">
          Areas of Expertise: Personal Growth, Communication, Marital Problems, 
          Intimacy, Life Stressors, Time Management, Education, Career, Abuse, 
          Trauma, Unhealthy Parenting Styles, Low Confidence, Poor Self-Esteem, 
          Interpersonal Conflicts, Negative Thoughts, Suicidal Behaviour, Couples 
          Counselling, OCD, Sexual Wellness, LGBTQIA+ Wellness, Mood Disorders, 
          ADHD, Anger, Stress, Sleep, Relationships, Depression, Anxiety.
        </p>
      </div>

      <div className="contact-section">
        <h3 className="section-title">Contact Details:</h3>
        <div className="contact-info">
          <p className="contact-item">
            <strong>Address:</strong> OptM Media Solutions Private Ltd, Church Road, Kanakapura, 
            Basavanagudi, Bengaluru, Karnataka, India
          </p>
          <p className="contact-item">
            <strong>Phone No.:</strong> +91 2283276132 | <strong>Email Address:</strong> aastha@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default TherapistProfile;