import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute: React.FC = () => {
    const { isAuthenticated, user } = useAuth();

    if (!isAuthenticated) {
        // Redirect to login if not authenticated
        // replace: true prevents going back to this page via back button
        return <Navigate to="/login" replace />;
    }

    // First-time users must choose a plan before entering the app.
    // Dev admins and team members (plan inherited from owner) are exempt.
    if (
        user &&
        user.plan_selected === false &&
        !user.is_dev_admin &&
        user.org_role !== 'member'
    ) {
        return <Navigate to="/pricing" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
