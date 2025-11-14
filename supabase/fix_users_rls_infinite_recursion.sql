-- ============================================
-- FIX: Infinite recursion trong RLS policy cho bảng users
-- ============================================

-- Step 1: Tạo function để check admin (SECURITY DEFINER để bypass RLS)
-- Function này sẽ check role từ bảng users mà không bị ảnh hưởng bởi RLS
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

-- Step 2: Xóa policy cũ có vấn đề
DROP POLICY IF EXISTS "Allow admin to manage users" ON public.users;

-- Step 3: Tạo lại policy sử dụng function để tránh infinite recursion
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

-- Step 4: Comment
COMMENT ON FUNCTION public.check_user_is_admin IS 'Kiểm tra user có phải admin không (bypass RLS để tránh infinite recursion)';

