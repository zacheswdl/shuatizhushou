CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_progress_device ON user_progress(device_id);
CREATE INDEX IF NOT EXISTS idx_progress_device_question ON user_progress(device_id, question_id);
CREATE INDEX IF NOT EXISTS idx_exam_history_device ON exam_history(device_id);

ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chapters_read" ON chapters FOR SELECT USING (true);
CREATE POLICY "chapters_write" ON chapters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "questions_read" ON questions FOR SELECT USING (true);
CREATE POLICY "questions_write" ON questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "progress_all" ON user_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "exam_history_all" ON exam_history FOR ALL USING (true) WITH CHECK (true);
