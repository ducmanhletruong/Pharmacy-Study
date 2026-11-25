import katex from 'katex'
import 'katex/contrib/mhchem'

export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g).map((part, index) => {
        if (!part.startsWith('$')) return <span key={index}>{part}</span>
        const displayMode = part.startsWith('$$')
        const expression = part.slice(
          displayMode ? 2 : 1,
          displayMode ? -2 : -1,
        )
        return (
          <span
            key={index}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(expression, {
                displayMode,
                throwOnError: false,
                trust: false,
                strict: 'warn',
              }),
            }}
          />
        )
      })}
    </>
  )
}
