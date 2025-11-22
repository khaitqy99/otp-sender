-- Query để kiểm tra trạng thái OTP records
-- Chạy query này trong Supabase SQL Editor

-- Xem các OTP records gần nhất
SELECT 
  id,
  email,
  otp,
  status,
  resend_email_id,
  error_code,
  error_reason,
  created_at,
  created_by
FROM otp_records
ORDER BY created_at DESC
LIMIT 10;

-- Tìm OTP records có resend_email_id nhưng status vẫn là success
SELECT 
  id,
  email,
  otp,
  status,
  resend_email_id,
  error_code,
  error_reason,
  created_at
FROM otp_records
WHERE resend_email_id IS NOT NULL
  AND status = 'success'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Tìm OTP records có email cụ thể
SELECT 
  id,
  email,
  otp,
  status,
  resend_email_id,
  error_code,
  error_reason,
  created_at
FROM otp_records
WHERE email = 'khaitq.it@y9999.vn'
ORDER BY created_at DESC;

