import { memo } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Links always open in a new tab so a click never navigates away from the app. */
function MdLink({ href, children }: { href?: string; children?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  )
}

/**
 * Render assistant text as markdown — bold, inline code, code blocks, lists, links,
 * headings, tables — the way a chat client does. Raw HTML is not rendered (safe).
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MdLink }}>
        {text}
      </ReactMarkdown>
    </div>
  )
})
