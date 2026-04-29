-- =============================================
-- 刷题助手 - 升级到邮箱验证/管理员角色/封禁账号体系
-- 适用于已经上线并已存在题库、进度数据的 Supabase 项目
-- =============================================

-- 1. 新增用户档案表
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_banned ON user_profiles(is_banned);

-- 2. 辅助函数
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
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
    SELECT 1 FROM public.user_profiles
    WHERE id = check_user_id
      AND is_banned = true
  );
$$;

-- 3. 同步 auth.users 到 user_profiles
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

-- 4. 回填已有账号
INSERT INTO public.user_profiles (id, email)
SELECT id, COALESCE(email, '')
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    updated_at = now();

-- 5. 启用并重建 RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_history ENABLE ROW LEVEL SECURITY;

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
DROP POLICY IF EXISTS "chapters_read" ON chapters;
DROP POLICY IF EXISTS "chapters_write" ON chapters;
DROP POLICY IF EXISTS "questions_read" ON questions;
DROP POLICY IF EXISTS "questions_write" ON questions;
DROP POLICY IF EXISTS "progress_owner_select" ON user_progress;
DROP POLICY IF EXISTS "progress_owner_insert" ON user_progress;
DROP POLICY IF EXISTS "progress_owner_update" ON user_progress;
DROP POLICY IF EXISTS "progress_owner_delete" ON user_progress;
DROP POLICY IF EXISTS "exam_owner_select" ON exam_history;
DROP POLICY IF EXISTS "exam_owner_insert" ON exam_history;
DROP POLICY IF EXISTS "exam_owner_update" ON exam_history;
DROP POLICY IF EXISTS "exam_owner_delete" ON exam_history;

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

-- 6. 手动授予某个邮箱管理员角色时，执行下面这句，把邮箱改成你的管理员邮箱：
-- UPDATE public.user_profiles SET role = 'admin', updated_at = now() WHERE email = 'your-admin@example.com';
