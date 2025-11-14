-- ============================================
-- ADD ERROR CODE AND REASON TO OTP_RECORDS
-- Thêm trường để lưu error code và reason từ Resend khi email bị bounce
-- ============================================

-- Thêm cột error_code và error_reason vào bảng otp_records
ALTER TABLE public.otp_records 
ADD COLUMN IF NOT EXISTS error_code TEXT,
ADD COLUMN IF NOT EXISTS error_reason TEXT;

-- Thêm index để tìm kiếm nhanh theo error_code
CREATE INDEX IF NOT EXISTS idx_otp_records_error_code 
ON public.otp_records(error_code) 
WHERE error_code IS NOT NULL;

-- Thêm comment
COMMENT ON COLUMN public.otp_records.error_code IS 'Error code từ Resend API khi email bị bounce (ví dụ: 550, 551, etc.)';
COMMENT ON COLUMN public.otp_records.error_reason IS 'Lý do chi tiết từ Resend API khi email bị bounce';

-- ============================================
-- DONE! 
-- ============================================

