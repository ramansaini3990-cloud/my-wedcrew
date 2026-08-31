import { useState, useId } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { PASSWORD_RULES } from '../../utils/passwordRules';

/**
 * Password field with an accessible show/hide toggle, and optional live
 * requirement feedback.
 *
 * The rules mirror backend/src/services/passwordPolicy.js. They exist purely
 * for immediate feedback - the server is what actually accepts or rejects a
 * password, so removing this component cannot weaken the policy.
 *
 * Nothing here changes how the password is submitted: it is still the plain
 * form value posted to the existing auth API, and it is never logged.
 */


export default function PasswordInput({
  value,
  onChange,
  id,
  name = 'password',
  placeholder = 'Password',
  className = '',
  required = false,
  autoComplete = 'current-password',
  showRequirements = false,
  ...rest
}) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const fieldId = id || `password-${generatedId}`;
  const helpId = `${fieldId}-requirements`;

  const met = (rule) => rule.test(value || '');
  const showList = showRequirements && (value || '').length > 0;

  return (
    <div>
      <div className="relative">
        <input
          id={fieldId}
          name={name}
          // Toggling the type is all that changes - the value posted is identical.
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-describedby={showRequirements ? helpId : undefined}
          className={`${className} pr-12`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Keep the caret in the field: without this, clicking the eye blurs it.
          onMouseDown={(e) => e.preventDefault()}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          title={visible ? 'Hide password' : 'Show password'}
          // Inset slightly so the focus ring is a neat rounded square inside the
          // field rather than a square edge clipping the input's rounded corner.
          className="absolute inset-y-1 right-1.5 z-10 flex min-w-[40px] items-center justify-center rounded-lg text-brand-navy/65 hover:text-brand-primary hover:bg-brand-navy/5 active:text-brand-primaryDark transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          {/* Closed eye while the password is hidden, open eye once revealed. */}
          {visible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
        </button>
      </div>

      {showList && (
        <ul id={helpId} className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1" aria-live="polite">
          {PASSWORD_RULES.map((rule) => {
            const ok = met(rule);
            return (
              <li
                key={rule.id}
                className={`flex items-center gap-1.5 text-[11.5px] ${ok ? 'text-green-700' : 'text-brand-textSec'}`}
              >
                {ok ? (
                  <Check size={12} className="shrink-0" aria-hidden="true" />
                ) : (
                  <X size={12} className="shrink-0 text-brand-muted" aria-hidden="true" />
                )}
                {rule.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
