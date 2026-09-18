export interface ParsedMentions {
  hasTeamMention: boolean;
  usernames: string[];
}

/**
 * Extracts mentions from note content.
 * Mentions must start with '@' preceded by whitespace, start of line, or common delimiters.
 * Emails such as test@example.com will not trigger mention extraction.
 */
export function parseMentions(content: string): ParsedMentions {
  if (!content) {
    return { hasTeamMention: false, usernames: [] };
  }

  // Regex matching @handle where @ is preceded by start of string, whitespace, or punctuation
  const mentionRegex = /(?:^|[\s(>])@([a-zA-Z0-9_.-]+)/g;
  let match: RegExpExecArray | null;

  let hasTeamMention = false;
  const usernameSet = new Set<string>();

  while ((match = mentionRegex.exec(content)) !== null) {
    const rawTag = match[1];
    // Clean trailing punctuation if any (like @alwin, or @alwin.)
    const cleanedTag = rawTag.replace(/[.,!?;:]+$/, '');
    if (!cleanedTag) continue;

    if (cleanedTag.toLowerCase() === 'team') {
      hasTeamMention = true;
    } else {
      usernameSet.add(cleanedTag.toLowerCase());
    }
  }

  return {
    hasTeamMention,
    usernames: Array.from(usernameSet),
  };
}
