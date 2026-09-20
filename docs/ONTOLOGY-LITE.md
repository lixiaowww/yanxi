# Civic Ontology Lite（民用背景层）

Yanxi 的「本体」是一组**人工策展的 Markdown 语境卡**，不是 OWL、不是知识图谱、不是情报本体。

## 做什么

- 粘贴文本命中关键词 → 按**栏目亲和**排序 → 最多挂 **8** 张卡。
- 卡进入 `ontology_lite.hits`，并写入 `context_notes`（`background` / `hypothesis`）。
- 供 LLM/offline 组 prompt 时作**背景 gloss**，不得当作已证实机密事实。

## Frontmatter

| 字段 | 含义 |
|------|------|
| `name` | 卡 id |
| `type` | `institution` · `lexicon` · `history_frame` · `intl_compare` · `method` |
| `desk` | `all` 或栏目 id（可逗号多选） |
| `match` | `"关键词"` 列表 |
| `tag` | `background` 或 `hypothesis` |
| `updated` | YYYY-MM-DD |
| `sources` | 公开出处说明（一句话） |

## 匹配规则（`src/lib/ontology-lite.ts`）

1. 关键词子串命中才入选。  
2. 与 `desk_section.primary` 对齐的卡加分；`all` 卡弱加分。  
3. `method` 卡略优先（阅读方法）。  
4. 截断为最多 8 张；`framing: civilian-ontology-lite`。

## 不是什么

- 不是 SIGINT / 机构仿制 / 密级体系。  
- 不是自动「发现」新实体；扩卡靠人写 Markdown（见 `.cursor/skills/add-context-card`）。  
- 命中 ≠ 事件为真；只提供阅读框架。

## 相关

- 卡目录：`skills/context-cards/`  
- 伦理：`docs/ETHICS.md` §语境卡  
- UI：简报结果区「民用背景层」；Portfolio 可列目录摘要  
