import React, { useState, useEffect, useCallback } from 'react';
import styles from './MyProfile.module.css';
import DateInput from './components/DateInput';
import CustomDropdown from './components/CustomDropdown';
import LanguageMultiSelect from './components/LanguageMultiSelect';
import CountrySelect from './components/CountrySelect';
import StateSelect from './components/StateSelect';
import { useToast } from './context/ToastContext';
import { useAuth } from './context/AuthContext';
import API_BASE_URL from './config/api';
import Loader from './components/Loader';
import { useSocket } from './context/SocketContext';

interface MyProfileProps {
  onBack: () => void;
}

interface OrgData {
  company_name: string;
  company_email: string;
  gst: string;
  street: string;
  city: string;
  pincode: string;
  state: string;
  country: string;
}

const MyProfile: React.FC<MyProfileProps> = ({ onBack }) => {
  const toast = useToast();
  const { socket } = useSocket();
  const { checkAuth } = useAuth();
  const [profilePicture, setProfilePicture] = useState<string>('');
  const [isEnterpriseOwner, setIsEnterpriseOwner] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    dateOfBirth: '',
    email: '',
    gender: '',
    specialization: '',
    languages: '',
    country: 'India',
    state: '',
    city: '',
    pincode: '',
    address: ''
  });
  const [orgData, setOrgData] = useState<OrgData>({
    company_name: '',
    company_email: '',
    gst: '',
    street: '',
    city: '',
    pincode: '',
    state: '',
    country: 'India',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            // Handle profile picture URL - prepend backend URL if it's a local path
            let profilePicUrl = data.user.profile_picture || '';
            if (profilePicUrl && !profilePicUrl.startsWith('http')) {
              profilePicUrl = `${API_BASE_URL}${profilePicUrl}`;
            }
            setProfilePicture(profilePicUrl);

            const enterpriseOwner = data.user.plan_name === 'team' && data.user.org_role !== 'member';
            setIsEnterpriseOwner(enterpriseOwner);
            
            setFormData({
              fullName: data.user.user_name || '',
              phoneNumber: data.user.phone || '',
              dateOfBirth: data.user.date_of_birth ? new Date(data.user.date_of_birth).toISOString().split('T')[0] : '',
              email: data.user.email || '',
              gender: data.user.gender || '',
              specialization: data.user.specialization || '',
              languages: data.user.language_spoken ? (Array.isArray(data.user.language_spoken) ? data.user.language_spoken.join(', ') : data.user.language_spoken) : '',
              country: data.user.country || 'India',
              state: data.user.state || '',
              city: data.user.city || '',
              pincode: data.user.pincode || '',
              address: data.user.clinic_address || ''
            });

            if (enterpriseOwner) {
              const orgRes = await fetch(`${API_BASE_URL}/auth/organization`, { credentials: 'include' });
              if (orgRes.ok) {
                const orgJson = await orgRes.json();
                if (orgJson.organization) {
                  setOrgData({
                    company_name: orgJson.organization.company_name || '',
                    company_email: orgJson.organization.company_email || '',
                    gst: orgJson.organization.gst || '',
                    street: orgJson.organization.street || '',
                    city: orgJson.organization.city || '',
                    pincode: orgJson.organization.pincode || '',
                    state: orgJson.organization.state || '',
                    country: orgJson.organization.country || 'India',
                  });
                }
              }
            }
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

  useEffect(() => {
    if (!socket) return;
    socket.on('profile_updated', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          let profilePicUrl = data.user.profile_picture || '';
          if (profilePicUrl && !profilePicUrl.startsWith('http')) {
            profilePicUrl = `${API_BASE_URL}${profilePicUrl}`;
          }
          setProfilePicture(profilePicUrl);
          setFormData({
            fullName: data.user.user_name || '',
            phoneNumber: data.user.phone || '',
            dateOfBirth: data.user.date_of_birth ? new Date(data.user.date_of_birth).toISOString().split('T')[0] : '',
            email: data.user.email || '',
            gender: data.user.gender || '',
            specialization: data.user.specialization || '',
            languages: data.user.language_spoken ? (Array.isArray(data.user.language_spoken) ? data.user.language_spoken.join(', ') : data.user.language_spoken) : '',
            country: data.user.country || 'India',
            state: data.user.state || '',
            city: data.user.city || '',
            pincode: data.user.pincode || '',
            address: data.user.clinic_address || ''
          });
        }
      }
    });
    return () => { socket.off('profile_updated'); };
  }, [socket]);

  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-fill city and state when pincode is entered
    if (field === 'pincode' && value.length === 6) {
      fetchLocationByPincode(value);
    }
  }, []);

  const handleOrgChange = useCallback((field: keyof OrgData, value: string) => {
    setOrgData(prev => ({ ...prev, [field]: value }));
    if (field === 'pincode' && value.length === 6) {
      fetchOrgLocationByPincode(value);
    }
  }, []);

  const fetchOrgLocationByPincode = async (pincode: string) => {
    if (!/^\d{6}$/.test(pincode)) return;
    try {
      console.log('Fetching org location for pincode:', pincode);
      const response = await fetch(`${API_BASE_URL}/api/pincode/${pincode}`);
      
      console.log('API Response status:', response.status);
      if (!response.ok) throw new Error('API error');
      
      const data = await response.json();
      console.log('API Response data:', data);
      
      if (data.success) {
        console.log('Location found:', data);
        setOrgData(prev => ({
          ...prev,
          city: data.city || prev.city,
          state: data.state || prev.state
        }));
        toast.success('Location auto-filled from pincode');
      } else {
        console.log('No location found in response');
        toast.warning(data.error || 'Could not find location for this pincode');
      }
    } catch (error) {
      console.error('Error fetching org location:', error);
      toast.warning('Could not auto-fill location. Please enter manually.');
    }
  };

  const fetchLocationByPincode = async (pincode: string) => {
    if (!/^\d{6}$/.test(pincode)) return;
    try {
      console.log('Fetching location for pincode:', pincode);
      const response = await fetch(`${API_BASE_URL}/api/pincode/${pincode}`);
      
      console.log('API Response status:', response.status);
      if (!response.ok) throw new Error('API error');
      
      const data = await response.json();
      console.log('API Response data:', data);
      
      if (data.success) {
        console.log('Location found:', data);
        setFormData(prev => ({
          ...prev,
          city: data.city || prev.city,
          state: data.state || prev.state
        }));
        toast.success('Location auto-filled from pincode');
      } else {
        console.log('No location found in response');
        toast.warning(data.error || 'Could not find location for this pincode');
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      toast.warning('Could not auto-fill location. Please enter manually.');
    }
  };

  const handleSaveChanges = useCallback(async () => {
    // Validate required fields before hitting the API
    if (!formData.phoneNumber.trim()) {
      toast.error('Phone number is required.');
      return;
    }
    if (!/^\d{10}$/.test(formData.phoneNumber.trim())) {
      toast.error('Phone number must be 10 digits.');
      return;
    }
    if (!formData.dateOfBirth.trim()) {
      toast.error('Date of birth is required.');
      return;
    }
    if (!formData.gender.trim()) {
      toast.error('Gender is required.');
      return;
    }
    if (!formData.specialization.trim()) {
      toast.error('Specialization is required.');
      return;
    }
    if (!formData.languages.trim()) {
      toast.error('Languages spoken is required.');
      return;
    }
    if (!formData.country.trim()) {
      toast.error('Country is required.');
      return;
    }
    if (!formData.state.trim()) {
      toast.error('State is required.');
      return;
    }
    if (!formData.city.trim()) {
      toast.error('City is required.');
      return;
    }
    if (!formData.pincode.trim()) {
      toast.error('Pincode is required.');
      return;
    }
    if (!formData.address.trim()) {
      toast.error('Office or clinic address is required.');
      return;
    }

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

      const response = await fetch(`${API_BASE_URL}/auth/complete-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Save org details if enterprise owner
        if (isEnterpriseOwner) {
          const orgRes = await fetch(`${API_BASE_URL}/auth/organization`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(orgData)
          });
          if (!orgRes.ok) {
            toast.error('Profile saved but failed to save organization details.');
            return;
          }
        }
        toast.success('Profile changes saved successfully!');
        // Refresh user auth state to update profileComplete flag
        await checkAuth();
      } else {
        toast.error('Failed to save profile changes.');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Error saving profile changes.');
    }
  }, [formData, isEnterpriseOwner, orgData, toast, checkAuth]);

  const handleImageChange = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Check file size (3MB limit)
        if (file.size > 3 * 1024 * 1024) {
          toast.error('Image size must be less than 3MB');
          return;
        }

        try {
          const formData = new FormData();
          formData.append('profilePicture', file);

          const response = await fetch(`${API_BASE_URL}/auth/upload-profile-picture`, {
            method: 'POST',
            credentials: 'include',
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            setProfilePicture(`${API_BASE_URL}${data.profilePicture}`);
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
  }, [toast]);

  if (loading) return <Loader fullScreen />;

  return (
    <div className={styles.profilePage}>
      <div className={styles.profileHeader}>
        <div className={styles.headerContent}>
          <button className={styles.backBtn} onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <h1>My Profile</h1>
            <p style={{ fontSize: '14px' }}>Manage your personal information and preferences.</p>
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
              <svg width="24" height="24" viewBox="0 0 28 24" fill="none">
                <circle cx="12" cy="7" r="4" stroke="#2D7579" strokeWidth="2" fill="none" />
                <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" stroke="#2D7579" strokeWidth="2" fill="none" />
                <path d="M20 8h4m-2-2v4" stroke="#2D7579" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <button className={styles.changeImageBtn} onClick={handleImageChange}>+ Change profile image</button>
          <span style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: 'Urbanist', marginTop: '4px' }}>Max file size: 3MB (JPG, PNG, WebP)</span>
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
            <label>Gender<span className={styles.required}>*</span></label>
            <CustomDropdown
              options={[
                { value: 'Female', label: 'Female' },
                { value: 'Male', label: 'Male' },
                { value: 'Other', label: 'Other' }
              ]}
              value={formData.gender}
              onChange={(val) => handleInputChange('gender', val)}
              placeholder="Select gender"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Specialization<span className={styles.required}>*</span></label>
            <input
              type="text"
              value={formData.specialization}
              onChange={(e) => handleInputChange('specialization', e.target.value)}
              placeholder="e.g., Clinical Psychologist, Counselling Therapist"
              maxLength={150}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Languages Spoken<span className={styles.required}>*</span></label>
            <LanguageMultiSelect
              value={formData.languages}
              onChange={(val) => handleInputChange('languages', val)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Country<span className={styles.required}>*</span></label>
            <CountrySelect
              value={formData.country}
              onChange={(val) => handleInputChange('country', val)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>State<span className={styles.required}>*</span></label>
            <StateSelect
              country={formData.country}
              value={formData.state}
              onChange={(val) => handleInputChange('state', val)}
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

      {isEnterpriseOwner && (
        <div className={styles.profileContent} style={{ marginTop: '24px' }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Organization Details</h2>
            <p className={styles.sectionSubtitle}>Billing and legal information for your enterprise account.</p>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Company Name</label>
              <input
                type="text"
                value={orgData.company_name}
                onChange={(e) => handleOrgChange('company_name', e.target.value)}
                placeholder="Acme Wellness Pvt. Ltd."
              />
            </div>

            <div className={styles.formGroup}>
              <label>Company Email</label>
              <input
                type="email"
                value={orgData.company_email}
                onChange={(e) => handleOrgChange('company_email', e.target.value)}
                placeholder="billing@company.com"
              />
            </div>

            <div className={styles.formGroup}>
              <label>GST Number</label>
              <input
                type="text"
                value={orgData.gst}
                onChange={(e) => handleOrgChange('gst', e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
            </div>

            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label>Street Address</label>
              <input
                type="text"
                value={orgData.street}
                onChange={(e) => handleOrgChange('street', e.target.value)}
                placeholder="123, MG Road, Sector 5"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Pincode</label>
              <input
                type="text"
                value={orgData.pincode}
                onChange={(e) => handleOrgChange('pincode', e.target.value)}
                maxLength={6}
                placeholder="400001"
              />
            </div>

            <div className={styles.formGroup}>
              <label>City</label>
              <input
                type="text"
                value={orgData.city}
                onChange={(e) => handleOrgChange('city', e.target.value)}
                placeholder="Mumbai"
              />
            </div>

            <div className={styles.formGroup}>
              <label>State</label>
              <StateSelect
                country={orgData.country}
                value={orgData.state}
                onChange={(val) => handleOrgChange('state', val)}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Country</label>
              <CountrySelect
                value={orgData.country}
                onChange={(val) => handleOrgChange('country', val)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProfile;
