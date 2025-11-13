# Supabase Migrations

## Cách chạy migrations

### Option 1: Chạy trực tiếp trên Supabase Dashboard

1. Đăng nhập vào [Supabase Dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn
3. Vào **SQL Editor**
4. Copy nội dung file `001_create_otp_tables.sql`
5. Paste vào SQL Editor và chạy

### Option 2: Sử dụng Supabase CLI

```bash
# Cài đặt Supabase CLI (nếu chưa có)
npm install -g supabase

# Link với project của bạn
supabase link --project-ref xeliuljgfwjygzdumzyv

# Chạy migrations
supabase db push
```

### Option 3: Chạy từng câu lệnh SQL

Nếu bạn muốn chạy từng phần, có thể copy từng section trong file SQL và chạy riêng lẻ.

## Cấu trúc Database

### Bảng `otp_records`
- Lưu trữ các OTP được gửi bởi kế toán
- Các trường:
  - `id`: UUID (primary key)
  - `email`: Email khách hàng
  - `otp`: Mã OTP 6 chữ số
  - `status`: Trạng thái gửi (success/failed)
  - `created_at`: Thời gian tạo
  - `updated_at`: Thời gian cập nhật

### Bảng `otp_verifications`
- Lưu trữ xác thực của CS và approval của kế toán
- Các trường:
  - `id`: UUID (primary key)
  - `otp_record_id`: Liên kết với bảng otp_records
  - `email`: Email khách hàng
  - `otp`: Mã OTP
  - `verified_by`: Tên CS xác thực
  - `verified_at`: Thời gian CS xác thực
  - `approval_status`: Trạng thái approval (pending/approved/rejected)
  - `approved_by`: Tên kế toán xác nhận
  - `approved_at`: Thời gian xác nhận
  - `rejected_by`: Tên kế toán từ chối
  - `rejected_at`: Thời gian từ chối
  - `created_at`: Thời gian tạo
  - `updated_at`: Thời gian cập nhật

## Lưu ý

- Row Level Security (RLS) đã được bật nhưng hiện tại cho phép tất cả operations
- Bạn có thể tùy chỉnh policies để bảo mật hơn nếu cần
- Tất cả timestamps đều sử dụng TIMESTAMPTZ (timezone-aware)

