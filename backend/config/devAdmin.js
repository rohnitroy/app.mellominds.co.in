// Dev Admin Whitelist - SuperAdmins & Platform Creators
// Only these emails can access /devdashboard and admin APIs

export const DEV_ADMIN_EMAILS = [
  'mellomindsventure@gmail.com', // Aastha Saraf
];

export const isDevAdmin = (email) => {
  if (!email) return false;
  return DEV_ADMIN_EMAILS.includes(email.toLowerCase());
};
