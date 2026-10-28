/**
 * The industry-standard EICAR anti-malware TEST string. It is not malware, and antivirus products are meant to flag
 * it, which is why it is the usual way to prove that a scanner is wired up.
 *
 * Assembled from parts so this source file does not itself contain the whole signature (some endpoint security
 * tools quarantine any file that does).
 */
export const EICAR_SIGNATURE = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$', 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE', '!$H+H*'].join('')
