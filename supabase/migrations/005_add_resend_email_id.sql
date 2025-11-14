-- ============================================
-- ADD RESEND EMAIL ID TO OTP_RECORDS
-- Thêm trường để lưu email ID từ Resend API
-- ============================================

-- Thêm cột resend_email_id vào bảng otp_records
ALTER TABLE public.otp_records 
ADD COLUMN IF NOT EXISTS resend_email_id TEXT;

-- Thêm index để tìm kiếm nhanh theo resend_email_id
CREATE INDEX IF NOT EXISTS idx_otp_records_resend_email_id 
ON public.otp_records(resend_email_id) 
WHERE resend_email_id IS NOT NULL;

-- Thêm comment
COMMENT ON COLUMN public.otp_records.resend_email_id IS 'Email ID từ Resend API, dùng để tracking và xử lý webhook events';

-- ============================================
-- DONE! 
-- ============================================

