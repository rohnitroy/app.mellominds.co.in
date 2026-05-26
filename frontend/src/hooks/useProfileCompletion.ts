import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

interface UseProfileCompletionReturn {
  isProfileComplete: boolean;
  showProfileModal: boolean;
  setShowProfileModal: (show: boolean) => void;
  checkProfileCompletion: (featureName?: string) => boolean;
}

/**
 * Hook to check profile completion and manage profile completion modal
 * Usage: const { isProfileComplete, showProfileModal, setShowProfileModal, checkProfileCompletion } = useProfileCompletion();
 * 
 * To guard a feature:
 * if (!checkProfileCompletion('Calendar Setup')) return;
 */
export const useProfileCompletion = (): UseProfileCompletionReturn => {
  const { user } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const isProfileComplete = user?.profileComplete ?? false;

  const checkProfileCompletion = useCallback((featureName: string = 'this feature'): boolean => {
    if (!isProfileComplete) {
      setShowProfileModal(true);
      return false;
    }
    return true;
  }, [isProfileComplete]);

  return {
    isProfileComplete,
    showProfileModal,
    setShowProfileModal,
    checkProfileCompletion,
  };
};
