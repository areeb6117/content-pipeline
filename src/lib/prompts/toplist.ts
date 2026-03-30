import { BRAND_CONTEXT } from "../context";
import type { ResearchArticle, PostLength, ContentLanguage } from "../types";
import { lengthGuide, buildContextSection, buildMultiPostNote, buildToneSection, buildLanguageSection } from "./shared";

export function toplistPrompt(
  article: ResearchArticle,
  length: PostLength = "medium",
  allArticles?: ResearchArticle[],
  postIndex?: number,
  totalPosts?: number,
  tone: string = "default",
  customTone?: string,
  language: ContentLanguage = "en"
): string {
  return `${BRAND_CONTEXT}

## Task
Write a LinkedIn Toplist post. Curate and present key items in a numbered list format.

${buildContextSection(article, allArticles)}${buildMultiPostNote(postIndex, totalPosts)}

${buildToneSection(tone, customTone)}

${buildLanguageSection(language)}

## Toplist Format Structure
1. HOOK (1-2 lines): Compelling stat or bold claim that stops the scroll
2. CONTEXT (2-3 lines): Why this matters right now
3. NUMBERED LIST: Each item has name + → key detail + metric when available
4. TAKEAWAY (2-3 lines): What pattern emerges, what it means
5. CTA: Engagement question OR soft Affitor mention

## Length
${lengthGuide[length]}

## Constraints
- Every item must have specific data
- Use numbered list (1, 2, 3...) with → for sub-details
- No generic filler
- ZERO asterisks (*) in output. No bold markdown. No ** anywhere. This is non-negotiable.
- No em dashes. No URLs. Plain text only.`;
}
