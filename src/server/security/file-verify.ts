import { fileTypeFromBuffer } from 'file-type'

/**
 * The declared Content-Type on an upload is whatever the client sent — a
 * renamed .exe with a `.pdf` name and a spoofed header sails straight past
 * ALLOWED_UPLOAD_MIME_TYPES otherwise (§4.2). This sniffs the actual bytes.
 *
 * Legacy OLE .doc/.ppt files are deliberately unsupported. Their shared CFBF
 * container cannot be distinguished safely by this lightweight verifier and
 * they are a poor production boundary without a quarantine/scanning service.
 */
const ACCEPTED_SNIFFED_MIME_TYPES: Record<string, readonly string[]> = {
  'application/pdf': ['application/pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
}

export async function verifyFileContents(buffer: Buffer, declaredMimeType: string): Promise<boolean> {
  const accepted = ACCEPTED_SNIFFED_MIME_TYPES[declaredMimeType]
  if (!accepted) return false

  const sniffed = await fileTypeFromBuffer(buffer)
  // No detectable signature at all (empty file, unrecognized format) is
  // rejected rather than let through on the unverified word of the client.
  if (!sniffed) return false

  return accepted.includes(sniffed.mime)
}
