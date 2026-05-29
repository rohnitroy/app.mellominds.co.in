import React, { ReactNode } from 'react';
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import ProfileCompletionModal from './ProfileCompletionModal';

interface ProtectedFeatureProps {
  featureName: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Wrapper component to protect features behind profile completion
 * Usage:
 * <ProtectedFeature featureName="Calendar Setup">
 *   <CalendarPage />
 * </ProtectedFeature>
 */
const ProtectedFeature: React.FC<ProtectedFeatureProps> = ({
  featureName,
  children,
  fallback = null,
}) => {
  const { isProfileComplete, showProfileModal, setShowProfileModal } =
    useProfileCompletion();

  if (!isProfileComplete) {
    return (
      <>
        {fallback}
        <ProfileCompletionModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          featureName={featureName}
        />
      </>
    );
  }

  return <>{children}</>;
};

export default ProtectedFeature;
