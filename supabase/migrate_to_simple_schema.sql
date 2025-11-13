-- ============================================
-- MIGRATION: Chuyển từ UUID sang ID (BIGSERIAL)
-- Loại bỏ các trường dư thừa
-- ============================================
-- CHÚ Ý: Script này sẽ XÓA TẤT CẢ DỮ LIỆU hiện có!
-- Chỉ chạy nếu bạn muốn reset database về schema mới
-- ============================================

-- Backup dữ liệu trước (nếu cần)
-- CREATE TABLE otp_records_backup AS SELECT * FROM otp_records;
-- CREATE TABLE otp_verifications_backup AS SELECT * FROM otp_verifications;

-- Step 1: Drop existing tables
DROP TABLE IF EXISTS public.otp_verifications CASCADE;
DROP TABLE IF EXISTS public.otp_records CASCADE;

-- Step 2: Drop existing views
DROP VIEW IF EXISTS public.v_otp_dashboard;
DROP VIEW IF EXISTS public.v_otp_verifications_summary;
DROP VIEW IF EXISTS public.v_otp_records_summary;

-- Step 3: Create new tables with ID (BIGSERIAL)
CREATE TABLE public.otp_records (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    status otp_status NOT NULL DEFAULT 'success',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Step 4: Create indexes
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

-- Step 5: Enable RLS
ALTER TABLE public.otp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Step 6: Create policies
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

-- Step 7: Recreate views
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
-- DONE! Migration completed
-- ============================================
-- Schema mới đã được tạo với:
-- ✓ ID BIGSERIAL thay vì UUID
-- ✓ Loại bỏ các trường dư thừa: customer_name, notes, approval_notes, updated_at, record_id, verification_id, otp_record_display_id
-- ✓ Chỉ giữ các trường cần thiết
-- ============================================

