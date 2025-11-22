# Hướng dẫn Debug - Email bị bounce nhưng vẫn hiển thị "gửi thành công"

## Tình huống
Đã gửi OTP đến `khaitq.it@y9999.vn` (email không tồn tại) nhưng UI vẫn hiển thị "gửi thành công".

## Nguyên nhân
Resend API chấp nhận email ngay khi format hợp lệ, nên trả về "success" ngay lập tức. Webhook `email.failed` sẽ được gửi sau khi Resend phát hiện email không tồn tại (có thể mất vài phút).

## Các bước kiểm tra

### Bước 1: Kiểm tra resend_email_id có được lưu không

1. Vào Supabase Dashboard → SQL Editor
2. Chạy query:

```sql
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
ORDER BY created_at DESC
LIMIT 1;
```

**Kiểm tra:**
- ✅ `resend_email_id` có giá trị (không phải NULL) → Tiếp tục Bước 2
- ❌ `resend_email_id` là NULL → Vấn đề ở function `send-otp`, Resend không trả về email_id

### Bước 2: Kiểm tra Webhook có được gọi không

1. Vào Supabase Dashboard → Edge Functions → `resend-webhook` → Logs
2. Tìm log: `=== WEBHOOK REQUEST RECEIVED ===`
3. Kiểm tra thời gian: Webhook có thể mất 1-5 phút sau khi gửi email

**Nếu thấy log:**
- ✅ Có log → Webhook đã được gọi, kiểm tra xem có cập nhật status không
- ❌ Không thấy log → Webhook chưa được gọi từ Resend

### Bước 3: Kiểm tra Webhook URL trên Resend

1. Đăng nhập Resend Dashboard: https://resend.com
2. Vào **Settings** → **Webhooks**
3. Kiểm tra:
   - ✅ Webhook URL: `https://xeliuljgfwjygzdumzyv.supabase.co/functions/v1/resend-webhook`
   - ✅ Events đã chọn: `email.failed`, `email.bounced`
   - ✅ Webhook status: Active

**Nếu webhook chưa được cấu hình:**
- Tạo webhook mới với URL trên
- Chọn events: `email.failed`, `email.bounced`, `email.complained`

### Bước 4: Test Webhook thủ công

Nếu có `resend_email_id`, test webhook thủ công:

**Cách 1: Dùng script (Linux/Mac)**
```bash
chmod +x test-webhook.sh
./test-webhook.sh <resend_email_id> khaitq.it@y9999.vn
```

**Cách 2: Dùng curl trực tiếp**
```bash
curl -X POST https://xeliuljgfwjygzdumzyv.supabase.co/functions/v1/resend-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.failed",
    "created_at": "2024-01-01T00:00:00Z",
    "data": {
      "email_id": "YOUR_RESEND_EMAIL_ID_HERE",
      "from": "finance@y99.vn",
      "to": ["khaitq.it@y9999.vn"],
      "subject": "Xác thực Email - Mã OTP từ Doanh Nghiệp Tư Nhân Y99",
      "created_at": "2024-01-01T00:00:00Z",
      "error": {
        "code": "550",
        "message": "The recipient'\''s mail server permanently rejected the email."
      },
      "reason": "The recipient'\''s mail server permanently rejected the email."
    }
  }'
```

**Thay `YOUR_RESEND_EMAIL_ID_HERE` bằng `resend_email_id` từ database**

### Bước 5: Kiểm tra kết quả

Sau khi test webhook, kiểm tra:

1. **Logs trong Supabase:**
   - Tìm: `Event X: Email failed/bounced for...`
   - Tìm: `Successfully updated OTP record`

2. **Database:**
   ```sql
   SELECT 
     id,
     email,
     status,
     resend_email_id,
     error_code,
     error_reason
   FROM otp_records
   WHERE email = 'khaitq.it@y9999.vn'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   
   **Kiểm tra:**
   - ✅ `status` = "failed"
   - ✅ `error_code` có giá trị
   - ✅ `error_reason` có giá trị

3. **UI:**
   - Refresh trang
   - Kiểm tra xem status có chuyển thành "failed" không

## Các vấn đề thường gặp

### Vấn đề 1: resend_email_id là NULL
**Nguyên nhân:** Resend API không trả về email_id
**Giải pháp:** 
- Kiểm tra logs của function `send-otp`
- Kiểm tra Resend API response

### Vấn đề 2: Webhook không được gọi
**Nguyên nhân:** 
- Webhook chưa được cấu hình trên Resend
- Webhook URL sai
- Resend chưa phát hiện email bị bounce (cần đợi thêm)

**Giải pháp:**
- Kiểm tra cấu hình webhook trên Resend
- Đợi thêm 5-10 phút
- Test webhook thủ công

### Vấn đề 3: Webhook được gọi nhưng không cập nhật
**Nguyên nhân:**
- Không tìm thấy OTP record
- Event type không đúng
- Lỗi trong quá trình update

**Giải pháp:**
- Kiểm tra logs để xem lỗi cụ thể
- Kiểm tra `resend_email_id` có khớp không
- Kiểm tra event type trong logs

## Liên hệ hỗ trợ

Nếu vẫn không hoạt động sau khi thực hiện các bước trên, vui lòng cung cấp:
1. Screenshot logs từ Supabase Edge Functions
2. Kết quả query SQL (ẩn thông tin nhạy cảm)
3. Screenshot cấu hình webhook trên Resend

