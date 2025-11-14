-- ============================================
-- MIGRATION: Tạo tài khoản admin
-- ============================================
-- Email: db@y99.vn
-- Password: Dby996868

-- Lưu ý: File này cần được chạy với quyền admin hoặc service role
-- Cách chạy: Vào Supabase Dashboard > SQL Editor > chạy script này

-- Tạo user trong auth.users với ID cố định
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001'::uuid,
  'authenticated',
  'authenticated',
  'db@y99.vn',
  crypt('Dby996868', gen_salt('bf')),
  NOW(),
  NULL,
  NULL,
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Tạo identity cho user (cần thiết cho Supabase Auth) với ID cố định
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT 
  '00000000-0000-0000-0000-000000000002'::uuid,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email
  ),
  'email',
  u.email, -- provider_id thường là email
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'db@y99.vn'
ON CONFLICT DO NOTHING;

-- Thông báo thành công
DO $$
BEGIN
  RAISE NOTICE 'Đã tạo tài khoản admin thành công: db@y99.vn';
END $$;

