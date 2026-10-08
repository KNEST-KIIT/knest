/**
 * Timing-equalising comparison target for accounts that do not exist (KN-22a).
 *
 * It must be a *valid* 60-character bcrypt hash at the same cost as real ones:
 * bcryptjs returns immediately for a malformed hash, which made unknown-email
 * logins ~700 ms faster than known-email ones and revealed which emails exist.
 * It is the hash of a random value that was discarded, so nothing matches it.
 */
export const DUMMY_HASH = '$2b$12$7/HTiK5DSxlrt6HI.o7nJ.wVcv//EpooCMFZ3z7xAfGnAcibl5aDK'
