/**
 * Client-side mirror of backend/src/services/passwordPolicy.js.
 *
 * Used for live feedback only. The server independently enforces the same rules
 * on every password-setting request, so editing or bypassing this file cannot
 * create a weak account.
 */
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'lowercase', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { id: 'number', label: 'One number', test: (v) => /[0-9]/.test(v) },
  { id: 'special', label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) }
];

export const isPasswordStrong = (value) => PASSWORD_RULES.every((r) => r.test(value || ''));
