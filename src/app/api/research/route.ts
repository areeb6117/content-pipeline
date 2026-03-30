import { NextRequest, NextResponse } from "next/server";
import type { ResearchArticle } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json();

    if (!topic || typeof topic !== "string") {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!braveApiKey) {
      return NextResponse.json(
        { error: "Brave Search API key not configured" },
        { status: 500 }
      );
    }

    // Step 1: Search with Brave
    const searchUrl = new URL("https://api.search.brave.com/res/v1/web/search");
    searchUrl.searchParams.set("q", topic);
    searchUrl.searchParams.set("count", "15");
    searchUrl.searchParams.set("freshness", "pm"); // past month
    searchUrl.searchParams.set("text_decorations", "false");

    const searchRes = await fetch(searchUrl.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": braveApiKey,
      },
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      return NextResponse.json(
        { error: `Brave Search failed: ${searchRes.status} ${errText}` },
        { status: 502 }
      );
    }

    const searchData = await searchRes.json();
    const webResults = searchData.web?.results || [];

    // Step 2: Use Claude to extract structured articles from search results
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json(
        { error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const resultsText = webResults
      .map(
        (r: { title: string; url: string; description: string; age?: string; page_age?: string }, i: number) =>
          `${i + 1}. Title: ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.description}\n   Age: ${r.age || r.page_age || "unknown"}`
      )
      .join("\n\n");

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2024-01-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `You are a research assistant for a LinkedIn content creator focused on AI, SaaS, startups, and venture capital.

Given these search results for the topic "${topic}", extract and structure them into articles suitable for LinkedIn content creation.

## Search Results
${resultsText}

## Instructions
- Extract 8-15 most relevant articles
- For each article, identify the key data point or insight that would make compelling LinkedIn content
- Prioritize articles with: specific numbers/metrics, named companies, recent funding rounds, market trends
- Skip generic or irrelevant results

## Output Format
Return ONLY a valid JSON array. No markdown, no explanation. Each object:
[
  {
    "id": "unique-id",
    "title": "Article title",
    "source": "Publication name (e.g., TechCrunch, Forbes)",
    "url": "https://...",
    "date": "YYYY-MM-DD or approximate",
    "summary": "2-3 sentence summary of the article",
    "keyData": "The single most compelling data point or insight"
  }
]`,
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      return NextResponse.json(
        { error: `Claude API failed: ${claudeRes.status} ${errText}` },
        { status: 502 }
      );
    }

    const claudeData = await claudeRes.json();
    const text =
      claudeData.content?.[0]?.text || "[]";

    // Parse the JSON from Claude's response
    let articles: ResearchArticle[];
    try {
      // Extract JSON array from response (handle potential markdown wrapping)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      articles = parsed.map((a: ResearchArticle) => ({
        ...a,
        selected: false,
      }));
    } catch {
      return NextResponse.json(
        { error: "Failed to parse research results", raw: text },
        { status: 500 }
      );
    }

    return NextResponse.json({ articles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Research failed" },
      { status: 500 }
    );
  }
}
