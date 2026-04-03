// Log view — scrolling text of what happened
// The narrative of the voyage

interface Props {
  log: string[];
}

export function LogView({ log }: Props) {
  return (
    <div style={{
      minHeight: 120,
      maxHeight: 200,
      overflow: 'hidden',
      padding: '4px 0',
      fontSize: 12,
      lineHeight: 1.6,
    }}>
      {log.map((line, i) => (
        <div key={i} style={{
          color: i === log.length - 1 ? '#c8c0b0' : '#666',
        }}>
          {line}
        </div>
      ))}
    </div>
  );
}
