import React, { useState, useEffect } from 'react';
import styles from './MyProfile.module.css';
import { ArrowLeft } from 'react-iconly';
import DateInput from './components/DateInput';
import CustomDropdown from './components/CustomDropdown';
import { useToast } from './context/ToastContext';

interface MyProfileProps {
  onBack: () => void;
}

const MyProfile: React.FC<MyProfileProps> = ({ onBack }) => {
  const toast = useToast();
  const [profilePicture, setProfilePicture] = useState<string>('');
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    dateOfBirth: '',
    email: '',
    gender: 'Female',
    specialization: 'Counselling Therapist',
    languages: 'English, Hindi, Odia',
    country: 'INDIA',
    state: '',
    city: '',
    pincode: '',
    address: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('http://localhost:3001/auth/me', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            // Handle profile picture URL - prepend backend URL if it's a local path
            let profilePicUrl = data.user.profile_picture || '';
            if (profilePicUrl && !profilePicUrl.startsWith('http')) {
              profilePicUrl = `http://localhost:3001${profilePicUrl}`;
            }
            setProfilePicture(profilePicUrl);
            
            setFormData({
              fullName: data.user.user_name || '',
              phoneNumber: data.user.phone || '',
              dateOfBirth: data.user.dob ? new Date(data.user.dob).toISOString().split('T')[0] : '',
              email: data.user.email || '',
              gender: data.user.gender || 'Female',
              specialization: data.user.specialization || 'Counselling Therapist',
              languages: data.user.language_spoken || 'English, Hindi, Odia',
              country: data.user.country || 'INDIA',
              state: data.user.state || '',
              city: data.user.city || '',
              pincode: data.user.pincode || '',
              address: data.user.clinic_address || ''
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Auto-fill city and state when pincode is entered
    if (field === 'pincode' && value.length === 6) {
      fetchLocationByPincode(value);
    }
  };

  const fetchLocationByPincode = async (pincode: string) => {
    try {
      // Using India Post API
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      
      if (data && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const location = data[0].PostOffice[0];
        setFormData(prev => ({
          ...prev,
          city: location.District || prev.city,
          state: location.State || prev.state
        }));
      } else {
        toast.warning('Could not find location for this pincode');
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      toast.error('Failed to fetch location details');
    }
  };

  const handleSaveChanges = async () => {
    try {
      const payload = {
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        specialization: formData.specialization,
        languages: formData.languages,
        country: formData.country,
        state: formData.state,
        city: formData.city,
        pincode: formData.pincode,
        address: formData.address
      };

      const response = await fetch('http://localhost:3001/auth/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success('Profile changes saved successfully!');
      } else {
        toast.error('Failed to save profile changes.');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Error saving profile changes.');
    }
  };

  const handleImageChange = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Image size must be less than 5MB');
          return;
        }

        try {
          const formData = new FormData();
          formData.append('profilePicture', file);

          const response = await fetch('http://localhost:3001/auth/upload-profile-picture', {
            method: 'POST',
            credentials: 'include',
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            setProfilePicture(`http://localhost:3001${data.profilePicture}`);
            toast.success('Profile picture updated successfully!');
          } else {
            const error = await response.json();
            toast.error(error.error || 'Failed to upload image');
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          toast.error('Error uploading profile picture');
        }
      }
    };
    input.click();
  };

  if (loading) return <div>Loading profile...</div>;

  return (
    <div className={styles.profilePage}>
      <div className={styles.profileHeader}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={onBack}>
            <ArrowLeft size="medium" primaryColor="#000000" />
          </button>
          <div>
            <h1>My Profile</h1>
            <p>Manage your personal information and preferences.</p>
          </div>
        </div>
        <button className={styles.saveBtn} onClick={handleSaveChanges}>Save Changes</button>
      </div>

      <div className={styles.profileContent}>
        <div className={styles.profileImageSection}>
          <div className={styles.profileAvatar}>
            {profilePicture ? (
              <img src={profilePicture} alt="Profile" className={styles.profileImage} />
            ) : (
              <svg width="48" height="48" viewBox="0 0 28 24" fill="none">
                <circle cx="12" cy="7" r="4" stroke="#2D7579" strokeWidth="2" fill="none" />
                <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" stroke="#2D7579" strokeWidth="2" fill="none" />
                <path d="M20 8h4m-2-2v4" stroke="#2D7579" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <button className={styles.changeImageBtn} onClick={handleImageChange}>+ Change profile image</button>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Phone Number<span className={styles.required}>*</span></label>
            <div className={styles.phoneInput}>
              <span className={styles.countryCode}>+91</span>
              <input
                type="text"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                maxLength={10}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Date of Birth<span className={styles.required}>*</span></label>
            <DateInput
              value={formData.dateOfBirth}
              onChange={(val) => handleInputChange('dateOfBirth', val)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled // Email usually shouldn't be changeable easily
            />
          </div>

          <div className={styles.formGroup}>
            <label>Gender</label>
            <CustomDropdown
              options={[
                { value: 'Female', label: 'Female' },
                { value: 'Male', label: 'Male' },
                { value: 'Other', label: 'Other' }
              ]}
              value={formData.gender}
              onChange={(val) => handleInputChange('gender', val)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Specialization</label>
            <CustomDropdown
              options={[
                { value: 'Counselling Therapist', label: 'Counselling Therapist' },
                { value: 'Clinical Psychologist', label: 'Clinical Psychologist' },
                { value: 'Psychiatrist', label: 'Psychiatrist' }
              ]}
              value={formData.specialization}
              onChange={(val) => handleInputChange('specialization', val)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Languages Spoken</label>
            <CustomDropdown
              options={[
                { value: 'English, Hindi, Odia', label: 'English, Hindi, Odia' },
                { value: 'English, Hindi', label: 'English, Hindi' },
                { value: 'English', label: 'English' }
              ]}
              value={formData.languages}
              onChange={(val) => handleInputChange('languages', val)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Country<span className={styles.required}>*</span></label>
            <CustomDropdown
              options={[
                { value: 'INDIA', label: 'INDIA' },
                { value: 'USA', label: 'USA' },
                { value: 'UK', label: 'UK' }
              ]}
              value={formData.country}
              onChange={(val) => handleInputChange('country', val)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>State<span className={styles.required}>*</span></label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Pincode<span className={styles.required}>*</span></label>
            <input
              type="text"
              value={formData.pincode}
              onChange={(e) => handleInputChange('pincode', e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Office or Clinic Address<span className={styles.required}>*</span></label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
