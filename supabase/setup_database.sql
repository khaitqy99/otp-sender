-- ============================================
-- SUPABASE DATABASE SETUP FOR OTP SYSTEM
-- Schema đơn giản với ID (BIGSERIAL) thay vì UUID
-- Chỉ giữ các trường cần thiết
-- ============================================
-- Copy toàn bộ nội dung này và paste vào Supabase SQL Editor
-- Sau đó click "Run" để tạo database schema
-- ============================================

-- Step 1: Create enum types (only if they don't exist)
DO $$ BEGIN
    CREATE TYPE otp_status AS ENUM ('success', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS public.otp_verifications CASCADE;
DROP TABLE IF EXISTS public.otp_records CASCADE;

-- Step 3: Create otp_records table
-- Bảng lưu trữ các OTP được gửi bởi kế toán
CREATE TABLE public.otp_records (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    status otp_status NOT NULL DEFAULT 'success',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 4: Create otp_verifications table
-- Bảng lưu trữ xác thực của CS và approval của kế toán
CREATE TABLE public.otp_verifications (
    id BIGSERIAL PRIMARY KEY,
    otp_record_id BIGINT REFERENCES public.otp_records(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    verified_by TEXT NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approval_status approval_status NOT NULL DEFAULT 'pending',
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejected_by TEXT,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 5: Create indexes for performance
CREATE INDEX idx_otp_records_id ON public.otp_records(id DESC);
CREATE INDEX idx_otp_records_email ON public.otp_records(email);
CREATE INDEX idx_otp_records_created_at ON public.otp_records(created_at DESC);
CREATE INDEX idx_otp_records_status ON public.otp_records(status);

CREATE INDEX idx_otp_verifications_id ON public.otp_verifications(id DESC);
CREATE INDEX idx_otp_verifications_email ON public.otp_verifications(email);
CREATE INDEX idx_otp_verifications_otp ON public.otp_verifications(otp);
CREATE INDEX idx_otp_verifications_approval_status ON public.otp_verifications(approval_status);
CREATE INDEX idx_otp_verifications_verified_at ON public.otp_verifications(verified_at DESC);
CREATE INDEX idx_otp_verifications_otp_record_id ON public.otp_verifications(otp_record_id);

-- Step 6: Enable Row Level Security
ALTER TABLE public.otp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Step 7: Create policies (allow all for now)
DROP POLICY IF EXISTS "Allow all operations on otp_records for anon users" ON public.otp_records;
DROP POLICY IF EXISTS "Allow all operations on otp_records for authenticated users" ON public.otp_records;
DROP POLICY IF EXISTS "Allow all operations on otp_verifications for anon users" ON public.otp_verifications;
DROP POLICY IF EXISTS "Allow all operations on otp_verifications for authenticated users" ON public.otp_verifications;

CREATE POLICY "Allow all operations on otp_records for anon users"
    ON public.otp_records
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on otp_records for authenticated users"
    ON public.otp_records
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on otp_verifications for anon users"
    ON public.otp_verifications
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on otp_verifications for authenticated users"
    ON public.otp_verifications
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Step 8: Create views for easy data viewing
-- View tổng hợp thông tin OTP records
CREATE OR REPLACE VIEW public.v_otp_records_summary AS
SELECT 
    r.id AS "ID",
    r.email AS "Email",
    r.otp AS "OTP",
    r.status AS "Trạng thái",
    r.created_by AS "Người gửi",
    r.created_at AS "Thời gian gửi",
    COUNT(v.id) AS "Số lần xác thực"
FROM public.otp_records r
LEFT JOIN public.otp_verifications v ON r.id = v.otp_record_id
GROUP BY r.id, r.email, r.otp, r.status, r.created_by, r.created_at
ORDER BY r.id DESC;

-- View tổng hợp thông tin verifications với approval
CREATE OR REPLACE VIEW public.v_otp_verifications_summary AS
SELECT 
    v.id AS "ID",
    v.otp_record_id AS "OTP Record ID",
    v.email AS "Email",
    v.otp AS "OTP",
    v.verified_by AS "CS xác thực",
    v.verified_at AS "Thời gian xác thực",
    v.approval_status AS "Trạng thái",
    v.approved_by AS "Kế toán xác nhận",
    v.approved_at AS "Thời gian xác nhận",
    v.rejected_by AS "Kế toán từ chối",
    v.rejected_at AS "Thời gian từ chối",
    v.created_at AS "Tạo lúc",
    r.created_by AS "Người gửi OTP"
FROM public.otp_verifications v
LEFT JOIN public.otp_records r ON v.otp_record_id = r.id
ORDER BY v.id DESC;

-- View dashboard - thống kê tổng quan
CREATE OR REPLACE VIEW public.v_otp_dashboard AS
SELECT 
    (SELECT COUNT(*) FROM public.otp_records) AS "Tổng số OTP",
    (SELECT COUNT(*) FROM public.otp_records WHERE status = 'success') AS "OTP thành công",
    (SELECT COUNT(*) FROM public.otp_records WHERE status = 'failed') AS "OTP thất bại",
    (SELECT COUNT(*) FROM public.otp_verifications) AS "Tổng số xác thực",
    (SELECT COUNT(*) FROM public.otp_verifications WHERE approval_status = 'pending') AS "Chờ xử lý",
    (SELECT COUNT(*) FROM public.otp_verifications WHERE approval_status = 'approved') AS "Đã xác nhận",
    (SELECT COUNT(*) FROM public.otp_verifications WHERE approval_status = 'rejected') AS "Đã từ chối",
    (SELECT COUNT(*) FROM public.otp_records WHERE created_at >= NOW() - INTERVAL '24 hours') AS "OTP 24h qua",
    (SELECT COUNT(*) FROM public.otp_verifications WHERE verified_at >= NOW() - INTERVAL '24 hours') AS "Xác thực 24h qua";

-- ============================================
-- DONE! Database setup completed
-- ============================================
-- Các bảng đã được tạo với:
-- ✓ ID BIGSERIAL (1, 2, 3...) thay vì UUID
-- ✓ Chỉ giữ các trường cần thiết
-- ✓ Views để xem dữ liệu dễ dàng
-- ✓ Indexes để tối ưu performance
-- 
-- Để xem dữ liệu:
-- SELECT * FROM public.v_otp_records_summary;
-- SELECT * FROM public.v_otp_verifications_summary;
-- SELECT * FROM public.v_otp_dashboard;
-- ============================================
