-- =============================================
-- HJ 1237-2021 刷题助手 - Supabase 数据库初始化
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本
-- =============================================

-- 1. 章节表
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 题目表
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('single', 'multiple', 'judgement', 'essay')),
  question TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  answer TEXT NOT NULL,
  explanation TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 用户进度表（按设备ID隔离）
CREATE TABLE IF NOT EXISTS user_progress (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  chapter_id TEXT DEFAULT '',
  is_practiced BOOLEAN DEFAULT false,
  is_wrong BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  is_mastered BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(device_id, question_id)
);

-- 4. 考试历史表
CREATE TABLE IF NOT EXISTS exam_history (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  score INT DEFAULT 0,
  total INT DEFAULT 0,
  correct INT DEFAULT 0,
  wrong INT DEFAULT 0,
  used_time TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 索引
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_progress_device ON user_progress(device_id);
CREATE INDEX IF NOT EXISTS idx_progress_device_question ON user_progress(device_id, question_id);
CREATE INDEX IF NOT EXISTS idx_exam_history_device ON exam_history(device_id);

-- 6. 启用 RLS
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_history ENABLE ROW LEVEL SECURITY;

-- 7. RLS 策略：章节和题目 - 所有人可读
CREATE POLICY "chapters_read" ON chapters FOR SELECT USING (true);
CREATE POLICY "chapters_write" ON chapters FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "questions_read" ON questions FOR SELECT USING (true);
CREATE POLICY "questions_write" ON questions FOR ALL USING (true) WITH CHECK (true);

-- 8. RLS 策略：用户进度 - 所有人可读写（按 device_id 在应用层过滤）
CREATE POLICY "progress_all" ON user_progress FOR ALL USING (true) WITH CHECK (true);

-- 9. RLS 策略：考试历史
CREATE POLICY "exam_history_all" ON exam_history FOR ALL USING (true) WITH CHECK (true);