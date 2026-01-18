/**
 * Authentication utility functions
 * Provides helpers for role-based redirects and authentication flows
 */

/**
 * Get the appropriate logout redirect URL based on user role
 * 
 * Requirements: 5.2, 5.3, 5.4
 * - Patients redirect to /sign-in
 * - Doctors/admins redirect to /
 * 
 * @param pathname - Current pathname to determine user role
 * @returns Redirect URL for logout
 */
export function getLogoutRedirectUrl(pathname: string): string {
  // Determine role based on current path
  const isPatient = pathname.startsWith('/patient');
  
  // Patients go to sign-in page, others go to home
  return isPatient ? '/sign-in' : '/';
}

/**
 * Get the appropriate sign-in redirect URL based on user role
 * 
 * @param role - User role (patient, doctor, admin)
 * @returns Dashboard URL for the role
 */
export function getSignInRedirectUrl(role: 'patient' | 'doctor' | 'admin'): string {
  switch (role) {
    case 'patient':
      return '/patient';
    case 'doctor':
      return '/doctor';
    case 'admin':
      return '/admin';
    default:
      return '/patient';
  }
}
