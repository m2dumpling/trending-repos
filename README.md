# Trending Repos

[简体中文](README.zh-CN.md)

Trending Repos is a bilingual static site for discovering GitHub projects people are paying attention to. It has two boards:

- **Trending Repos** — active open-source projects across the GitHub ecosystem.
- **Trending AI Repos** — AI projects grouped by technical direction, including Agents, LLM Tools, MCP Servers, Coding Agents, RAG, Inference, Vector DB, Vibe Coding, and AI Assistants.

Live site: <https://m2dumpling.github.io/trending-repos/>

The site is designed for GitHub Pages. It does not depend on the original OSSInsight database or GitHub's public events feed. Existing OSSInsight collection files are used only as seed examples; live membership is discovered dynamically by this project.

## Data pipeline

The refresh job combines several public signals:

- GitHub repository search and REST metadata for current stars, forks, language, description, topics, and update time.
- Hacker News official API and HelloGitHub RSS/periodical pages for community attention outside GitHub.
- Hugging Face Hub model and Space metadata.
- npm, PyPI, and Docker Hub usage signals when a repository can be matched to a public package or image.

All sources are deduplicated by GitHub repository and normalized to comparable scores. The UI presents one **People are watching** ranking; each record keeps source labels, raw measurements, source URLs, and observation times.

AI classification is dynamic and deterministic. Topics, repository names, descriptions, and README evidence are matched against the versioned prototypes in `data/taxonomy.json`. A repository can receive multiple labels, while weak matches stay in `classificationCandidates` instead of entering the main AI board. No LLM call or manual review is required.

Daily snapshots are stored in `data/snapshots.json`. Once enough snapshots exist, 7-day and 28-day star/fork changes are available as supporting context. Current repository totals come from the GitHub REST API.

## Run locally

Requires Node.js 20+.

```text
npm run fetch
npm run build
npm run dev
```

Open <http://localhost:4173>. Without a GitHub token, local mode uses a smaller candidate set to avoid anonymous API limits. GitHub Actions automatically uses its `GITHUB_TOKEN` for the full refresh.

## Deploy to GitHub Pages

The repository workflow in `.github/workflows/deploy-pages.yml`:

- refreshes data every six hours;
- commits `data/repos.json` and `data/snapshots.json` to retain the trend baseline;
- builds and deploys the static site through GitHub Pages;
- redeploys when the UI, taxonomy, collection seeds, or fetch scripts change.

The repository must use GitHub Actions as its Pages source. The workflow uses the automatically provided `GITHUB_TOKEN`; no personal token is required for deployment.

## Extend the taxonomy

Add a category prototype to `data/taxonomy.json`:

```json
{
  "key": "ai-evaluation",
  "label": "AI Evaluation",
  "labelZh": "AI 评测",
  "discoveryTopics": ["llm-evaluation", "ai-evaluation"],
  "aliases": ["llm evaluation", "model evaluation"],
  "signals": [{ "term": "benchmark", "weight": 2.2 }],
  "threshold": 5.5,
  "sources": []
}
```

The prototype describes a direction rather than a fixed repository list. The next workflow run searches GitHub for new candidates and records explainable confidence and evidence fields.

## License

The application code is released under the Apache License 2.0. The seed collection files in `data/collections/` were copied from [pingcap/ossinsight](https://github.com/pingcap/ossinsight) and retain their original Apache-2.0 licensing. See [LICENSE](LICENSE).
