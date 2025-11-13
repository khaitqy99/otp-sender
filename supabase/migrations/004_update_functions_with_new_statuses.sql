-- ============================================
-- MIGRATION: Cập nhật functions và data để sử dụng trạng thái expired và locked
-- Phải chạy sau migration 003_add_expired_and_locked_enum_values.sql
-- ============================================

-- Step 1: Cập nhật function auto_reject_expired_otps để sử dụng trạng thái mới
CREATE OR REPLACE FUNCTION public.auto_reject_expired_otps()
RETURNS void AS $$
BEGIN
    -- Tự động set expired cho các verification có OTP đã hết hạn (quá 30 phút) và vẫn pending
    UPDATE public.otp_verifications v
    SET 
        approval_status = 'expired',
        rejected_by = 'system',
        rejected_at = NOW()
    FROM public.otp_records r
    WHERE v.otp_record_id = r.id
        AND v.approval_status = 'pending'
        AND r.expires_at < NOW();
    
    -- Tự động set locked cho các verification có >= 3 lần nhập sai cho cùng một OTP record
    UPDATE public.otp_verifications v
    SET 
        approval_status = 'locked',
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

-- Step 2: Cập nhật các OTP đã bị reject bởi system để phân biệt expired và locked
-- Cập nhật các OTP đã hết hạn
UPDATE public.otp_verifications v
SET approval_status = 'expired'
FROM public.otp_records r
WHERE v.otp_record_id = r.id
    AND v.approval_status = 'rejected'
    AND v.rejected_by = 'system'
    AND r.expires_at < v.rejected_at;

-- Cập nhật các OTP bị khóa (còn lại sau khi đã xử lý expired)
UPDATE public.otp_verifications v
SET approval_status = 'locked'
WHERE v.approval_status = 'rejected'
    AND v.rejected_by = 'system'
    AND (
        SELECT COUNT(*) 
        FROM public.otp_failed_attempts f
        WHERE f.otp_record_id = v.otp_record_id
    ) >= 3;

-- Step 3: Add comments
COMMENT ON FUNCTION public.auto_reject_expired_otps() IS 'Tự động set expired cho OTP hết hạn và locked cho OTP bị khóa (>= 3 lần nhập sai)';

