-- ============================================
-- ADD CUSTOMER NAME TO OTP_RECORDS
-- Thêm trường để lưu tên khách hàng cùng với OTP
-- ============================================

-- Thêm cột customer_name vào bảng otp_records
ALTER TABLE public.otp_records 
ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Thêm index để tìm kiếm nhanh theo customer_name (optional, chỉ nếu cần search)
CREATE INDEX IF NOT EXISTS idx_otp_records_customer_name 
ON public.otp_records(customer_name) 
WHERE customer_name IS NOT NULL;

-- Thêm comment
COMMENT ON COLUMN public.otp_records.customer_name IS 'Tên khách hàng (tùy chọn), được nhập khi gửi OTP';

-- ============================================
-- DONE! 
-- ============================================

