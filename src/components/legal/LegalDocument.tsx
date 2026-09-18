import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export type LegalBlock = string | { list: string[] }

export interface LegalSection {
  heading: string
  blocks: LegalBlock[]
}

interface LegalDocumentProps {
  title: string
  lastUpdated: string
  metaDescription: string
  intro: LegalBlock[]
  sections: LegalSection[]
  otherDocument: { label: string; to: string }
}

const Blocks = ({ blocks }: { blocks: LegalBlock[] }) => (
  <>
    {blocks.map((block, index) =>
      typeof block === 'string' ? (
        <p key={index} className="text-muted-foreground leading-relaxed">
          {block}
        </p>
      ) : (
        <ul key={index} className="list-disc pl-6 space-y-1 text-muted-foreground leading-relaxed">
          {block.list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )
    )}
  </>
)

export const LegalDocument = ({
  title,
  lastUpdated,
  metaDescription,
  intro,
  sections,
  otherDocument,
}: LegalDocumentProps) => {
  useEffect(() => {
    const previousTitle = document.title
    document.title = `${title} — ShTrader`
    const meta = document.querySelector('meta[name="description"]')
    const previousDescription = meta?.getAttribute('content') ?? null
    meta?.setAttribute('content', metaDescription)
    window.scrollTo(0, 0)
    return () => {
      document.title = previousTitle
      if (meta && previousDescription !== null) {
        meta.setAttribute('content', previousDescription)
      }
    }
  }, [title, metaDescription])

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to ShTrader
        </Link>

        <header className="mt-6 pb-6 border-b">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last Updated: {lastUpdated}</p>
        </header>

        <div className="mt-6 space-y-4">
          <Blocks blocks={intro} />
        </div>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
              <Blocks blocks={section.blocks} />
            </section>
          ))}
        </div>

        <footer className="mt-12 pt-6 border-t flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link to={otherDocument.to} className="text-primary hover:underline font-medium">
            {otherDocument.label}
          </Link>
          <a href="mailto:support@shtrader.app" className="text-primary hover:underline">
            support@shtrader.app
          </a>
        </footer>
      </div>
    </div>
  )
}

export default LegalDocument
