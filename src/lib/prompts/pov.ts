import { BRAND_CONTEXT } from "../context";
import type { ResearchArticle } from "../types";

export function povPrompt(article: ResearchArticle): string {
  return `${BRAND_CONTEXT}

## Task
Write a LinkedIn POV (Point of View / Hot Take) post based on this source article. The post should argue a clear, opinionated perspective backed by data.

## Source Article
Title: ${article.title}
Source: ${article.source}
Date: ${article.date}
Summary: ${article.summary}
Key Data: ${article.keyData}
URL: ${article.url}

## POV Format Structure
1. HOOK (1-2 lines): Contrarian or bold opening statement that challenges conventional wisdom
2. DATA (3-5 lines): Present the evidence — specific numbers, company names, dollar amounts
3. ANALYSIS (3-5 lines): What this actually means. Connect the dots others are missing.
   Structure as "If you're [role]: [insight]" or "What this means for [audience]:"
4. PREDICTION/STANCE (2-3 lines): Take a clear position. "This is the new reality." Don't hedge.
5. CTA: Provocative question to drive comments

## Constraints
- Total length: 800-1500 characters
- Must argue ONE clear thesis — not a balanced overview
- Use specific data to support every claim
- Tone: Confident, direct, slightly provocative
- Short paragraphs — 1-2 sentences each
- No bullet points — this is narrative, not a list
- Write in English only
- No infographic needed for POV — text-only performs best`;
}
