export interface ResearchArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  date: string;
  summary: string;
  keyData: string;
  selected: boolean;
}

export type ContentFormat = "toplist" | "pov" | "case-study";

export interface GeneratedPost {
  id: string;
  articleId: string;
  format: ContentFormat;
  content: string;
  imageHtml?: string;
  imageUrl?: string;
  createdAt: string;
}

export interface PipelineSession {
  id: string;
  topic: string;
  articles: ResearchArticle[];
  selectedArticleIds: string[];
  format: ContentFormat;
  posts: GeneratedPost[];
  createdAt: string;
}
