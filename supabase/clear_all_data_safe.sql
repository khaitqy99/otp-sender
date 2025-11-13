-- ============================================
-- XÓA HẾT TẤT CẢ DỮ LIỆU OTP (AN TOÀN)
-- Script này cho phép xem trước số lượng records trước khi xóa
-- ============================================

-- ============================================
-- BƯỚC 1: XEM TRƯỚC SỐ LƯỢNG RECORDS
-- ============================================
-- Chạy query này trước để xem có bao nhiêu records sẽ bị xóa

SELECT 
    (SELECT COUNT(*) FROM public.otp_records) AS "Số OTP records sẽ bị xóa",
    (SELECT COUNT(*) FROM public.otp_verifications) AS "Số verifications sẽ bị xóa",
    (SELECT COUNT(*) FROM public.otp_failed_attempts) AS "Số failed attempts sẽ bị xóa";

-- ============================================
-- BƯỚC 2: XEM CHI TIẾT (TÙY CHỌN)
-- ============================================
-- Nếu muốn xem chi tiết, có thể chạy các query sau:

-- Xem danh sách OTP records
-- SELECT * FROM public.otp_records ORDER BY created_at DESC LIMIT 10;

-- Xem danh sách verifications
-- SELECT * FROM public.otp_verifications ORDER BY verified_at DESC LIMIT 10;

-- Xem danh sách failed attempts
-- SELECT * FROM public.otp_failed_attempts ORDER BY attempted_at DESC LIMIT 10;

-- ============================================
-- BƯỚC 3: XÓA DỮ LIỆU
-- ============================================
-- ⚠️ CHỈ CHẠY SAU KHI ĐÃ XEM TRƯỚC VÀ XÁC NHẬN!
-- Bỏ comment các dòng dưới để thực hiện xóa:

/*
-- Xóa tất cả failed attempts
DELETE FROM public.otp_failed_attempts;
ALTER SEQUENCE public.otp_failed_attempts_id_seq RESTART WITH 1;

-- Xóa tất cả verifications
DELETE FROM public.otp_verifications;
ALTER SEQUENCE public.otp_verifications_id_seq RESTART WITH 1;

-- Xóa tất cả OTP records
DELETE FROM public.otp_records;
ALTER SEQUENCE public.otp_records_id_seq RESTART WITH 1;

-- Xác nhận đã xóa xong
SELECT 
    (SELECT COUNT(*) FROM public.otp_records) AS "Số OTP records còn lại",
    (SELECT COUNT(*) FROM public.otp_verifications) AS "Số verifications còn lại",
    (SELECT COUNT(*) FROM public.otp_failed_attempts) AS "Số failed attempts còn lại";
*/

-- ============================================
-- HƯỚNG DẪN SỬ DỤNG:
-- 1. Chạy BƯỚC 1 để xem số lượng records
-- 2. (Tùy chọn) Chạy BƯỚC 2 để xem chi tiết
-- 3. Nếu đồng ý, bỏ comment phần BƯỚC 3 và chạy
-- ============================================

