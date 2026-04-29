# 刷题助手

## 项目介绍

刷题助手是一款专为公司内部员工备考练习设计的Web应用，无需登录即可在手机上直接使用。系统提供章节练习、模拟考试、错题本、收藏夹等功能，帮助员工高效备考。

## 功能特性

### 用户端功能
- **练习模式**：按章节选择题目进行练习，每答一题显示答案和解析，可标记掌握或收藏
- **模拟考试**：自定义题目数量，计时考试，自动评分，展示得分和解析
- **错题本**：自动收集答错的题目，方便集中复习
- **收藏夹**：手动收藏重要题目，集中复习
- **设置**：重置所有进度，管理个人设置

### 管理端功能
- **登录**：管理员账号密码登录
- **题库管理**：新增、编辑、删除题目，支持Word文件批量导入
- **章节管理**：新增、编辑、删除章节，设置章节排序

## 技术栈

- **前端**：React 19 + TypeScript + Vite + Ant Design
- **后端**：Express 5 + Node.js
- **数据库**：Supabase (PostgreSQL)
- **认证**：Supabase Auth（管理员登录）
- **存储**：Supabase Storage（图片存储）

## 安装步骤

### 1. 克隆项目

```bash
git clone <repository-url>
cd shuatizhushou
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置Supabase

在 [src/utils/supabase.ts](file:///Users/zacheswdl/Desktop/shuatizhushou/src/utils/supabase.ts) 文件中配置您的Supabase项目信息：

```typescript
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
```

### 4. 数据库初始化

在Supabase控制台执行以下SQL语句创建表结构：

```sql
-- 创建章节表
CREATE TABLE IF NOT EXISTS chapters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建题目表
CREATE TABLE IF NOT EXISTS questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chapter_id UUID REFERENCES chapters(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('single', 'multiple', 'judgement', 'essay')),
    question TEXT NOT NULL,
    options JSONB,
    answer TEXT NOT NULL,
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_questions_chapter_id ON questions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);

-- 插入初始数据
INSERT INTO chapters (name, "order") VALUES
('第一章 基础知识', 1),
('第二章 进阶知识', 2),
('第三章 高级知识', 3)
ON CONFLICT DO NOTHING;

-- 授予权限
GRANT SELECT ON chapters TO anon;
GRANT SELECT ON questions TO anon;
GRANT ALL PRIVILEGES ON chapters TO authenticated;
GRANT ALL PRIVILEGES ON questions TO authenticated;
```

### 5. 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:5173/ 启动。

### 6. 构建生产版本

```bash
npm run build
```

构建产物将生成在 `dist` 目录中。

## 使用说明

### 普通用户
1. 打开应用首页，选择需要的功能入口
2. **练习模式**：选择章节开始练习，每答一题后查看答案和解析，标记掌握或收藏
3. **模拟考试**：设置题目数量，开始考试，完成后查看得分和解析
4. **错题本**：查看和练习答错的题目，掌握后可移除
5. **收藏夹**：查看和管理收藏的题目
6. **设置**：重置所有进度

### 管理员
1. 访问 `/admin` 进入登录页面
2. 使用默认账号密码登录（用户名：admin，密码：admin123）
3. **题库管理**：新增、编辑、删除题目，支持Word文件批量导入
4. **章节管理**：新增、编辑、删除章节，设置章节排序

## 项目结构

```
shuatizhushou/
├── src/
│   ├── components/          # 组件
│   │   └── Layout/          # 布局组件
│   ├── pages/               # 页面
│   │   └── QuizAssistant/   # 刷题助手相关页面
│   │       ├── User/        # 用户端页面
│   │       └── Admin/       # 管理端页面
│   ├── utils/               # 工具函数
│   │   ├── storage.ts       # 本地存储工具
│   │   └── supabase.ts      # Supabase配置和类型定义
│   ├── App.tsx              # 应用主组件
│   └── main.tsx             # 应用入口
├── server/                  # 后端服务器
│   └── index.js             # 后端入口
├── dist/                    # 构建产物
├── .trae/documents/         # 项目文档
│   ├── PRD.md               # 产品需求文档
│   └── TechnicalArchitecture.md # 技术架构文档
├── package.json             # 项目配置
├── vite.config.ts           # Vite配置
└── tsconfig.json            # TypeScript配置
```

## 注意事项

1. 本应用使用浏览器本地存储记录用户进度，清除浏览器数据会导致进度丢失
2. 管理员账号密码应在生产环境中修改
3. 批量导入题目时，Word文件应按照指定格式编写
4. 题目和解析支持HTML格式，可添加图片等富文本内容

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系项目管理员。