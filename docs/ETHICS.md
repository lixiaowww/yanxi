# 研析 Yanxi — 伦理与红线（ETHICS）

## 定位声明

研析是**民用、开源源、人在回路**的研究简报工具，用于公开中文材料的双语整理与语境解释。  
它**不是**情报机关系统、监听工具、或针对任何个人的监视产品。

## 硬红线（产品与演示）

1. 禁止在产品名、UI、README、演示话术中使用：SIGINT、仿 CSE/CSIS、espionage、spy tool、classified access、wiretap 等框架。  
2. 禁止指导或实现：未授权采集、撞库、绕过登录墙、针对加拿大人或在加人士的定向监视。  
2a. `canada_nexus` 仅为**读者关注关联**（明示加拿大 / 主题邻近），用于简报排序与 UI 凸显；**不是**对加拿大人的定向标记，禁止写成 targeting / watchlist。  
2b. `canada_policy_link` 仅为与**公开**加国政策/法规主题的对照提示（Justice Laws / 部门官网等），**不是法律意见**。  
2c. 社交转述（推特大 V、网传等）**默认不进白名单自动采集**；仅允许用户粘贴，且 `source_class=social_commentary` 时置信度硬封顶为 low，不得单独印证官方主张。  
3. 输入应为用户有权使用的**公开文本**（或用户自有文本）。  
6. 输出均为**草稿**，须人类审阅后方可外传。  
7. 语境卡是 **Civic Ontology Lite**（`docs/ONTOLOGY-LITE.md`）：`background` / `hypothesis` 背景层，**不是** OWL/知识图谱，不得冒充已证实的机密事实。  
8. `info_triage` 只做公开源**信息种类 + 研究优先级（P1–P4）**；禁止输出任何保密密级标记（TOP SECRET / 密级：绝密 等）。  
9. **自动采集**仅限 `config/sources.whitelist.json` 中的公开源；禁止登录墙绕过、大规模社媒抓取、针对个人。订阅投递（RSS/webhook/outbox）内容仍为**人审草稿**。

## 申请与社交

- 若用于职业申请材料：只描述民用能力（语言、研究、书面产品、门禁、公开源分诊、白名单订阅简报）。  
- 遵守目标雇主对申请保密的要求；勿在社交媒体讨论敏感申请细节。

## 门禁落地

代码中 `ethics-sandbox` skill + `gate.ts` 禁用框架词与密级标记检查，与本文档一致。采集见 `docs/COLLECT.md`。新增功能须先更新本文件。  
