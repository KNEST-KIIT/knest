import { defaultJSXConverters, RichText as PayloadRichText } from '@payloadcms/richtext-lexical/react'
import { cn } from '@/lib/cn'

type LexicalData = NonNullable<Parameters<typeof PayloadRichText>[0]['data']>

/**
 * Renders a Payload Lexical field. Wraps the library's own RichText component
 * rather than hand-rolling a serializer — Payload already ships one that
 * handles headings, lists, links and marks correctly.
 */
export function RichText({ data, className }: { data: LexicalData | null | undefined; className?: string }) {
  if (!data) return null

  return (
    <div className={cn('prose-knest', className)}>
      <PayloadRichText data={data} converters={defaultJSXConverters} />
    </div>
  )
}
