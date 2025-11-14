-- ============================================
-- MIGRATION: Tạo bảng users riêng (không dùng Supabase Auth)
-- Giống như employees table trong y99kpinew
-- ============================================

-- Step 1: Tạo bảng users
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'cs')) DEFAULT 'accountant',
    name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMPTZ,
    login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Tạo index cho performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- Step 3: Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 4: Tạo policies
-- Cho phép anonymous và authenticated users đọc (để login và check role)
DROP POLICY IF EXISTS "Allow read users for login" ON public.users;
CREATE POLICY "Allow read users for login"
    ON public.users
    FOR SELECT
    USING (true);

-- Tạo function để check admin (SECURITY DEFINER để bypass RLS)
CREATE OR REPLACE FUNCTION public.check_user_is_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Sử dụng SECURITY DEFINER để bypass RLS khi check admin
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE email = user_email
        AND role = 'admin'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cho phép admin insert/update/delete
DROP POLICY IF EXISTS "Allow admin to manage users" ON public.users;
CREATE POLICY "Allow admin to manage users"
    ON public.users
    FOR ALL
    TO authenticated
    USING (
        public.check_user_is_admin(
            current_setting('request.jwt.claims', true)::json->>'email'
        )
    )
    WITH CHECK (
        public.check_user_is_admin(
            current_setting('request.jwt.claims', true)::json->>'email'
        )
    );

-- Cho phép tất cả insert (để tạo user mới - có thể hạn chế sau)
DROP POLICY IF EXISTS "Allow insert users" ON public.users;
CREATE POLICY "Allow insert users"
    ON public.users
    FOR INSERT
    WITH CHECK (true);

-- Cho phép update login_attempts và last_login (để login)
DROP POLICY IF EXISTS "Allow update users for login" ON public.users;
CREATE POLICY "Allow update users for login"
    ON public.users
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Step 5: Tạo trigger để tự động update updated_at
CREATE OR REPLACE FUNCTION public.update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON public.users;
CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_users_updated_at();

-- Step 6: Comment
COMMENT ON TABLE public.users IS 'Bảng quản lý users (không dùng Supabase Auth)';
COMMENT ON COLUMN public.users.role IS 'Role của user: admin (quản trị), accountant (kế toán), cs (chăm sóc khách hàng)';
COMMENT ON COLUMN public.users.password_hash IS 'Mật khẩu đã hash (có thể dùng plain text cho demo như y99kpinew)';
COMMENT ON FUNCTION public.check_user_is_admin IS 'Kiểm tra user có phải admin không (bypass RLS để tránh infinite recursion)';

