/**
 * Starts the API configured for the END-TO-END TEST SUITES ONLY.
 *
 * WHY THIS EXISTS
 * ---------------
 * The suites drive registration and login directly against the HTTP API. Three
 * production behaviours make that impossible, and all three are read by the
 * SERVER process - not by the test client - so they cannot be set from the
 * `npm run test:*` scripts. They have to be set here, before server.js loads.
 *
 *   EMAIL_VERIFICATION_REQUIRED=false
 *     Registration deliberately returns no JWT and login answers 403
 *     EMAIL_NOT_VERIFIED until the address is confirmed. There is no mailbox in
 *     CI to confirm from, so every suite would fail at its first login.
 *
 *   EMAIL_MX_CHECK_ENABLED=false
 *     The suites use @e2e.local addresses. That domain has no MX record, so
 *     signup would be rejected with DOMAIN_CANNOT_RECEIVE_MAIL - correctly.
 *
 *   RATE_LIMIT_AUTH_MAX / RATE_LIMIT_API_MAX
 *     authLimiter allows 10 auth calls per 15 minutes. A single suite makes
 *     dozens, so runs two onwards died on 429 "Admin login failed".
 *
 * THIS MUST NEVER BE THE DEFAULT START COMMAND. `npm start` stays untouched.
 * As a second line of defence, verificationRequired() in authController.js
 * ignores EMAIL_VERIFICATION_REQUIRED=false whenever NODE_ENV=production, so
 * even running this by accident on a production box cannot open up signup.
 */

if (process.env.NODE_ENV === 'production') {
  console.error(
    '[start:e2e] REFUSING TO START: NODE_ENV=production.\n' +
      '            This entry point relaxes email verification and rate limiting ' +
      'and is for local test runs only. Use `npm start`.'
  );
  process.exit(1);
}

const OVERRIDES = {
  EMAIL_VERIFICATION_REQUIRED: 'false',
  EMAIL_MX_CHECK_ENABLED: 'false',
  EMAIL_PROVIDER: 'console',
  RATE_LIMIT_AUTH_MAX: '100000',
  RATE_LIMIT_API_MAX: '1000000'
};

for (const [key, value] of Object.entries(OVERRIDES)) {
  process.env[key] = value;
}

console.warn(
  '[start:e2e] TEST MODE - email verification, MX checking and rate limiting are relaxed.\n' +
    '            Never use this to serve real users.'
);

// Imported only after the overrides are in place: server.js reads them at load.
await import('../../server.js');
