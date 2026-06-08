import { isDevAdmin } from '../config/devAdmin.js';

export const devAdminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Not logged in' });
  }

  if (!isDevAdmin(req.user.email)) {
    return res.status(403).json({ error: 'Forbidden: Dev admin access required' });
  }

  next();
};

export default devAdminOnly;
