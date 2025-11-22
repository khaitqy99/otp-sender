# Hướng dẫn Debug Webhook Resend

## Vấn đề
Email bị bounce trên Resend nhưng UI vẫn hiển thị "gửi thành công".

## Các bước kiểm tra

### 1. Kiểm tra Webhook có được cấu hình trên Resend không

1. Đăng nhập vào Resend Dashboard: https://resend.com
2. Vào **Settings** → **Webhooks**
3. Kiểm tra xem có webhook nào được cấu hình chưa
4. Webhook URL phải là: `https://[your-project-id].supabase.co/functions/v1/resend-webhook`
5. Events cần chọn:
   - ✅ `email.bounced`
   - ✅ `email.complained`
   - ✅ `email.delivered` (optional)
   - ✅ `email.sent` (optional)

### 2. Kiểm tra Logs của Webhook Function

1. Vào Supabase Dashboard
2. Vào **Edge Functions** → **resend-webhook**
3. Xem **Logs** tab
4. Tìm các log messages:
   - `Raw webhook request:` - Xem request gốc từ Resend
   - `Parsed webhook event:` - Xem event đã parse
   - `Looking for OTP record with email_id:` - Xem email_id và email
   - `Found X records by resend_email_id:` - Xem có tìm thấy record không
   - `Successfully updated OTP record` - Xem có cập nhật thành công không

### 3. Kiểm tra resend_email_id có được lưu đúng không

Chạy query này trong Supabase SQL Editor:

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
ORDER BY created_at DESC
LIMIT 10;
```

Kiểm tra:
- `resend_email_id` có giá trị không (không phải NULL)?
- `status` là "success" hay "failed"?
- `error_code` và `error_reason` có giá trị không?

### 4. Test Webhook thủ công

Nếu webhook chưa được gọi, bạn có thể test thủ công bằng cách:

1. Lấy một `resend_email_id` từ database
2. Tạo một test webhook event:

```bash
curl -X POST https://[your-project-id].supabase.co/functions/v1/resend-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.bounced",
    "data": {
      "email_id": "YOUR_RESEND_EMAIL_ID_HERE",
      "to": ["test@example.com"],
      "from": "finance@y99.vn",
      "subject": "Test",
      "reason": "The recipient'\''s mail server permanently rejected the email.",
      "bounce_type": "hard"
    }
  }'
```

### 5. Kiểm tra Realtime Subscription

UI sử dụng Realtime để tự động cập nhật. Kiểm tra:
- Browser Console có lỗi gì không?
- Realtime connection có active không?

### 6. Các vấn đề thường gặp

#### Vấn đề 1: Webhook không được gọi
**Nguyên nhân:** Webhook chưa được cấu hình trên Resend hoặc URL sai
**Giải pháp:** Cấu hình lại webhook trên Resend Dashboard

#### Vấn đề 2: Không tìm thấy OTP record
**Nguyên nhân:** `resend_email_id` không khớp hoặc email không khớp
**Giải pháp:** 
- Kiểm tra logs để xem `email_id` từ webhook có khớp với `resend_email_id` trong database không
- Webhook đã có fallback search theo email trong 2 giờ gần nhất

#### Vấn đề 3: Webhook được gọi nhưng không cập nhật
**Nguyên nhân:** Event type không đúng hoặc logic update có vấn đề
**Giải pháp:** 
- Kiểm tra logs để xem event type là gì
- Webhook đã hỗ trợ nhiều format event type: `email.bounced`, `bounced`, etc.

#### Vấn đề 4: UI không cập nhật sau khi webhook cập nhật
**Nguyên nhân:** Realtime subscription không hoạt động
**Giải pháp:** 
- Refresh trang
- Kiểm tra Realtime connection trong browser console

## Debug Steps

1. **Gửi OTP đến email không tồn tại**
2. **Kiểm tra Resend Dashboard** - Xem email có bị bounce không
3. **Kiểm tra Supabase Logs** - Xem webhook có được gọi không
4. **Kiểm tra Database** - Xem status có được cập nhật thành "failed" không
5. **Kiểm tra UI** - Refresh và xem có hiển thị "failed" không

## Logs quan trọng cần tìm

```
✅ "Received Resend webhook event: email.bounced [email_id]"
✅ "Looking for OTP record with email_id: [id], email: [email]"
✅ "Found 1 records by resend_email_id: [id]"
✅ "Processing event type: email.bounced"
✅ "Successfully updated OTP record [id]"
```

Nếu không thấy các logs này, webhook có thể chưa được gọi hoặc có lỗi.

