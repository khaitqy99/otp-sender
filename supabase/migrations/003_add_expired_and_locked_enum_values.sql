-- ============================================
-- MIGRATION: Thêm giá trị expired và locked vào enum approval_status
-- Phải chạy riêng trước khi sử dụng các giá trị này
-- ============================================

-- Thêm giá trị mới vào enum approval_status
ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'locked';

