/**
 * Minimal markdown renderer for the bundled legal documents. Handles:
 *   - `# / ## / ###` headings
 *   - `- ` / `* ` bullets
 *   - `> ` blockquotes
 *   - `**bold**` and `*italic*` inline emphasis
 *   - blank-line paragraph breaks
 *   - the leading `version: YYYY-MM-DD` metadata line (rendered as a
 *     small caption rather than treated as body text)
 *
 * No table support — the legal docs are written without tables now
 * that they're rendered in-app instead of on a static site.
 *
 * We deliberately don't pull in a markdown library: the docs are short
 * and the renderer needs to respect the design system's tokens (font
 * family resolves per-language, line-height matches the body variant)
 * which off-the-shelf libraries don't honour.
 */
import { Fragment } from 'react';
import { View } from 'react-native';

import { Stack, Text, useTokens } from '@/design';

interface LegalDocBodyProps {
  body: string;
}

interface Block {
  kind: 'heading' | 'paragraph' | 'list' | 'quote' | 'meta';
  level?: 1 | 2 | 3;
  lines: string[];
}

function tokenize(body: string): Block[] {
  const out: Block[] = [];
  const rawLines = body.split(/\r?\n/);
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    if (i === 0 && /^version:\s*/i.test(line)) {
      out.push({ kind: 'meta', lines: [line] });
      i += 1;
      continue;
    }
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) {
      const level = (line.match(/^(#{1,3})\s+/)?.[1].length ?? 1) as 1 | 2 | 3;
      out.push({ kind: 'heading', level, lines: [line.replace(/^#{1,3}\s+/, '')] });
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const lines: string[] = [];
      while (i < rawLines.length && /^>\s?/.test(rawLines[i])) {
        lines.push(rawLines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      out.push({ kind: 'quote', lines });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const lines: string[] = [];
      while (i < rawLines.length && /^\s*[-*]\s+/.test(rawLines[i])) {
        lines.push(rawLines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      out.push({ kind: 'list', lines });
      continue;
    }
    // Paragraph — accumulate non-blank lines that are NOT another block.
    const lines: string[] = [];
    while (
      i < rawLines.length &&
      rawLines[i].trim() !== '' &&
      !/^#{1,3}\s+/.test(rawLines[i]) &&
      !/^\s*[-*]\s+/.test(rawLines[i]) &&
      !/^>\s?/.test(rawLines[i])
    ) {
      lines.push(rawLines[i]);
      i += 1;
    }
    out.push({ kind: 'paragraph', lines });
  }
  return out;
}

interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

function parseInline(input: string): InlineSegment[] {
  // Walk left-to-right, peeling `**…**` first then `*…*`. Markdown
  // edge-cases (asterisks-in-words, escapes) are out of scope; the
  // legal doc text uses these conservatively.
  const segments: InlineSegment[] = [];
  let rest = input;
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/;
  while (rest.length > 0) {
    const match = rest.match(pattern);
    if (!match) {
      segments.push({ text: rest });
      break;
    }
    const before = rest.slice(0, match.index ?? 0);
    if (before.length > 0) segments.push({ text: before });
    if (match[2] !== undefined) segments.push({ text: match[2], bold: true });
    else if (match[3] !== undefined) segments.push({ text: match[3], italic: true });
    rest = rest.slice((match.index ?? 0) + match[0].length);
  }
  return segments;
}

function InlineText({ children }: { children: string }) {
  const segments = parseInline(children);
  return (
    <Text variant="body">
      {segments.map((s, i) => (
        <Text
          key={i}
          variant="body"
          style={{
            fontWeight: s.bold ? '700' : undefined,
            fontStyle: s.italic ? 'italic' : undefined,
          }}
        >
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

export function LegalDocBody({ body }: LegalDocBodyProps) {
  const { colors, spacing } = useTokens();
  const blocks = tokenize(body);
  return (
    <Stack gap="md">
      {blocks.map((block, idx) => {
        if (block.kind === 'meta') {
          return (
            <Text key={idx} variant="caption" color={colors.textMuted}>
              {block.lines[0]}
            </Text>
          );
        }
        if (block.kind === 'heading') {
          const variant =
            block.level === 1 ? 'headingLg' : block.level === 2 ? 'headingMd' : 'headingSm';
          return (
            <Text key={idx} variant={variant}>
              {block.lines.join(' ')}
            </Text>
          );
        }
        if (block.kind === 'quote') {
          return (
            <View
              key={idx}
              style={{
                borderLeftWidth: 3,
                borderLeftColor: colors.border,
                paddingLeft: spacing.md,
                paddingVertical: spacing.xs,
              }}
            >
              {block.lines.map((line, j) => (
                <InlineText key={j}>{line}</InlineText>
              ))}
            </View>
          );
        }
        if (block.kind === 'list') {
          return (
            <View key={idx} style={{ gap: spacing.xs }}>
              {block.lines.map((line, j) => (
                <View
                  key={j}
                  style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}
                >
                  <Text variant="body" color={colors.textMuted}>
                    •
                  </Text>
                  <View style={{ flex: 1 }}>
                    <InlineText>{line}</InlineText>
                  </View>
                </View>
              ))}
            </View>
          );
        }
        // paragraph
        return (
          <Fragment key={idx}>
            {block.lines.map((line, j) => (
              <InlineText key={j}>{line}</InlineText>
            ))}
          </Fragment>
        );
      })}
    </Stack>
  );
}
