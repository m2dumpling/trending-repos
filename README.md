# OSSInsight Revival · AI Repo Pulse

一个可以直接部署到 GitHub Pages 的双语静态站点，只有两个板块：

- Trending Repos：近期活跃、具有一定社区规模的 GitHub 开源仓库
- Trending AI Repos：AI Agents、LLM Tools、MCP Servers、Coding Agents、RAG、Inference、Vector DB、Vibe Coding、AI Assistants 等技术分类

页面提供 English / 中文切换。数据不依赖原 OSSInsight 的数据库，也不读取 GitHub 公共 events feed。

本项目的 data/collections/ 下的种子配置复制自 [pingcap/ossinsight](https://github.com/pingcap/ossinsight)，遵循 Apache-2.0 许可；具体版权条款见 LICENSE。分类成员会由本项目自己的 GitHub 搜索流程动态发现。

数据源分为两阶段：

- 第一阶段：GitHub 仓库信息和搜索、Hacker News 官方 API、HelloGitHub RSS/期刊页面。
- 第二阶段：Hugging Face Hub，以及从仓库 package.json、pyproject.toml 和公开 README 自动识别的 npm、PyPI、Docker Hub 使用信号。

所有来源会先按 GitHub 仓库去重，再分别归一化为 0–100 分。页面只展示一个“大家都在关注”的榜单，但每个项目的 JSON 数据会保留来源、原始值、来源链接和更新时间。

## 数据逻辑

1. Trending Repos 使用 GitHub Search API 发现近期活跃和受到关注的仓库，并用 Hacker News、HelloGitHub 等来源补充社区关注度。
2. Trending AI Repos 按 taxonomy.json 中的 Topics、别名和语义信号，在 GitHub 全局搜索候选项目；data/collections/ 只作为种子样本。
3. 对 AI 候选读取仓库元数据、Topics 和 README，使用多标签、可解释的确定性证据评分，而不是固定仓库名单；不调用 LLM，也不需要人工逐条审核。
4. scripts/fetch-trending.mjs 通过 GitHub repository API 读取当前的 stargazers_count、forks、语言、描述和更新时间。
5. 每次运行会把当前总量写入 data/snapshots.json。
6. 页面展示一个综合关注度，并保留 7 天 / 28 天增长作为辅助信息；关注度以 GitHub 为基础，再融合不同来源的归一化分数和来源覆盖数。

首次运行只有当前总量，没有增长基线。第二次及之后的每日运行才会出现增长数据。

### 热度分数

- 当前关注度综合 Star 总量、Fork 总量和最近更新时间。
- 7 天 / 28 天增长作为辅助信息，帮助判断关注度变化。
- 所有数值经过对数缩放和上限限制，避免超大仓库完全吞没其他项目。
- 分类使用 Topics、仓库名、描述和 README 的确定性证据评分；低证据分类保留在 classificationCandidates，不进入主 AI 榜单。

## 本地运行

需要 Node.js 20+。首次运行：

~~~text
npm run fetch
npm run build
npm run dev
~~~

然后打开 http://localhost:4173。如果没有 GitHub Token，本地模式会以均衡方式抓取一小部分 AI 仓库，避免触发匿名 API 限流；GitHub Actions 会自动使用 GITHUB_TOKEN 抓取完整集合。

## 部署到 GitHub Pages

把 ossinsight-revival 文件夹作为一个新的 GitHub 仓库根目录推送，然后在仓库 Settings → Pages 中选择 GitHub Actions。/.github/workflows/deploy-pages.yml 会：

- 每 6 小时刷新一次 GitHub 数据；
- 将 data/repos.json 和 data/snapshots.json 提交回仓库，保留趋势基线；
- 构建并部署 dist/ 到 GitHub Pages；
- 在代码、分类文件变化时自动重新部署。

工作流使用 GitHub 自动提供的 GITHUB_TOKEN，不需要额外的个人 Token。若仓库组织策略禁止 Actions 写入内容，请在 Settings → Actions → General 中允许 workflow 写入仓库，或手动提交生成的数据。

## 动态分类

在 data/taxonomy.json 中增加分类原型：

~~~json
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
~~~

分类原型描述方向，不包含完整仓库名单。下一次 workflow 会从 GitHub 发现新项目；分类结果会保留 confidence、method 和 evidence 字段。低证据候选会单独保留，不进入主 AI 榜单，避免为了召回率牺牲准确率。
