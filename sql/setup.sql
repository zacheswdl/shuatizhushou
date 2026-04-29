-- =============================================
-- 刷题助手 - Supabase 数据库初始化（邮箱验证 + 管理员角色 + 封禁能力）
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

-- 3. 用户档案与角色表
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 用户进度表（按登录用户隔离）
CREATE TABLE IF NOT EXISTS user_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  chapter_id TEXT DEFAULT '',
  is_practiced BOOLEAN DEFAULT false,
  is_wrong BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  is_mastered BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, question_id)
);

-- 5. 考试历史表
CREATE TABLE IF NOT EXISTS exam_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INT DEFAULT 0,
  total INT DEFAULT 0,
  correct INT DEFAULT 0,
  wrong INT DEFAULT 0,
  used_time TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 索引
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_question ON user_progress(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_exam_history_user ON exam_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_banned ON user_profiles(is_banned);

-- 7. 管理员/封禁辅助函数
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = check_user_id
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_banned(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = check_user_id
      AND is_banned = true
  );
$$;

-- 8. 自动同步 auth.users -> user_profiles
CREATE OR REPLACE FUNCTION public.handle_auth_user_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_upsert ON auth.users;
CREATE TRIGGER on_auth_user_upsert
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_upsert();

-- 9. 回填已有账号
INSERT INTO public.user_profiles (id, email)
SELECT id, COALESCE(email, '')
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    updated_at = now();

-- 10. 启用 RLS
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_history ENABLE ROW LEVEL SECURITY;

-- 11. 清理旧策略，确保脚本可重复执行
DROP POLICY IF EXISTS chapters_read ON chapters;
DROP POLICY IF EXISTS chapters_write ON chapters;
DROP POLICY IF EXISTS questions_read ON questions;
DROP POLICY IF EXISTS questions_write ON questions;
DROP POLICY IF EXISTS user_profiles_self_select ON user_profiles;
DROP POLICY IF EXISTS user_profiles_self_insert ON user_profiles;
DROP POLICY IF EXISTS user_profiles_admin_select ON user_profiles;
DROP POLICY IF EXISTS user_profiles_admin_update ON user_profiles;
DROP POLICY IF EXISTS progress_owner_select ON user_progress;
DROP POLICY IF EXISTS progress_owner_insert ON user_progress;
DROP POLICY IF EXISTS progress_owner_update ON user_progress;
DROP POLICY IF EXISTS progress_owner_delete ON user_progress;
DROP POLICY IF EXISTS exam_owner_select ON exam_history;
DROP POLICY IF EXISTS exam_owner_insert ON exam_history;
DROP POLICY IF EXISTS exam_owner_update ON exam_history;
DROP POLICY IF EXISTS exam_owner_delete ON exam_history;

-- 12. 题库读取：登录且未封禁用户可读；管理员可写
CREATE POLICY chapters_read ON chapters
FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.is_banned());

CREATE POLICY chapters_write ON chapters
FOR ALL
USING (public.is_admin() AND NOT public.is_banned())
WITH CHECK (public.is_admin() AND NOT public.is_banned());

CREATE POLICY questions_read ON questions
FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.is_banned());

CREATE POLICY questions_write ON questions
FOR ALL
USING (public.is_admin() AND NOT public.is_banned())
WITH CHECK (public.is_admin() AND NOT public.is_banned());

-- 13. 用户档案：本人可读自己的资料；管理员可查看/修改所有用户状态
CREATE POLICY user_profiles_self_select ON user_profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY user_profiles_self_insert ON user_profiles
FOR INSERT
WITH CHECK (
  auth.uid() = id
  AND role = 'user'
  AND is_banned = false
);

CREATE POLICY user_profiles_admin_select ON user_profiles
FOR SELECT
USING (public.is_admin() AND NOT public.is_banned());

CREATE POLICY user_profiles_admin_update ON user_profiles
FOR UPDATE
USING (public.is_admin() AND NOT public.is_banned())
WITH CHECK (public.is_admin() AND NOT public.is_banned());

-- 14. 用户进度：仅本人且未封禁时可操作
CREATE POLICY progress_owner_select ON user_progress
FOR SELECT
USING (auth.uid() = user_id AND NOT public.is_banned());

CREATE POLICY progress_owner_insert ON user_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id AND NOT public.is_banned());

CREATE POLICY progress_owner_update ON user_progress
FOR UPDATE
USING (auth.uid() = user_id AND NOT public.is_banned())
WITH CHECK (auth.uid() = user_id AND NOT public.is_banned());

CREATE POLICY progress_owner_delete ON user_progress
FOR DELETE
USING (auth.uid() = user_id AND NOT public.is_banned());

-- 15. 考试历史：仅本人且未封禁时可操作
CREATE POLICY exam_owner_select ON exam_history
FOR SELECT
USING (auth.uid() = user_id AND NOT public.is_banned());

CREATE POLICY exam_owner_insert ON exam_history
FOR INSERT
WITH CHECK (auth.uid() = user_id AND NOT public.is_banned());

CREATE POLICY exam_owner_update ON exam_history
FOR UPDATE
USING (auth.uid() = user_id AND NOT public.is_banned())
WITH CHECK (auth.uid() = user_id AND NOT public.is_banned());

CREATE POLICY exam_owner_delete ON exam_history
FOR DELETE
USING (auth.uid() = user_id AND NOT public.is_banned());
