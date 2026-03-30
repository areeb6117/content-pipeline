import { BRAND_CONTEXT } from "../context";
import type { ResearchArticle, PostLength, ContentLanguage } from "../types";
import { lengthGuide, buildContextSection, buildMultiPostNote, buildToneSection, buildLanguageSection } from "./shared";

export function howToPrompt(
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
Write a LinkedIn How-to post. Teach the reader how to achieve a specific outcome with clear, actionable steps.

${buildContextSection(article, allArticles)}${buildMultiPostNote(postIndex, totalPosts)}

${buildToneSection(tone, customTone)}

${buildLanguageSection(language)}

## How-to Format Structure
1. HOOK (1-2 lines): Promise a clear outcome. "How to [achieve X] in [timeframe]" or "Most people get [X] wrong. Here is the right way."
2. WHY (2-3 lines): Why this matters, what most people get wrong, the cost of not doing it
3. STEPS (numbered, 3-7 steps): Each step has:
   - Clear action verb (Set up, Configure, Track, etc.)
   - Why it works (1 sentence)
   - Specific tool, metric, or example when relevant
4. PRO TIP (1-2 lines): One non-obvious shortcut or insight
5. RESULT (1-2 lines): What they will achieve if they follow these steps
6. CTA: "Try step 1 today" or engagement question

## Length
${lengthGuide[length]}

## Constraints
- Every step must be specific and actionable, not vague
- Use real tools, numbers, and examples
- Tone: practical, mentor-to-peer, not lecturing
- ZERO asterisks (*) in output. No bold markdown. No ** anywhere. This is non-negotiable.
- No em dashes. No URLs. Plain text only.`;
}
