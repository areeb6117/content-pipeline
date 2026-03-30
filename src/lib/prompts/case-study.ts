import { BRAND_CONTEXT } from "../context";
import type { ResearchArticle } from "../types";

export function caseStudyPrompt(article: ResearchArticle): string {
  return `${BRAND_CONTEXT}

## Task
Write a LinkedIn Case Study post based on this source article. Deep-dive into ONE specific company/event with a narrative arc.

## Source Article
Title: ${article.title}
Source: ${article.source}
Date: ${article.date}
Summary: ${article.summary}
Key Data: ${article.keyData}
URL: ${article.url}

## Case Study Format Structure
1. HOOK (1-2 lines): Lead with the most impressive metric or outcome
   Example: "Harvey just raised $200M at $11B valuation."
2. CONTEXT (2-3 lines): What problem existed. What the market looked like.
3. WHAT THEY DID (3-5 lines): The specific strategy, decision, or approach
   - Be specific: names, numbers, partners, timeline
4. RESULTS (2-3 lines): Concrete outcomes — revenue, valuation, growth metrics
5. LESSON (2-3 lines): "Here's what most people miss..." — the non-obvious takeaway
6. CTA: Question or Affitor mention

## Constraints
- Total length: 800-1500 characters
- Focus on ONE company/entity — depth over breadth
- Problem → Action → Result → Lesson arc
- Use specific numbers throughout
- Short paragraphs, narrative style
- Write in English only
- Include source link`;
}
