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

  const handleResearch = useCallback(async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, source: researchSource }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      setArticles(data.articles);
      setOutputCount(1);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  }, [topic, researchSource]);

  const toggleArticle = (id: string) => {
    setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a)));
  };
  const selectAll = () => setArticles((prev) => prev.map((a) => ({ ...a, selected: true })));
  const clearAll = () => setArticles((prev) => prev.map((a) => ({ ...a, selected: false })));

  const handleWrite = useCallback(async () => {
    const selected = articles.filter((a) => a.selected);
    if (selected.length === 0) return;
    setStep(3);
    setLoading(true);
    setError(null);
    setPosts([]);
    const count = Math.min(outputCount, selected.length);

    for (let i = 0; i < count; i++) {
      setWritingIndex(i);
      const primaryArticle = selected[i];
      const postId = `post-${Date.now()}-${i}`;
      setPosts((prev) => [...prev, { id: postId, articleId: primaryArticle.id, format, content: "", createdAt: new Date().toISOString() }]);

      try {
        const res = await fetch("/api/write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            article: primaryArticle, format, length: postLength, allArticles: selected,
            postIndex: i, totalPosts: count, tone,
            customTone: tone === "custom" ? customTone : undefined, language,
          }),
        });
        if (!res.ok) { const errData = await res.json(); throw new Error(errData.error || "Write failed"); }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        if (reader) {
          let done = false;
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              for (const line of lines) {
                if (line.startsWith("data: ") && line !== "data: [DONE]") {
                  try { const p = JSON.parse(line.slice(6)); if (p.text) setPosts((prev) => prev.map((po) => po.id === postId ? { ...po, content: po.content + p.text } : po)); } catch { /* skip */ }
                }
              }
            }
          }
          if (buffer.startsWith("data: ") && buffer !== "data: [DONE]") {
            try { const p = JSON.parse(buffer.slice(6)); if (p.text) setPosts((prev) => prev.map((po) => po.id === postId ? { ...po, content: po.content + p.text } : po)); } catch { /* skip */ }
          }
        }
      } catch (err) {
        setPosts((prev) => prev.map((p) => p.id === postId && !p.content ? { ...p, content: "[Error: failed to generate]" } : p));
        setError(err instanceof Error ? err.message : "Write failed");
        break;
      }
    }
    setWritingIndex(-1);
    setLoading(false);
  }, [articles, format, postLength, outputCount, tone, customTone, language]);

  const handleGenerateImage = useCallback(async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post || !post.content) return;
    setImageLoadingIds((prev) => new Set(prev).add(postId));
    try {
      const dataRes = await fetch("/api/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postContent: post.content, title: articles.find((a) => a.id === post.articleId)?.title || "", format: post.format }) });
      const dataJson = await dataRes.json();
      if (!dataRes.ok) throw new Error(dataJson.error);
      const ogRes = await fetch("/api/og", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ infographic: dataJson.infographic }) });
      if (!ogRes.ok) throw new Error("Image render failed");
      const blob = await ogRes.blob();
      const imageUrl = URL.createObjectURL(blob);
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, imageUrl, imageHtml: JSON.stringify(dataJson.infographic) } : p));
    } catch (err) { setError(err instanceof Error ? err.message : "Image generation failed"); }
    finally { setImageLoadingIds((prev) => { const next = new Set(prev); next.delete(postId); return next; }); }
  }, [posts, articles]);

  // Strip markdown artifacts that Claude sometimes outputs despite instructions
  const cleanContent = (text: string) => text.replace(/\*\*/g, "").replace(/\*([^*]+)\*/g, "$1").replace(/—/g, "-");

  const copyPost = (content: string) => { navigator.clipboard.writeText(cleanContent(content)); };
  const downloadImage = (imageUrl: string, postId: string) => {
    const a = document.createElement("a"); a.href = imageUrl; a.download = `affitor-${postId}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(imageUrl);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-secondary)" }}>
      {/* Header */}
      <header className="bg-white border-b" style={{ borderColor: "var(--border-primary)", height: 64 }}>
        <div className="max-w-5xl mx-auto px-6 h-full flex items-center gap-3">
          <Image src="/affitor-logo.svg" alt="Affitor" width={20} height={20} />
          <div className="flex items-baseline gap-2">
            <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Affitor</h1>
            <span className="text-base font-semibold" style={{ color: "var(--primary)" }}>Content Pipeline</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Steps */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => i < step && !loading && setStep(i)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{
                  background: i === step ? "var(--primary)" : i < step && !loading ? "var(--bg-brand)" : "var(--bg-tertiary)",
                  color: i === step ? "var(--text-inverse)" : i < step ? "var(--text-brand)" : "var(--text-tertiary)",
                  cursor: i < step && !loading ? "pointer" : "default",
                }}
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{
                  background: i === step ? "rgba(255,255,255,0.2)" : "transparent",
                }}>{i + 1}</span>
                {s}
              </button>
              {i < STEPS.length - 1 && <span style={{ color: "var(--text-tertiary)" }}>→</span>}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between" style={{ background: "var(--error-bg)", color: "var(--error-text)", border: "1px solid #FECACA" }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-3 font-medium hover:underline">Dismiss</button>
          </div>
        )}

        {/* Step 1: Research */}
        {step === 0 && (
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "var(--border-primary)" }}>
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResearch()}
              placeholder='e.g. "AI startups funding rounds March 2026"'
              className="mt-2 w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
              style={{ border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
              onFocus={(e) => e.target.style.borderColor = "var(--border-focus)"}
              onBlur={(e) => e.target.style.borderColor = "var(--border-secondary)"}
            />
            <div className="mt-3">
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Source</span>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {RESEARCH_SOURCES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setResearchSource(s.value)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                    style={{
                      background: researchSource === s.value ? "var(--bg-brand)" : "var(--bg-secondary)",
                      color: researchSource === s.value ? "var(--text-brand)" : "var(--text-secondary)",
                      border: `1px solid ${researchSource === s.value ? "var(--primary)" : "var(--border-primary)"}`,
                    }}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleResearch}
              disabled={loading || !topic.trim()}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: "var(--primary)", color: "var(--text-inverse)" }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "var(--primary-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--primary)")}
            >
              {loading ? <span className="flex items-center gap-2"><Spinner />Researching...</span> : "Research"}
            </button>
          </div>
        )}

        {/* Step 2: Select */}
        {step === 1 && (
          <div>
            <div className="bg-white rounded-lg border p-5" style={{ borderColor: "var(--border-primary)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Articles Found</span>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{selectedArticles.length} selected</span>
              </div>
              <div className="flex gap-3 mb-3">
                <button onClick={selectAll} className="text-xs font-medium" style={{ color: "var(--text-brand)" }}>Select all</button>
                <button onClick={clearAll} className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Clear</button>
              </div>
              <div className="space-y-2">
                {articles.map((article) => (
                  <div
                    key={article.id}
                    onClick={() => toggleArticle(article.id)}
                    className="p-3 rounded-lg border cursor-pointer transition-all"
                    style={{
                      borderColor: article.selected ? "var(--primary)" : "var(--border-primary)",
                      background: article.selected ? "var(--bg-brand)" : "var(--bg-primary)",
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-4 h-4 mt-0.5 rounded flex items-center justify-center text-xs flex-shrink-0" style={{
                        background: article.selected ? "var(--primary)" : "var(--bg-tertiary)",
                        color: article.selected ? "white" : "transparent",
                      }}>✓</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{article.title}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-xs font-medium" style={{ color: "var(--text-brand)" }}>{article.source}</span>
                          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{article.date}</span>
                          {article.keyData === "News" && (
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ background: "var(--warning-bg)", color: "var(--warning-text)" }}>NEWS</span>
                          )}
                          {article.tag && (
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ background: "var(--info-bg)", color: "var(--info-text)" }}>{article.tag}</span>
                          )}
                        </div>
                        <p className="text-xs mt-1.5 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{article.summary}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {selectedArticles.length > 0 && (
              <button
                onClick={() => { setOutputCount((prev) => Math.min(prev, selectedArticles.length)); setStep(2); }}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--primary)", color: "var(--text-inverse)" }}
              >
                Continue with {selectedArticles.length} article{selectedArticles.length > 1 ? "s" : ""} →
              </button>
            )}
          </div>
        )}

        {/* Step 3: Format */}
        {step === 2 && (
          <div>
            <div className="bg-white rounded-lg border p-5 space-y-5" style={{ borderColor: "var(--border-primary)" }}>
              {/* Language */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Content Format</span>
                <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-secondary)" }}>
                  {(["en", "vn"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLanguage(l)}
                      className="px-3 py-1.5 text-xs font-medium transition-all"
                      style={{
                        background: language === l ? "var(--primary)" : "var(--bg-primary)",
                        color: language === l ? "white" : "var(--text-secondary)",
                      }}
                    >
                      {l === "en" ? "🇺🇸 English" : "🇻🇳 Tiếng Việt"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Formats */}
              <div className="grid grid-cols-4 gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className="p-3 rounded-lg border text-left transition-all"
                    style={{
                      borderColor: format === f.value ? "var(--primary)" : "var(--border-primary)",
                      background: format === f.value ? "var(--bg-brand)" : "var(--bg-primary)",
                    }}
                  >
                    <div className="text-lg mb-1">{f.icon}</div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{f.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{f.desc}</div>
                  </button>
                ))}
              </div>

              {/* Tone */}
              <div>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Tone</span>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {TONE_PRESETS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      className="p-2.5 rounded-lg border text-left transition-all"
                      style={{
                        borderColor: tone === t.value ? "var(--primary)" : "var(--border-primary)",
                        background: tone === t.value ? "var(--bg-brand)" : "var(--bg-primary)",
                      }}
                    >
                      <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{t.label}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
                {tone === "custom" && (
                  <textarea
                    value={customTone}
                    onChange={(e) => setCustomTone(e.target.value)}
                    placeholder="Describe your tone..."
                    className="mt-2 w-full rounded-lg px-3 py-2 text-sm outline-none min-h-[72px]"
                    style={{ border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
                  />
                )}
              </div>

              {/* Length + Output */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Length</span>
                  <div className="space-y-1.5 mt-2">
                    {POST_LENGTHS.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => setPostLength(l.value)}
                        className="w-full p-2.5 rounded-lg border text-left transition-all flex justify-between items-center"
                        style={{
                          borderColor: postLength === l.value ? "var(--primary)" : "var(--border-primary)",
                          background: postLength === l.value ? "var(--bg-brand)" : "var(--bg-primary)",
                        }}
                      >
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{l.label}</span>
                        <span className="text-xs" style={{ color: "var(--text-brand)" }}>{l.words}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Output Posts</span>
                  <p className="text-xs mt-1 mb-2" style={{ color: "var(--text-secondary)" }}>
                    {selectedArticles.length} sources selected
                  </p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 5].filter(n => n <= selectedArticles.length).map((n) => (
                      <button
                        key={n}
                        onClick={() => setOutputCount(n)}
                        className="flex-1 py-3 rounded-lg border text-center transition-all"
                        style={{
                          borderColor: outputCount === n ? "var(--primary)" : "var(--border-primary)",
                          background: outputCount === n ? "var(--bg-brand)" : "var(--bg-primary)",
                        }}
                      >
                        <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{n}</div>
                        <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>post{n > 1 ? "s" : ""}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleWrite}
              disabled={loading}
              className="mt-4 px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: "var(--primary)", color: "var(--text-inverse)" }}
            >
              {loading ? <span className="flex items-center gap-2"><Spinner />Writing...</span> : "Write with Claude"}
            </button>
          </div>
        )}

        {/* Step 4: Output */}
        {step === 3 && (
          <div className="space-y-4">
            {loading && writingIndex >= 0 && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-brand)" }}>
                <Spinner /> Writing post {writingIndex + 1} of {Math.min(outputCount, selectedArticles.length)}...
              </div>
            )}
            {posts.map((post, i) => {
              const article = articles.find((a) => a.id === post.articleId);
              const isImageLoading = imageLoadingIds.has(post.id);
              const hasContent = post.content && !post.content.startsWith("[Error:");
              return (
                <div key={post.id} className="bg-white rounded-lg border p-5" style={{ borderColor: "var(--border-primary)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: "var(--bg-brand)", color: "var(--text-brand)" }}>Post {i + 1}</span>
                      {article && <span className="text-xs truncate max-w-[300px]" style={{ color: "var(--text-tertiary)" }}>{article.title}</span>}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => copyPost(post.content)}
                        disabled={!hasContent}
                        className="px-2.5 py-1 rounded-md text-xs font-medium transition-all disabled:opacity-30"
                        style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}
                      >
                        Copy
                      </button>
                      {!post.imageUrl && !isImageLoading && (
                        <button
                          onClick={() => handleGenerateImage(post.id)}
                          disabled={loading || !hasContent}
                          className="px-2.5 py-1 rounded-md text-xs font-medium transition-all disabled:opacity-30"
                          style={{ background: "var(--bg-brand)", color: "var(--text-brand)", border: "1px solid var(--primary)" }}
                        >
                          Generate Image
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed rounded-lg p-4" style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}>
                    {post.content ? cleanContent(post.content) : <span className="flex items-center gap-2" style={{ color: "var(--text-tertiary)" }}><Spinner /> Generating...</span>}
                  </div>
                  {isImageLoading && (
                    <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--text-brand)" }}><Spinner /> Generating infographic...</div>
                  )}
                  {post.imageUrl && (
                    <div className="mt-3">
                      <img src={post.imageUrl} alt="Infographic" className="rounded-lg max-w-[360px]" style={{ border: "1px solid var(--border-primary)" }} />
                      <button
                        onClick={() => downloadImage(post.imageUrl!, post.id)}
                        className="mt-2 px-2.5 py-1 rounded-md text-xs font-medium"
                        style={{ background: "var(--success-bg)", color: "var(--success-text)", border: "1px solid #A7F3D0" }}
                      >
                        Download PNG
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {!loading && posts.length > 0 && (
              <button
                onClick={() => { setStep(0); setPosts([]); setArticles([]); setTopic(""); setOutputCount(1); }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}
              >
                ↻ Start New Pipeline
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
