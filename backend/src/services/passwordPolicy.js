/**
 * Strong-password policy — the single source of truth.
 *
 * Applied to flows that SET a password (registration, admin seeder). It is
 * deliberately NOT applied on login: existing accounts created under the old
 * rules must keep working, so no current user is locked out by this change.
 *
 * The frontend mirrors these rules for live feedback only; this module is what
 * actually decides, so removing the client-side checks changes nothing.
 */

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'lowercase', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { id: 'number', label: 'One number', test: (v) => /[0-9]/.test(v) },
  { id: 'special', label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) }
];

export const PASSWORD_POLICY_TEXT =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character.';

/**
 * @param {string} password
 * @returns {{ok: boolean, failed: string[], message: string|null}}
 */
export const validatePassword = (password) => {
  const value = typeof password === 'string' ? password : '';

  const failed = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((r) => r.id);

  return {
    ok: failed.length === 0,
    failed,
    message: failed.length === 0 ? null : PASSWORD_POLICY_TEXT
  };
};

/** Standard 400 body for a rejected password. Never echoes the password. */
export const passwordPolicyError = (result) => ({
  code: 'WEAK_PASSWORD',
  message: result.message || PASSWORD_POLICY_TEXT,
  failed_rules: result.failed
});

export default { PASSWORD_RULES, PASSWORD_POLICY_TEXT, validatePassword, passwordPolicyError };
