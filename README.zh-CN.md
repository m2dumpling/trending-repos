# Trending Repos

[English](README.md)

Trending Repos 是一个用于发现 GitHub 热门开源项目的双语静态网站，包含两个板块：

- **Trending Repos**：GitHub 开源项目榜单，覆盖各个技术领域。
- **Trending AI Repos**：AI 项目榜单，并按 AI 智能体、大模型工具、MCP 服务、编程智能体、RAG、模型推理、向量数据库、AI 编程、AI 助手等方向分类。

网站地址：<https://m2dumpling.github.io/trending-repos/>

网站可以直接部署到 GitHub Pages，不依赖原 OSSInsight 的数据库，也不读取 GitHub 公共 events feed。`data/collections/` 中的 OSSInsight 文件只作为种子样本，实际榜单成员由本项目动态发现。

## 数据来源与流程

刷新任务会综合多个公开来源：

- GitHub Search 和 REST API：获取当前 Star、Fork、语言、描述、Topics 以及更新时间。
- Hacker News 官方 API、HelloGitHub RSS 和期刊页面：补充 GitHub 之外的社区关注度。
- Hugging Face Hub：读取模型和 Space 的公开热度信息。
- npm、PyPI、Docker Hub：在能够与 GitHub 仓库准确对应时，补充公开包或镜像的使用信号。

所有来源都会按 GitHub 仓库去重，并转换成可比较的分数。页面只展示一个“大家都在关注”榜单，同时在数据中保留来源名称、原始数值、来源链接和观测时间。

AI 分类是动态且确定性的。系统根据 `data/taxonomy.json` 中的分类原型，匹配 Topics、仓库名、项目描述和 README 内容。一个项目可以同时属于多个方向；证据不足的匹配会保存在 `classificationCandidates` 中，不会直接进入 AI 主榜单。不调用 LLM，也不需要人工逐条审核。

每天的项目快照保存在 `data/snapshots.json` 中。积累足够快照后，页面还会显示 7 天和 28 天 Star/Fork 变化，作为辅助信息。项目当前总量来自 GitHub REST API。

## 本地运行

需要 Node.js 20 或更高版本：

```text
npm run fetch
npm run build
npm run dev
```

然后打开 <http://localhost:4173>。没有 GitHub Token 时，本地模式会减少候选数量，以避免匿名 API 限流；GitHub Actions 会自动使用 `GITHUB_TOKEN` 完整刷新数据。

## 部署到 GitHub Pages

`.github/workflows/deploy-pages.yml` 会：

- 每 6 小时刷新一次数据；
- 将 `data/repos.json` 和 `data/snapshots.json` 提交回仓库，保留趋势基线；
- 通过 GitHub Pages 构建并部署网站；
- 在前端、分类原型、种子配置或抓取脚本变化时重新部署。

仓库的 Pages 来源需要选择 GitHub Actions。部署使用 GitHub 自动提供的 `GITHUB_TOKEN`，不需要额外配置个人 Token。

## 扩展 AI 分类

在 `data/taxonomy.json` 中增加一个分类原型：

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

分类原型描述的是技术方向，不是固定项目名单。下一次工作流运行时，会自动搜索 GitHub 上的新候选项目，并记录可解释的匹配度和证据。

## 许可证

应用代码采用 Apache License 2.0。`data/collections/` 中的种子分类文件复制自 [pingcap/ossinsight](https://github.com/pingcap/ossinsight)，保留原项目的 Apache-2.0 许可。详见 [LICENSE](LICENSE)。
