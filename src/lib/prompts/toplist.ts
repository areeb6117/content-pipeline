import { BRAND_CONTEXT } from "../context";
import type { ResearchArticle } from "../types";

export function toplistPrompt(article: ResearchArticle): string {
  return `${BRAND_CONTEXT}

## Task
Write a LinkedIn Toplist post based on this source article. The post should curate and present key items from the source in a numbered list format.

## Source Article
Title: ${article.title}
Source: ${article.source}
Date: ${article.date}
Summary: ${article.summary}
Key Data: ${article.keyData}
URL: ${article.url}

## Toplist Format Structure
1. HOOK (1-2 lines): Start with a compelling stat or bold claim that stops the scroll
2. CONTEXT (2-3 lines): Why this matters right now, cite the source
3. NUMBERED LIST (5-10 items): Each item has:
   - Name/entity (company, tool, fund, etc.)
   - → Key detail or data point
   - Specific metric when available
4. TAKEAWAY (2-3 lines): What pattern emerges, what it means for the reader
5. CTA: Engagement question OR soft Affitor mention

## Constraints
- Total length: 1000-2000 characters
- Every item must have specific data from the source
- Use numbered list (1, 2, 3...) with → for sub-details
- No generic filler — every sentence adds value
- Write in English only
- Use Unicode bold for section emphasis where appropriate
- Include source attribution`;
}
