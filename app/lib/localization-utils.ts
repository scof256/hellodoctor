/**
 * Localization utilities for formatting dates, times, and phone numbers
 * according to Ugandan conventions
 */

/**
 * Format date in DD/MM/YYYY format (Ugandan standard)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Format time in 12-hour format with AM/PM
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Format date and time together
 */
export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Format phone number in Ugandan format (+256...)
 * Accepts various input formats and normalizes them
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Handle different input formats
  if (digits.startsWith('256')) {
    // Already has country code
    return `+${digits}`;
  } else if (digits.startsWith('0')) {
    // Local format (0xxx xxx xxx)
    return `+256${digits.substring(1)}`;
  } else if (digits.length === 9) {
    // Missing leading 0
    return `+256${digits}`;
  }
  
  // Return as-is if format is unclear
  return phone;
}

/**
 * Format currency in Ugandan Shillings (UGX)
 */
export function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString('en-UG')}`;
}

/**
 * Get relative date label (Today, Yesterday, Tomorrow)
 */
export function getRelativeDateLabel(date: Date | string, t: (key: string) => string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  
  // Reset time to midnight for comparison
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const diffTime = dateOnly.getTime() - todayOnly.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return t('dateTime.today');
  } else if (diffDays === -1) {
    return t('dateTime.yesterday');
  } else if (diffDays === 1) {
    return t('dateTime.tomorrow');
  }
  
  return formatDate(d);
}

/**
 * Parse phone number input as user types
 * Auto-formats to +256 format
 */
export function parsePhoneInput(input: string): string {
  // Remove all non-digit characters except +
  let cleaned = input.replace(/[^\d+]/g, '');
  
  // If starts with +256, keep it
  if (cleaned.startsWith('+256')) {
    return cleaned;
  }
  
  // If starts with 256, add +
  if (cleaned.startsWith('256')) {
    return `+${cleaned}`;
  }
  
  // If starts with 0, replace with +256
  if (cleaned.startsWith('0')) {
    return `+256${cleaned.substring(1)}`;
  }
  
  // If just digits, assume local format
  if (cleaned.length > 0 && !cleaned.startsWith('+')) {
    return `+256${cleaned}`;
  }
  
  return cleaned;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  
  // Should be 12 digits total (256 + 9 digits)
  // or 10 digits if local format (0 + 9 digits)
  return (
    (digits.startsWith('256') && digits.length === 12) ||
    (digits.startsWith('0') && digits.length === 10) ||
    digits.length === 9
  );
}
