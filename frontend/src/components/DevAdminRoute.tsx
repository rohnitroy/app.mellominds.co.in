import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DevAdminRoute: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  // If not authenticated or user doesn't have is_dev_admin flag, redirect
  if (!isAuthenticated || !user || !(user as any).is_dev_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default DevAdminRoute;
