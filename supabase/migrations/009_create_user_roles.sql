-- ============================================
-- MIGRATION: Tạo bảng phân quyền users
-- ============================================

-- Step 1: Tạo bảng user_roles để quản lý roles của users
CREATE TABLE IF NOT EXISTS public.user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'cs')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id, role) -- Một user chỉ có một role duy nhất
);

-- Step 2: Tạo index cho performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Step 3: Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 4: Tạo policies
-- Cho phép tất cả authenticated users đọc (để check role)
DROP POLICY IF EXISTS "Allow read user_roles for authenticated users" ON public.user_roles;
CREATE POLICY "Allow read user_roles for authenticated users"
    ON public.user_roles
    FOR SELECT
    USING (true);

-- Tạo function để check admin (SECURITY DEFINER để bypass RLS)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Sử dụng SECURITY DEFINER để bypass RLS khi check admin
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Chỉ admin mới có thể insert/update/delete
-- Tách riêng từng policy để tránh infinite recursion
DROP POLICY IF EXISTS "Allow admin to insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow admin to update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow admin to delete user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow admin to manage user_roles" ON public.user_roles;

CREATE POLICY "Allow admin to insert user_roles"
    ON public.user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (public.check_is_admin());

CREATE POLICY "Allow admin to update user_roles"
    ON public.user_roles
    FOR UPDATE
    TO authenticated
    USING (public.check_is_admin())
    WITH CHECK (public.check_is_admin());

CREATE POLICY "Allow admin to delete user_roles"
    ON public.user_roles
    FOR DELETE
    TO authenticated
    USING (public.check_is_admin());

-- Step 5: Tạo function để check role
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = user_uuid
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_accountant(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = user_uuid
        AND role = 'accountant'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_cs(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = user_uuid
        AND role = 'cs'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role FROM public.user_roles
        WHERE user_id = user_uuid
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Tạo trigger để tự động set role cho user mới (optional)
-- Có thể comment nếu không muốn auto-assign role

-- Step 7: Gán role admin cho user db@y99.vn (nếu đã tồn tại)
INSERT INTO public.user_roles (user_id, role, created_at, updated_at)
SELECT 
    id,
    'admin',
    NOW(),
    NOW()
FROM auth.users
WHERE email = 'db@y99.vn'
AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.users.id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 8: Comment cho bảng
COMMENT ON TABLE public.user_roles IS 'Bảng quản lý phân quyền users: admin, accountant, cs';
COMMENT ON COLUMN public.user_roles.role IS 'Role của user: admin (quản trị), accountant (kế toán), cs (chăm sóc khách hàng)';
COMMENT ON FUNCTION public.is_admin IS 'Kiểm tra user có phải admin không';
COMMENT ON FUNCTION public.is_accountant IS 'Kiểm tra user có phải accountant không';
COMMENT ON FUNCTION public.is_cs IS 'Kiểm tra user có phải cs không';
COMMENT ON FUNCTION public.get_user_role IS 'Lấy role của user';

