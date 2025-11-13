-- ============================================
-- XÓA HẾT TẤT CẢ DỮ LIỆU OTP
-- ⚠️ CẢNH BÁO: Script này sẽ xóa TẤT CẢ dữ liệu trong các bảng OTP
-- Chạy cẩn thận, không thể hoàn tác!
-- ============================================

-- Xóa theo thứ tự để tránh lỗi foreign key constraint
-- (Xóa bảng con trước, bảng cha sau)

-- Step 1: Xóa tất cả failed attempts
DELETE FROM public.otp_failed_attempts;
-- Reset sequence (tùy chọn, để ID bắt đầu lại từ 1)
ALTER SEQUENCE public.otp_failed_attempts_id_seq RESTART WITH 1;

-- Step 2: Xóa tất cả verifications
DELETE FROM public.otp_verifications;
-- Reset sequence
ALTER SEQUENCE public.otp_verifications_id_seq RESTART WITH 1;

-- Step 3: Xóa tất cả OTP records
DELETE FROM public.otp_records;
-- Reset sequence
ALTER SEQUENCE public.otp_records_id_seq RESTART WITH 1;

-- ============================================
-- XÁC NHẬN: Tất cả dữ liệu đã được xóa
-- ============================================

-- Kiểm tra số lượng records còn lại (nên = 0)
SELECT 
    (SELECT COUNT(*) FROM public.otp_records) AS "Số OTP records",
    (SELECT COUNT(*) FROM public.otp_verifications) AS "Số verifications",
    (SELECT COUNT(*) FROM public.otp_failed_attempts) AS "Số failed attempts";

-- ============================================
-- DONE! Tất cả dữ liệu đã được xóa
-- ============================================

