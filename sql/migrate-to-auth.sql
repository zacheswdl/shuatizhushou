-- =============================================
-- 从设备激活码模式迁移到账号登录模式（Supabase Auth）
-- 在 Supabase SQL Editor 中执行
-- =============================================

-- 1) 删除激活码表（如果之前创建过）
DROP TABLE IF EXISTS activation_codes;

-- 2) user_progress: device_id -> user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_progress' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE user_progress DROP CONSTRAINT IF EXISTS user_progress_device_id_question_id_key;
    ALTER TABLE user_progress RENAME COLUMN device_id TO user_id;
  END IF;
END $$;

-- 3) exam_history: device_id -> user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exam_history' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE exam_history RENAME COLUMN device_id TO user_id;
  END IF;
END $$;

-- 4) 将 user_id 字段转成 UUID（旧数据无法映射到 auth.users，将被清空）
TRUNCATE TABLE user_progress;
TRUNCATE TABLE exam_history;

ALTER TABLE user_progress ALTER COLUMN user_id TYPE UUID USING NULL;
ALTER TABLE exam_history ALTER COLUMN user_id TYPE UUID USING NULL;

ALTER TABLE user_progress ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE exam_history ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE user_progress
  ADD CONSTRAINT user_progress_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE exam_history
  ADD CONSTRAINT exam_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE user_progress
  ADD CONSTRAINT user_progress_user_id_question_id_key UNIQUE (user_id, question_id);

-- 5) 重建索引
DROP INDEX IF EXISTS idx_progress_device;
DROP INDEX IF EXISTS idx_progress_device_question;
DROP INDEX IF EXISTS idx_exam_history_device;
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_question ON user_progress(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_exam_history_user ON exam_history(user_id);

-- 6) 重建 RLS 策略（按 auth.uid()）
DROP POLICY IF EXISTS progress_all ON user_progress;
DROP POLICY IF EXISTS exam_history_all ON exam_history;
DROP POLICY IF EXISTS progress_owner_select ON user_progress;
DROP POLICY IF EXISTS progress_owner_insert ON user_progress;
DROP POLICY IF EXISTS progress_owner_update ON user_progress;
DROP POLICY IF EXISTS progress_owner_delete ON user_progress;
DROP POLICY IF EXISTS exam_owner_select ON exam_history;
DROP POLICY IF EXISTS exam_owner_insert ON exam_history;
DROP POLICY IF EXISTS exam_owner_update ON exam_history;
DROP POLICY IF EXISTS exam_owner_delete ON exam_history;

CREATE POLICY "progress_owner_select" ON user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "progress_owner_insert" ON user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "progress_owner_update" ON user_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "progress_owner_delete" ON user_progress FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "exam_owner_select" ON exam_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "exam_owner_insert" ON exam_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exam_owner_update" ON exam_history FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exam_owner_delete" ON exam_history FOR DELETE USING (auth.uid() = user_id);
