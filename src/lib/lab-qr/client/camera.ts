import { decodeFrame } from './qr'

/**
 * In-browser camera scanning. Needs HTTPS and a user gesture (the permission prompt), which the pages
 * provide with an explicit "Start camera" button. Every failure maps to a reason the page turns into
 * words and a way forward, because the typed-code path is always available beside the camera.
 */

export type CameraProblem = 'insecure' | 'unsupported' | 'denied' | 'no-camera' | 'busy' | 'unknown'

export type CameraSession = { stop: () => void; usesNativeDetector: boolean }

type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike

export function problemFromError(error: unknown): CameraProblem {
  const name = (error as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-camera'
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy'
  return 'unknown'
}

export function cameraSupport(): CameraProblem | null {
  if (typeof window === 'undefined') return 'unsupported'
  if (!window.isSecureContext) return 'insecure'
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
  return null
}

export async function startCamera(
  video: HTMLVideoElement,
  onText: (text: string) => void,
  options: { intervalMs?: number } = {},
): Promise<{ ok: true; session: CameraSession } | { ok: false; problem: CameraProblem }> {
  const unsupported = cameraSupport()
  if (unsupported) return { ok: false, problem: unsupported }
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
  } catch (error) {
    return { ok: false, problem: problemFromError(error) }
  }
  video.srcObject = stream
  video.setAttribute('playsinline', 'true')
  video.muted = true
  try {
    await video.play()
  } catch {
    stream.getTracks().forEach((t) => t.stop())
    return { ok: false, problem: 'busy' }
  }

  const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  let detector: BarcodeDetectorLike | null = null
  try {
    detector = Detector ? new Detector({ formats: ['qr_code'] }) : null
  } catch {
    detector = null
  }
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  let stopped = false
  let busy = false
  const interval = options.intervalMs ?? 150

  const tick = async () => {
    if (stopped) return
    if (!busy && video.readyState >= 2 && video.videoWidth > 0) {
      busy = true
      try {
        let text: string | null = null
        if (detector) {
          const found = await detector.detect(video)
          text = found[0]?.rawValue ?? null
        }
        if (!text && context) {
          const scale = Math.min(1, 720 / video.videoWidth)
          canvas.width = Math.round(video.videoWidth * scale)
          canvas.height = Math.round(video.videoHeight * scale)
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          const frame = context.getImageData(0, 0, canvas.width, canvas.height)
          text = decodeFrame(frame.data, frame.width, frame.height)
        }
        if (text && !stopped) onText(text)
      } catch {
        // a bad frame is not an error worth showing; the next one may decode
      } finally {
        busy = false
      }
    }
    if (!stopped) window.setTimeout(tick, interval)
  }
  window.setTimeout(tick, interval)

  return {
    ok: true,
    session: {
      usesNativeDetector: detector !== null,
      stop: () => {
        stopped = true
        stream.getTracks().forEach((t) => t.stop())
        video.srcObject = null
      },
    },
  }
}
