import { BRAND_CONTEXT } from "../context";
import type { ResearchArticle, PostLength, ContentLanguage } from "../types";
import { lengthGuide, buildContextSection, buildMultiPostNote, buildToneSection, buildLanguageSection } from "./shared";

export function povPrompt(
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
Write a LinkedIn POV (Point of View / Hot Take) post. Argue a clear, opinionated perspective backed by data.

${buildContextSection(article, allArticles)}${buildMultiPostNote(postIndex, totalPosts)}

${buildToneSection(tone, customTone)}

${buildLanguageSection(language)}

## POV Format Structure
1. HOOK (1-2 lines): Contrarian or bold opening that challenges conventional wisdom
2. DATA (3-5 lines): Evidence with specific numbers, company names, dollar amounts
3. ANALYSIS (3-5 lines): What this actually means. Connect the dots.
4. PREDICTION/STANCE (2-3 lines): Take a clear position. Don't hedge.
5. CTA: Provocative question to drive comments

## Length
${lengthGuide[length]}

## Constraints
- Must argue ONE clear thesis, not a balanced overview
- Use specific data to support every claim
- Short paragraphs, 1-2 sentences each
- No bullet points for POV, this is narrative
- ZERO asterisks (*) in output. No bold markdown. No ** anywhere. This is non-negotiable.
- No em dashes. No URLs. Plain text only.`;
}
