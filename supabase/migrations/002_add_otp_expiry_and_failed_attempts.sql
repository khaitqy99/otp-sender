-- ============================================
-- MIGRATION: Thêm tính năng expire OTP và đếm số lần nhập sai
-- ============================================

-- Step 1: Thêm trường expires_at vào otp_records
ALTER TABLE public.otp_records 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Step 2: Tạo bảng để track các lần nhập sai OTP
CREATE TABLE IF NOT EXISTS public.otp_failed_attempts (
    id BIGSERIAL PRIMARY KEY,
    otp_record_id BIGINT REFERENCES public.otp_records(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    attempted_otp TEXT NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Tạo index cho bảng failed attempts
CREATE INDEX IF NOT EXISTS idx_otp_failed_attempts_otp_record_id 
ON public.otp_failed_attempts(otp_record_id);
CREATE INDEX IF NOT EXISTS idx_otp_failed_attempts_email 
ON public.otp_failed_attempts(email);
CREATE INDEX IF NOT EXISTS idx_otp_failed_attempts_attempted_at 
ON public.otp_failed_attempts(attempted_at DESC);

-- Step 4: Enable RLS cho bảng failed attempts
ALTER TABLE public.otp_failed_attempts ENABLE ROW LEVEL SECURITY;

-- Step 5: Tạo policy cho bảng failed attempts
DROP POLICY IF EXISTS "Allow all operations on otp_failed_attempts for anon users" ON public.otp_failed_attempts;
DROP POLICY IF EXISTS "Allow all operations on otp_failed_attempts for authenticated users" ON public.otp_failed_attempts;

CREATE POLICY "Allow all operations on otp_failed_attempts for anon users"
    ON public.otp_failed_attempts
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on otp_failed_attempts for authenticated users"
    ON public.otp_failed_attempts
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Step 6: Tạo function để tự động set expires_at khi tạo OTP mới
CREATE OR REPLACE FUNCTION public.set_otp_expires_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Tự động set expires_at = created_at + 30 phút
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at := NEW.created_at + INTERVAL '30 minutes';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Tạo trigger để tự động set expires_at
DROP TRIGGER IF EXISTS trigger_set_otp_expires_at ON public.otp_records;
CREATE TRIGGER trigger_set_otp_expires_at
    BEFORE INSERT ON public.otp_records
    FOR EACH ROW
    EXECUTE FUNCTION public.set_otp_expires_at();

-- Step 8: Tạo function để tự động reject OTP đã hết hạn hoặc có >= 3 lần nhập sai
CREATE OR REPLACE FUNCTION public.auto_reject_expired_otps()
RETURNS void AS $$
BEGIN
    -- Tự động reject các verification có OTP đã hết hạn (quá 30 phút) và vẫn pending
    UPDATE public.otp_verifications v
    SET 
        approval_status = 'rejected',
        rejected_by = 'system',
        rejected_at = NOW()
    FROM public.otp_records r
    WHERE v.otp_record_id = r.id
        AND v.approval_status = 'pending'
        AND r.expires_at < NOW();
    
    -- Tự động reject các verification có >= 3 lần nhập sai cho cùng một OTP record
    UPDATE public.otp_verifications v
    SET 
        approval_status = 'rejected',
        rejected_by = 'system',
        rejected_at = NOW()
    WHERE v.approval_status = 'pending'
        AND (
            SELECT COUNT(*) 
            FROM public.otp_failed_attempts f
            WHERE f.otp_record_id = v.otp_record_id
        ) >= 3;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Tạo function để check và reject OTP khi verify
CREATE OR REPLACE FUNCTION public.check_otp_validity(
    p_otp_record_id BIGINT
)
RETURNS TEXT AS $$
DECLARE
    v_expires_at TIMESTAMPTZ;
    v_failed_count INTEGER;
BEGIN
    -- Lấy thời gian hết hạn
    SELECT expires_at INTO v_expires_at
    FROM public.otp_records
    WHERE id = p_otp_record_id;
    
    -- Kiểm tra nếu OTP đã hết hạn
    IF v_expires_at < NOW() THEN
        RETURN 'expired';
    END IF;
    
    -- Đếm số lần nhập sai
    SELECT COUNT(*) INTO v_failed_count
    FROM public.otp_failed_attempts
    WHERE otp_record_id = p_otp_record_id;
    
    -- Kiểm tra nếu đã có >= 3 lần nhập sai
    IF v_failed_count >= 3 THEN
        RETURN 'too_many_attempts';
    END IF;
    
    RETURN 'valid';
END;
$$ LANGUAGE plpgsql;

-- Step 10: Cập nhật expires_at cho các OTP cũ (nếu có)
UPDATE public.otp_records
SET expires_at = created_at + INTERVAL '30 minutes'
WHERE expires_at IS NULL;

-- Step 11: Add comments
COMMENT ON COLUMN public.otp_records.expires_at IS 'Thời gian hết hạn OTP (30 phút sau khi tạo)';
COMMENT ON TABLE public.otp_failed_attempts IS 'Bảng lưu trữ các lần nhập sai OTP';
COMMENT ON FUNCTION public.set_otp_expires_at() IS 'Tự động set expires_at = created_at + 30 phút khi tạo OTP mới';
COMMENT ON FUNCTION public.auto_reject_expired_otps() IS 'Tự động reject các OTP đã hết hạn hoặc có >= 3 lần nhập sai';
COMMENT ON FUNCTION public.check_otp_validity(BIGINT) IS 'Kiểm tra OTP còn hợp lệ không (chưa hết hạn và chưa có >= 3 lần nhập sai)';

