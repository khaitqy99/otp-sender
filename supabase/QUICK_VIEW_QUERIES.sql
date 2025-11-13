-- ============================================
-- CÁC CÂU LỆNH SQL ĐỂ XEM DỮ LIỆU NHANH
-- ============================================
-- Copy và chạy các câu lệnh này trong Supabase SQL Editor
-- ============================================

-- 1. Xem tất cả OTP records (dễ đọc với ID tự tăng)
SELECT 
    record_id AS "ID",
    email AS "Email",
    customer_name AS "Tên khách hàng",
    otp AS "OTP",
    status AS "Trạng thái",
    created_by AS "Người gửi",
    notes AS "Ghi chú",
    created_at AS "Thời gian gửi"
FROM public.otp_records
ORDER BY record_id DESC
LIMIT 50;

-- 2. Xem tất cả verifications (dễ đọc với ID tự tăng)
SELECT 
    verification_id AS "ID",
    otp_record_display_id AS "OTP Record ID",
    email AS "Email",
    otp AS "OTP",
    verified_by AS "CS xác thực",
    verified_at AS "Thời gian xác thực",
    approval_status AS "Trạng thái",
    approved_by AS "Kế toán xác nhận",
    approved_at AS "Thời gian xác nhận",
    rejected_by AS "Kế toán từ chối",
    rejected_at AS "Thời gian từ chối",
    approval_notes AS "Ghi chú"
FROM public.otp_verifications
ORDER BY verification_id DESC
LIMIT 50;

-- 3. Xem dashboard thống kê
SELECT * FROM public.v_otp_dashboard;

-- 4. Xem OTP records summary (view)
SELECT * FROM public.v_otp_records_summary
LIMIT 50;

-- 5. Xem verifications summary (view)
SELECT * FROM public.v_otp_verifications_summary
LIMIT 50;

-- 6. Tìm OTP theo email
SELECT 
    record_id AS "ID",
    email AS "Email",
    otp AS "OTP",
    status AS "Trạng thái",
    created_at AS "Thời gian gửi"
FROM public.otp_records
WHERE email ILIKE '%example@email.com%'
ORDER BY record_id DESC;

-- 7. Tìm verifications đang chờ xử lý
SELECT 
    verification_id AS "ID",
    otp_record_display_id AS "OTP Record ID",
    email AS "Email",
    otp AS "OTP",
    verified_by AS "CS xác thực",
    verified_at AS "Thời gian xác thực"
FROM public.otp_verifications
WHERE approval_status = 'pending'
ORDER BY verified_at DESC;

-- 8. Thống kê theo ngày
SELECT 
    DATE(created_at) AS "Ngày",
    COUNT(*) AS "Số OTP gửi",
    COUNT(CASE WHEN status = 'success' THEN 1 END) AS "Thành công",
    COUNT(CASE WHEN status = 'failed' THEN 1 END) AS "Thất bại"
FROM public.otp_records
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- 9. Thống kê verifications theo ngày
SELECT 
    DATE(verified_at) AS "Ngày",
    COUNT(*) AS "Tổng xác thực",
    COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) AS "Chờ xử lý",
    COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) AS "Đã xác nhận",
    COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) AS "Đã từ chối"
FROM public.otp_verifications
WHERE verified_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(verified_at)
ORDER BY DATE(verified_at) DESC;

-- 10. Xem chi tiết một OTP record kèm tất cả verifications
SELECT 
    r.record_id AS "OTP ID",
    r.email AS "Email",
    r.otp AS "OTP",
    r.status AS "Trạng thái gửi",
    r.created_by AS "Người gửi",
    r.created_at AS "Thời gian gửi",
    v.verification_id AS "Verification ID",
    v.verified_by AS "CS xác thực",
    v.verified_at AS "Thời gian xác thực",
    v.approval_status AS "Trạng thái approval",
    v.approved_by AS "Kế toán xác nhận",
    v.approved_at AS "Thời gian xác nhận"
FROM public.otp_records r
LEFT JOIN public.otp_verifications v ON r.id = v.otp_record_id
WHERE r.record_id = 1  -- Thay số ID bạn muốn xem
ORDER BY v.verified_at DESC;

