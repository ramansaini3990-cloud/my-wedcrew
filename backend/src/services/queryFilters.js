/**
 * Safe coercion of user-supplied query-string values into Mongo filters.
 *
 * THE PROBLEM
 * -----------
 * Express parses query strings with the `extended` parser, so a request like
 *
 *     GET /api/requirements?status[$ne]=published
 *
 * arrives as `req.query.status === { $ne: 'published' }` - a real JavaScript
 * object. Assigning that straight into a filter, as in
 *
 *     if (req.query.status) query.status = req.query.status;
 *
 * hands the caller a live Mongo operator and lets them rewrite the query:
 * $ne to escape a status scope, $regex to scan, $gt to walk a range. The
 * values look like harmless strings in the code, which is what makes it easy
 * to miss.
 *
 * THE RULE HERE
 * -------------
 * A filter value is only ever a primitive that the client sent as a primitive.
 * Anything else - an object, an array, a nested operator - is not "cleaned up"
 * into a usable value, because there is no legitimate request that produces
 * one. It is refused, and the caller gets an EMPTY result set.
 *
 * Empty rather than unfiltered is deliberate. Silently dropping a rejected
 * filter would WIDEN the query: `?status[$ne]=x` on the admin requirement list
 * would stop filtering and start returning drafts. Matching nothing is both
 * safe and the same thing the caller already sees today if they pass a value
 * that does not exist.
 */

/** A filter fragment that cannot match any document. */
export const MATCH_NOTHING = { $in: [] };

/**
 * The value as a plain string, or null if the client did not send a primitive.
 * Objects and arrays - the injection shapes - always return null.
 */
export const asPlainString = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

/**
 * Filter fragment for a free-text field. Returns MATCH_NOTHING if the caller
 * sent anything other than a primitive.
 */
export const stringFilter = (value) => {
  const text = asPlainString(value);
  return text === null || text === '' ? MATCH_NOTHING : text;
};

/**
 * Filter fragment for a field with a Mongoose enum.
 *
 * The permitted values are read from the SCHEMA at call time
 * (`Model.schema.path(field).enumValues`), so this can never drift out of step
 * with the model the way a second hardcoded list would. A value outside the
 * enum - or an injected operator - matches nothing.
 *
 * @param {*} value               the raw req.query value
 * @param {import('mongoose').Model} model
 * @param {string} field          the schema path holding the enum
 */
export const enumFilter = (value, model, field) => {
  const text = asPlainString(value);
  if (text === null || text === '') return MATCH_NOTHING;

  const allowed = model?.schema?.path(field)?.enumValues;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    // No enum on the schema: fall back to the primitive check, which still
    // blocks operator injection even though it cannot check membership.
    return text;
  }

  return allowed.includes(text) ? text : MATCH_NOTHING;
};

/**
 * Filter fragment for a date field. Rejects non-primitives, and also rejects
 * unparseable dates - which previously reached Mongoose and threw a CastError
 * that surfaced as a 500.
 */
export const dateFilter = (value) => {
  const text = asPlainString(value);
  if (text === null || text === '') return MATCH_NOTHING;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? MATCH_NOTHING : text;
};

export default { MATCH_NOTHING, asPlainString, stringFilter, enumFilter, dateFilter };
