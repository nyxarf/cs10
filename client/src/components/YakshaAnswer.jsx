import { FaRobot, FaBolt, FaThumbsUp, FaThumbsDown, FaStar } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';

export default function YakshaAnswer({ answer, sentiment, source, onHelpful, onNotHelpful }) {

  const renderFormattedAnswer = (text) => {
    if (!text) return null;

    // Split text by lines
    const lines = text.split('\n');
    let inList = false;
    let listItems = [];
    const elements = [];

    const flushList = (key) => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${key}`} style={{
            paddingLeft: '1.5rem',
            margin: '0.75rem 0 1.25rem 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            {listItems}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const parseInlineStyles = (lineText) => {
      // Parse bold text **key term**
      const parts = [];
      let lastIndex = 0;
      const regex = /\*\*(.*?)\*\*/g;
      let match;

      while ((match = regex.exec(lineText)) !== null) {
        const matchIndex = match.index;
        // Text before the match
        if (matchIndex > lastIndex) {
          parts.push(lineText.substring(lastIndex, matchIndex));
        }
        // Bold text
        parts.push(
          <strong key={`bold-${matchIndex}`} style={{
            color: 'var(--accent-primary-light)',
            fontWeight: 700
          }}>
            {match[1]}
          </strong>
        );
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < lineText.length) {
        parts.push(lineText.substring(lastIndex));
      }

      return parts.length > 0 ? parts : lineText;
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // 1. Check for headings
      if (trimmedLine.startsWith('###')) {
        flushList(index);
        const headingText = trimmedLine.replace(/^###\s*/, '');
        elements.push(
          <h4 key={`heading-${index}`} style={{
            fontSize: '1.15rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: '1.5rem',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            paddingBottom: '0.4rem'
          }}>
            <span style={{ color: 'var(--accent-secondary)', display: 'flex' }}><HiSparkles /></span>
            {parseInlineStyles(headingText)}
          </h4>
        );
      }
      // 2. Check for bullet list items
      else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        inList = true;
        const itemText = trimmedLine.replace(/^[-*]\s*/, '');
        listItems.push(
          <li key={`li-${index}`} style={{
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            listStyleType: 'disc'
          }}>
            {parseInlineStyles(itemText)}
          </li>
        );
      }
      // 3. Check for numbered list items
      else if (/^\d+\.\s+/.test(trimmedLine)) {
        inList = true;
        const itemText = trimmedLine.replace(/^\d+\.\s+/, '');
        listItems.push(
          <li key={`li-${index}`} style={{
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            listStyleType: 'decimal'
          }}>
            {parseInlineStyles(itemText)}
          </li>
        );
      }
      // 4. Regular line or blank line
      else {
        if (trimmedLine === '') {
          flushList(index);
        } else {
          if (inList) {
            flushList(index);
          }
          elements.push(
            <p key={`p-${index}`} style={{
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.7
            }}>
              {parseInlineStyles(trimmedLine)}
            </p>
          );
        }
      }
    });

    flushList('final');
    return elements;
  };

  return (
    <div className="card slide-up" style={{ marginTop: '1.5rem', border: '1px solid var(--border-active)' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <FaRobot /> Yaksha Answer
        </h3>
        <span className={`badge ${source === 'cache' ? 'badge-info' : 'badge-primary'}`}>
          {source === 'cache'
            ? <><HiSparkles style={{ marginRight: '0.25rem' }} /> Cache Direct</>
            : <><FaBolt style={{ marginRight: '0.25rem' }} /> Live Synthesized</>}
        </span>
      </div>

      {showEmpathy && (
        <div className="empathy-message" style={{
          background: 'rgba(245, 158, 11, 0.08)',
          borderLeft: '4px solid var(--accent-warning)',
          padding: '0.75rem 1rem',
          fontSize: '0.9rem',
          color: 'var(--accent-warning)',
          marginBottom: '1rem',
          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
        }}>
          <FaStar style={{ color: '#f59e0b', marginRight: '0.4rem' }} /> We understand this can be confusing — here's what we found:
        </div>
      )}

      <div style={{
        fontSize: '0.975rem',
        padding: '1.25rem',
        background: 'var(--bg-glass)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '1.5rem',
        border: '1px solid var(--border-color)'
      }}>
        {renderFormattedAnswer(answer)}
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button className="btn btn-success" onClick={onHelpful} style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <FaThumbsUp /> Yes, this helped
        </button>
        <button className="btn btn-secondary" onClick={onNotHelpful} style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <FaThumbsDown /> No, I need more help
        </button>
      </div>
    </div>
  );
}
