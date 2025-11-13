-- ============================================
-- ENABLE REALTIME FOR OTP TABLES
-- ============================================
-- Chạy script này để bật Realtime cho các bảng
-- Copy và paste vào Supabase SQL Editor
-- ============================================

-- Enable Realtime for otp_records table
-- Check if table exists in publication first
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'otp_records'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.otp_records;
    END IF;
END $$;

-- Enable Realtime for otp_verifications table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'otp_verifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.otp_verifications;
    END IF;
END $$;

-- ============================================
-- DONE! Realtime đã được bật
-- ============================================
-- Bây giờ các thay đổi trong database sẽ tự động
-- cập nhật lên tất cả các client đang subscribe
-- 
-- Để kiểm tra xem Realtime đã được bật chưa:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- ============================================

