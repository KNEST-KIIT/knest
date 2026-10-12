'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { startCamera, type CameraProblem, type CameraSession } from '@/lib/lab-qr/client/camera'
import { encodeQr, qrPath } from '@/lib/lab-qr/client/qr'

export const buttonClass =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-4 text-[length:var(--text-small)] font-semibold text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-signal)] disabled:opacity-50'
export const primaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-signal)] px-4 text-[length:var(--text-small)] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink)] disabled:opacity-50'
export const inputClass =
  'min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3 text-[length:var(--text-small)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-signal)]'
export const cardClass = 'rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5'

/** A QR drawn as SVG. The text alternative is the label; the same code is available as text beside it. */
export function QrImage({ text, label }: { text: string; label: string }) {
  const drawn = useMemo(() => qrPath(encodeQr(text)), [text])
  return (
    <svg role="img" aria-label={label} viewBox={drawn.viewBox} className="mx-auto h-auto w-full max-w-[20rem] bg-white" shapeRendering="crispEdges">
      <path d={drawn.path} fill="#000" />
    </svg>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'good' | 'warn' | 'bad'; children: React.ReactNode }) {
  const label = { info: 'Note', good: 'Done', warn: 'Check', bad: 'Problem' }[tone]
  const border = { info: 'var(--color-line-strong)', good: 'var(--color-positive)', warn: 'var(--color-caution)', bad: 'var(--color-critical)' }[tone]
  return (
    <p role={tone === 'bad' ? 'alert' : 'status'} className="rounded-[var(--radius-sm)] border-l-4 bg-[var(--color-paper-soft)] px-3 py-2 text-[length:var(--text-small)]" style={{ borderColor: border }}>
      <strong>{label}: </strong>
      {children}
    </p>
  )
}

const CAMERA_WORDS: Record<CameraProblem, string> = {
  insecure: 'The camera only works on a secure (https) page.',
  unsupported: 'This browser cannot open the camera from this page.',
  denied: 'Camera access is blocked. Allow it for this site in your browser settings, or use the code box below.',
  'no-camera': 'No camera was found on this device. Use the code box below.',
  busy: 'The camera is in use by another app. Close it and try again, or use the code box below.',
  unknown: 'The camera could not start. Use the code box below.',
}

/**
 * Camera scanning with a plain-text path beside it that does the same job. Starting the camera is an
 * explicit button press (the permission prompt needs a gesture), and a person who cannot or will not
 * use the camera is never worse off: the text box takes the same code and goes through the same checks.
 */
export function ScanInput({
  id,
  label,
  help,
  onCode,
  cameraLabel,
}: {
  id: string
  label: string
  help: string
  onCode: (text: string, via: 'camera' | 'text') => void
  cameraLabel: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const sessionRef = useRef<CameraSession | null>(null)
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  const [running, setRunning] = useState(false)
  const [problem, setProblem] = useState<CameraProblem | null>(null)
  const [text, setText] = useState('')

  useEffect(() => () => sessionRef.current?.stop(), [])

  async function start() {
    setProblem(null)
    if (!videoRef.current) return
    const started = await startCamera(videoRef.current, (found) => {
      const now = Date.now()
      // the same code is seen on many frames; hand it over once every few seconds
      if (found === lastRef.current.text && now - lastRef.current.at < 4000) return
      lastRef.current = { text: found, at: now }
      onCode(found, 'camera')
    })
    if (!started.ok) {
      setProblem(started.problem)
      return
    }
    sessionRef.current = started.session
    setRunning(true)
  }
  function stop() {
    sessionRef.current?.stop()
    sessionRef.current = null
    setRunning(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <video ref={videoRef} aria-label={cameraLabel} className={running ? 'aspect-square w-full max-w-sm rounded-[var(--radius-md)] bg-black object-cover' : 'hidden'} playsInline muted />
        <div className="flex flex-wrap gap-2">
          {running ? (
            <button type="button" className={buttonClass} onClick={stop}>
              Stop camera
            </button>
          ) : (
            <button type="button" className={primaryButtonClass} onClick={start}>
              Start camera
            </button>
          )}
        </div>
        {problem && <div className="mt-2"><Notice tone="warn">{CAMERA_WORDS[problem]}</Notice></div>}
      </div>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (text.trim()) {
            onCode(text.trim(), 'text')
            setText('')
          }
        }}
      >
        <label htmlFor={id} className="block text-[length:var(--text-small)] font-semibold">
          {label}
        </label>
        <p id={`${id}-help`} className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          {help}
        </p>
        <textarea
          id={id}
          aria-describedby={`${id}-help`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={`${inputClass} py-2 font-mono`}
        />
        <button type="submit" className={buttonClass} disabled={!text.trim()}>
          Use this code
        </button>
      </form>
    </div>
  )
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={buttonClass}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          window.setTimeout(() => setDone(false), 2000)
        } catch {
          setDone(false)
        }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  )
}
