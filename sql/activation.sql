-- 激活码表：记录已使用的激活码和绑定的设备
CREATE TABLE IF NOT EXISTS activation_codes (
  code TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activation_all" ON activation_codes FOR ALL USING (true) WITH CHECK (true);
