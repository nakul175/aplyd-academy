// Renders a privacy notice stored as plain Markdown-like text (bold headings, "- " bullets, paragraphs) as HTML,
// without injecting markup. The trailing "Notice version: ..." line is dropped; the page shows the version itself.
export function NoticeText({ body }: { body: string }) {
  const blocks = body
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b && !/^Notice version:/i.test(b));
  return (
    <div>
      {blocks.map((b, i) => {
        const heading = b.match(/^\*\*(.+)\*\*$/);
        if (heading) return <h3 key={i}>{heading[1]}</h3>;
        const lines = b.split('\n');
        if (lines.every((l) => l.trim().startsWith('- ')))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{l.trim().slice(2)}</li>
              ))}
            </ul>
          );
        return <p key={i}>{b.replace(/\*\*/g, '')}</p>;
      })}
    </div>
  );
}
