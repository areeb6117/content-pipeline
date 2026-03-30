"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import type { ResearchArticle, ContentFormat, GeneratedPost, PostLength, ContentLanguage, ResearchSource } from "@/lib/types";
import { POST_LENGTHS, TONE_PRESETS, RESEARCH_SOURCES } from "@/lib/types";

const STEPS = ["Research", "Select", "Format", "Write"] as const;
const FORMATS: { value: ContentFormat; label: string; icon: string; desc: string }[] = [
  { value: "toplist", label: "Toplist", icon: "📋", desc: "Numbered list with data" },
  { value: "pov", label: "POV", icon: "💡", desc: "Bold opinion backed by data" },
  { value: "case-study", label: "Case Study", icon: "🏢", desc: "Deep-dive one company" },
  { value: "how-to", label: "How-to", icon: "🛠️", desc: "Step-by-step guide" },
];

/* ── Shared sub-components ── */

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function Btn({ children, variant = "primary", disabled, onClick, className = "" }: {
  children: React.ReactNode; variant?: "primary" | "outline" | "ghost"; disabled?: boolean; onClick?: () => void; className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all h-9 px-4 disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-[--primary] text-white hover:bg-[--primary-hover]",
    outline: "border border-[--border-secondary] text-[--text-primary] hover:bg-[--bg-hover]",
    ghost: "text-[--text-brand] hover:bg-[--bg-brand]",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled} onClick={onClick}>{children}</button>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-[--border-primary] p-5 ${className}`}>{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-semibold text-[--text-primary] mb-3">{children}</div>;
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
        selected ? "bg-[--bg-brand] border-[--primary] text-[--text-brand]" : "bg-white border-[--border-primary] text-[--text-secondary] hover:border-[--border-tertiary]"
      }`}
    >{children}</button>
  );
}

/* ── Main pipeline ── */

export default function Pipeline() {
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState("");
  const [researchSource, setResearchSource] = useState<ResearchSource>("all");
  const [articles, setArticles] = useState<ResearchArticle[]>([]);
  const [format, setFormat] = useState<ContentFormat>("toplist");
  const [postLength, setPostLength] = useState<PostLength>("medium");
  const [outputCount, setOutputCount] = useState(1);
  const [tone, setTone] = useState("default");
  const [customTone, setCustomTone] = useState("");
  const [language, setLanguage] = useState<ContentLanguage>("en");
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writingIndex, setWritingIndex] = useState(-1);
  const [imageLoadingIds, setImageLoadingIds] = useState<Set<string>>(new Set());

  const selectedArticles = articles.filter((a) => a.selected);
  const cleanContent = (text: string) => text.replace(/\*\*/g, "").replace(/\*([^*]+)\*/g, "$1").replace(/—/g, "-");

  /* ── Handlers ── */

  const handleResearch = useCallback(async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, source: researchSource }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      setArticles(data.articles); setOutputCount(1); setStep(1);
    } catch (err) { setError(err instanceof Error ? err.message : "Research failed"); }
    finally { setLoading(false); }
  }, [topic, researchSource]);

  const toggleArticle = (id: string) => setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a)));
  const selectAll = () => setArticles((prev) => prev.map((a) => ({ ...a, selected: true })));
  const clearAll = () => setArticles((prev) => prev.map((a) => ({ ...a, selected: false })));

  const handleWrite = useCallback(async () => {
    const selected = articles.filter((a) => a.selected);
    if (selected.length === 0) return;
    setStep(3); setLoading(true); setError(null); setPosts([]);
    const count = Math.min(outputCount, selected.length);
    for (let i = 0; i < count; i++) {
      setWritingIndex(i);
      const primaryArticle = selected[i];
      const postId = `post-${Date.now()}-${i}`;
      setPosts((prev) => [...prev, { id: postId, articleId: primaryArticle.id, format, content: "", createdAt: new Date().toISOString() }]);
      try {
        const res = await fetch("/api/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ article: primaryArticle, format, length: postLength, allArticles: selected, postIndex: i, totalPosts: count, tone, customTone: tone === "custom" ? customTone : undefined, language }) });
        if (!res.ok) { const errData = await res.json(); throw new Error(errData.error || "Write failed"); }
        const reader = res.body?.getReader(); const decoder = new TextDecoder(); let buffer = "";
        if (reader) { let done = false; while (!done) { const { value, done: d } = await reader.read(); done = d; if (value) { buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || ""; for (const line of lines) { if (line.startsWith("data: ") && line !== "data: [DONE]") { try { const p = JSON.parse(line.slice(6)); if (p.text) setPosts((prev) => prev.map((po) => po.id === postId ? { ...po, content: po.content + p.text } : po)); } catch {} } } } }
          if (buffer.startsWith("data: ") && buffer !== "data: [DONE]") { try { const p = JSON.parse(buffer.slice(6)); if (p.text) setPosts((prev) => prev.map((po) => po.id === postId ? { ...po, content: po.content + p.text } : po)); } catch {} }
        }
      } catch (err) { setPosts((prev) => prev.map((p) => p.id === postId && !p.content ? { ...p, content: "[Error: failed to generate]" } : p)); setError(err instanceof Error ? err.message : "Write failed"); break; }
    }
    setWritingIndex(-1); setLoading(false);
  }, [articles, format, postLength, outputCount, tone, customTone, language]);

  const handleGenerateImage = useCallback(async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post || !post.content) return;
    setImageLoadingIds((prev) => new Set(prev).add(postId));
    try {
      const dataRes = await fetch("/api/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postContent: post.content, title: articles.find((a) => a.id === post.articleId)?.title || "", format: post.format }) });
      const dataJson = await dataRes.json(); if (!dataRes.ok) throw new Error(dataJson.error);
      const ogRes = await fetch("/api/og", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ infographic: dataJson.infographic }) });
      if (!ogRes.ok) throw new Error("Image render failed");
      const blob = await ogRes.blob(); const imageUrl = URL.createObjectURL(blob);
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, imageUrl, imageHtml: JSON.stringify(dataJson.infographic) } : p));
    } catch (err) { setError(err instanceof Error ? err.message : "Image generation failed"); }
    finally { setImageLoadingIds((prev) => { const next = new Set(prev); next.delete(postId); return next; }); }
  }, [posts, articles]);

  const copyPost = (content: string) => { navigator.clipboard.writeText(cleanContent(content)); };
  const downloadImage = (imageUrl: string, postId: string) => { const a = document.createElement("a"); a.href = imageUrl; a.download = `affitor-${postId}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(imageUrl); };

  /* ── Render ── */

  return (
    <div className="min-h-screen bg-[--bg-secondary]">
      {/* Header — 64px, white bg, bottom border */}
      <header className="h-16 bg-white border-b border-[--border-primary] sticky top-0 z-10">
        <div className="max-w-[960px] mx-auto px-6 h-full flex items-center gap-2.5">
          <Image src="/affitor-logo.svg" alt="Affitor" width={20} height={20} />
          <span className="text-sm font-semibold text-[--text-primary]">Affitor</span>
          <span className="text-sm font-semibold text-[--primary]">Content Pipeline</span>
        </div>
      </header>

      <div className="max-w-[960px] mx-auto px-6 py-5">
        {/* Step indicator */}
        <nav className="flex items-center gap-1.5 mb-5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <button
                onClick={() => i < step && !loading && setStep(i)}
                className={`h-8 px-3 rounded-lg text-[13px] font-medium transition-all flex items-center gap-1.5 ${
                  i === step ? "bg-[--primary] text-white"
                  : i < step && !loading ? "bg-[--bg-brand] text-[--text-brand] cursor-pointer hover:bg-blue-100"
                  : "bg-[--bg-tertiary] text-[--text-tertiary] cursor-default"
                }`}
              >{i + 1} {s}</button>
              {i < STEPS.length - 1 && <span className="text-[--text-tertiary] text-xs">→</span>}
            </div>
          ))}
        </nav>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-2.5 rounded-lg text-[13px] flex items-center justify-between bg-[--error-bg] text-[--error-text] border border-red-200">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-medium text-xs hover:underline ml-4">Dismiss</button>
          </div>
        )}

        {/* ══ Step 1: Research ══ */}
        {step === 0 && (
          <Card>
            <SectionLabel>Topic</SectionLabel>
            <input
              type="text" value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResearch()}
              placeholder='e.g. "AI startups funding rounds March 2026"'
              className="w-full h-10 rounded-lg border border-[--border-secondary] px-3 text-sm text-[--text-primary] placeholder:text-[--text-tertiary] outline-none focus:border-[--border-focus] focus:ring-2 focus:ring-[--border-focus] transition-all"
            />
            <div className="mt-4">
              <span className="text-xs font-medium text-[--text-secondary]">Source</span>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {RESEARCH_SOURCES.map((s) => (
                  <Chip key={s.value} selected={researchSource === s.value} onClick={() => setResearchSource(s.value)}>
                    {s.icon} {s.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="mt-5">
              <Btn onClick={handleResearch} disabled={loading || !topic.trim()}>
                {loading ? <><Spinner /> Researching...</> : "Research"}
              </Btn>
            </div>
          </Card>
        )}

        {/* ══ Step 2: Select ══ */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Articles Found</SectionLabel>
                <span className="text-xs text-[--text-tertiary]">{selectedArticles.length} selected</span>
              </div>
              <div className="flex gap-3 mb-3">
                <button onClick={selectAll} className="text-xs font-medium text-[--text-brand] hover:underline">Select all</button>
                <button onClick={clearAll} className="text-xs font-medium text-[--text-secondary] hover:underline">Clear</button>
              </div>
              <div className="space-y-1.5">
                {articles.map((article) => (
                  <div
                    key={article.id}
                    onClick={() => toggleArticle(article.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      article.selected
                        ? "border-[--primary] bg-[--bg-brand]"
                        : "border-[--border-primary] bg-white hover:shadow-[--shadow-sm] hover:border-[--border-secondary]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-4 h-4 mt-0.5 rounded flex-shrink-0 flex items-center justify-center text-[10px] ${
                        article.selected ? "bg-[--primary] text-white" : "border border-[--border-secondary] bg-white"
                      }`}>{article.selected ? "✓" : ""}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[--text-primary] leading-snug">{article.title}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[11px] font-medium text-[--text-brand]">{article.source}</span>
                          <span className="text-[11px] text-[--text-tertiary]">{article.date}</span>
                          {article.keyData === "News" && <span className="px-1.5 py-px rounded text-[10px] font-medium bg-[--warning-bg] text-[--warning-text]">NEWS</span>}
                          {article.tag && <span className="px-1.5 py-px rounded text-[10px] font-medium bg-[--info-bg] text-[--info-text]">{article.tag}</span>}
                        </div>
                        <p className="text-xs text-[--text-secondary] mt-1 line-clamp-2">{article.summary}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            {selectedArticles.length > 0 && (
              <Btn onClick={() => { setOutputCount((prev) => Math.min(prev, selectedArticles.length)); setStep(2); }}>
                Continue with {selectedArticles.length} article{selectedArticles.length > 1 ? "s" : ""} →
              </Btn>
            )}
          </div>
        )}

        {/* ══ Step 3: Format ══ */}
        {step === 2 && (
          <div className="space-y-4">
            <Card className="space-y-5">
              {/* Language + Format header */}
              <div className="flex items-center justify-between">
                <SectionLabel>Content Format</SectionLabel>
                <div className="flex rounded-lg overflow-hidden border border-[--border-secondary]">
                  {(["en", "vn"] as const).map((l) => (
                    <button key={l} onClick={() => setLanguage(l)}
                      className={`px-3 py-1.5 text-xs font-medium transition-all ${language === l ? "bg-[--primary] text-white" : "bg-white text-[--text-secondary] hover:bg-[--bg-hover]"}`}
                    >{l === "en" ? "🇺🇸 English" : "🇻🇳 Tiếng Việt"}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {FORMATS.map((f) => (
                  <button key={f.value} onClick={() => setFormat(f.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${format === f.value ? "border-[--primary] bg-[--bg-brand]" : "border-[--border-primary] bg-white hover:border-[--border-secondary]"}`}
                  >
                    <div className="text-lg">{f.icon}</div>
                    <div className="text-[13px] font-medium text-[--text-primary] mt-1">{f.label}</div>
                    <div className="text-[11px] text-[--text-tertiary] mt-0.5">{f.desc}</div>
                  </button>
                ))}
              </div>

              {/* Tone */}
              <div>
                <SectionLabel>Tone</SectionLabel>
                <div className="grid grid-cols-3 gap-2">
                  {TONE_PRESETS.map((t) => (
                    <button key={t.value} onClick={() => setTone(t.value)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${tone === t.value ? "border-[--primary] bg-[--bg-brand]" : "border-[--border-primary] bg-white hover:border-[--border-secondary]"}`}
                    >
                      <div className="text-xs font-medium text-[--text-primary]">{t.label}</div>
                      <div className="text-[11px] text-[--text-tertiary] mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
                {tone === "custom" && (
                  <textarea value={customTone} onChange={(e) => setCustomTone(e.target.value)}
                    placeholder="Describe your tone..."
                    className="mt-2 w-full rounded-lg border border-[--border-secondary] px-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-tertiary] outline-none focus:border-[--border-focus] min-h-[72px]"
                  />
                )}
              </div>

              {/* Length + Output */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <SectionLabel>Length</SectionLabel>
                  <div className="space-y-1.5">
                    {POST_LENGTHS.map((l) => (
                      <button key={l.value} onClick={() => setPostLength(l.value)}
                        className={`w-full p-2.5 rounded-lg border text-left transition-all flex justify-between items-center ${postLength === l.value ? "border-[--primary] bg-[--bg-brand]" : "border-[--border-primary] bg-white hover:border-[--border-secondary]"}`}
                      >
                        <span className="text-[13px] font-medium text-[--text-primary]">{l.label}</span>
                        <span className="text-xs text-[--text-brand]">{l.words}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <SectionLabel>Output Posts</SectionLabel>
                  <p className="text-xs text-[--text-secondary] mb-2">{selectedArticles.length} sources selected</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 5].filter(n => n <= selectedArticles.length).map((n) => (
                      <button key={n} onClick={() => setOutputCount(n)}
                        className={`flex-1 py-2.5 rounded-lg border text-center transition-all ${outputCount === n ? "border-[--primary] bg-[--bg-brand]" : "border-[--border-primary] bg-white hover:border-[--border-secondary]"}`}
                      >
                        <div className="text-base font-bold text-[--text-primary]">{n}</div>
                        <div className="text-[11px] text-[--text-tertiary]">post{n > 1 ? "s" : ""}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
            <Btn onClick={handleWrite} disabled={loading}>
              {loading ? <><Spinner /> Writing...</> : "Write with Claude"}
            </Btn>
          </div>
        )}

        {/* ══ Step 4: Output ══ */}
        {step === 3 && (
          <div className="space-y-4">
            {loading && writingIndex >= 0 && (
              <div className="flex items-center gap-2 text-[13px] text-[--text-brand]">
                <Spinner /> Writing post {writingIndex + 1} of {Math.min(outputCount, selectedArticles.length)}...
              </div>
            )}
            {posts.map((post, i) => {
              const article = articles.find((a) => a.id === post.articleId);
              const isImageLoading = imageLoadingIds.has(post.id);
              const hasContent = post.content && !post.content.startsWith("[Error:");
              return (
                <Card key={post.id}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[--bg-brand] text-[--text-brand] flex-shrink-0">Post {i + 1}</span>
                      {article && <span className="text-xs text-[--text-tertiary] truncate">{article.title}</span>}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Btn variant="outline" disabled={!hasContent} onClick={() => copyPost(post.content)} className="!h-7 !px-2.5 !text-xs">Copy</Btn>
                      {!post.imageUrl && !isImageLoading && (
                        <Btn variant="ghost" disabled={loading || !hasContent} onClick={() => handleGenerateImage(post.id)} className="!h-7 !px-2.5 !text-xs">Generate Image</Btn>
                      )}
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-[13px] leading-relaxed rounded-lg p-4 bg-[--bg-secondary] text-[--text-primary] max-h-[480px] overflow-y-auto">
                    {post.content ? cleanContent(post.content) : <span className="flex items-center gap-2 text-[--text-tertiary]"><Spinner /> Generating...</span>}
                  </div>
                  {isImageLoading && <div className="mt-3 flex items-center gap-2 text-xs text-[--text-brand]"><Spinner /> Generating infographic...</div>}
                  {post.imageUrl && (
                    <div className="mt-3">
                      <img src={post.imageUrl} alt="Infographic" className="rounded-lg max-w-[360px] border border-[--border-primary]" />
                      <Btn variant="outline" onClick={() => downloadImage(post.imageUrl!, post.id)} className="!h-7 !px-2.5 !text-xs mt-2">Download PNG</Btn>
                    </div>
                  )}
                </Card>
              );
            })}
            {!loading && posts.length > 0 && (
              <Btn variant="outline" onClick={() => { setStep(0); setPosts([]); setArticles([]); setTopic(""); setOutputCount(1); }}>
                ↻ Start New Pipeline
              </Btn>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
