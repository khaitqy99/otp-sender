-- ============================================
-- SCRIPT XÓA TẤT CẢ DỮ LIỆU
-- CẢNH BÁO: Script này sẽ xóa TẤT CẢ dữ liệu trong database
-- Chạy script này sẽ xóa:
-- - Tất cả OTP records
-- - Tất cả OTP verifications
-- - Tất cả failed attempts
-- - Tất cả users (trừ admin nếu bạn muốn giữ lại)
-- ============================================

-- Xóa theo thứ tự để tránh lỗi foreign key constraint

-- 1. Xóa tất cả failed attempts trước (có foreign key tới otp_records)
DELETE FROM public.otp_failed_attempts;

-- 2. Xóa tất cả verifications (có foreign key tới otp_records)
-- Lưu ý: Vì có ON DELETE CASCADE, xóa otp_records sẽ tự động xóa verifications
-- Nhưng để chắc chắn, chúng ta xóa trực tiếp
DELETE FROM public.otp_verifications;

-- 3. Xóa tất cả OTP records
DELETE FROM public.otp_records;

-- 4. Xóa tất cả users
-- CẢNH BÁO: Script này sẽ xóa TẤT CẢ users, kể cả admin
-- Nếu muốn giữ lại admin, uncomment dòng dưới và comment dòng DELETE FROM public.users;
DELETE FROM public.users;

-- Option: Xóa tất cả users TRỪ admin (uncomment nếu muốn giữ lại admin)
-- DELETE FROM public.users WHERE role != 'admin';
-- DELETE FROM public.users WHERE email != 'admin@y99.vn';  -- Thay email admin của bạn

-- 5. Reset sequence cho các bảng (để ID bắt đầu lại từ 1)
-- Lưu ý: Chỉ reset nếu bạn muốn ID bắt đầu lại từ 1
-- Nếu không reset, ID sẽ tiếp tục từ số cuối cùng

-- Reset sequence cho otp_records
ALTER SEQUENCE IF EXISTS public.otp_records_id_seq RESTART WITH 1;

-- Reset sequence cho otp_verifications
ALTER SEQUENCE IF EXISTS public.otp_verifications_id_seq RESTART WITH 1;

-- Reset sequence cho otp_failed_attempts
ALTER SEQUENCE IF EXISTS public.otp_failed_attempts_id_seq RESTART WITH 1;

-- Reset sequence cho users (nếu có)
ALTER SEQUENCE IF EXISTS public.users_id_seq RESTART WITH 1;

-- ============================================
-- XÁC NHẬN: Kiểm tra số lượng records còn lại
-- ============================================
SELECT 
    'otp_records' AS table_name,
    COUNT(*) AS remaining_count
FROM public.otp_records
UNION ALL
SELECT 
    'otp_verifications' AS table_name,
    COUNT(*) AS remaining_count
FROM public.otp_verifications
UNION ALL
SELECT 
    'otp_failed_attempts' AS table_name,
    COUNT(*) AS remaining_count
FROM public.otp_failed_attempts
UNION ALL
SELECT 
    'users' AS table_name,
    COUNT(*) AS remaining_count
FROM public.users;

-- ============================================
-- HOÀN TẤT!
-- Tất cả dữ liệu đã được xóa (hoặc kiểm tra kết quả ở trên)
-- ============================================

