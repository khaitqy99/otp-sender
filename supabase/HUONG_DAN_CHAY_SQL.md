# Hướng dẫn chạy SQL cho OTP System

## Tình huống 1: Database MỚI (chưa có bảng nào)

Nếu bạn chưa tạo bảng nào trong Supabase, chạy theo thứ tự:

### Bước 1: Tạo database schema
**File:** `supabase/setup_database.sql`
- Copy toàn bộ nội dung
- Paste vào Supabase SQL Editor
- Click "Run"

### Bước 2: Bật Realtime
**File:** `supabase/enable_realtime.sql`
- Copy toàn bộ nội dung
- Paste vào Supabase SQL Editor
- Click "Run"

**XONG!** Database đã sẵn sàng.

---

## Tình huống 2: Database CŨ (đã có bảng với UUID)

Nếu bạn đã có database cũ với UUID và muốn chuyển sang ID (BIGSERIAL):

### ⚠️ CẢNH BÁO: Script này sẽ XÓA TẤT CẢ DỮ LIỆU hiện có!

### Bước 1: Backup dữ liệu (nếu cần)
Trong Supabase SQL Editor, chạy:
```sql
CREATE TABLE otp_records_backup AS SELECT * FROM otp_records;
CREATE TABLE otp_verifications_backup AS SELECT * FROM otp_verifications;
```

### Bước 2: Migration sang schema mới
**File:** `supabase/migrate_to_simple_schema.sql`
- Copy toàn bộ nội dung
- Paste vào Supabase SQL Editor
- Click "Run"
- ⚠️ Sẽ xóa tất cả dữ liệu cũ và tạo lại bảng mới

### Bước 3: Bật Realtime
**File:** `supabase/enable_realtime.sql`
- Copy toàn bộ nội dung
- Paste vào Supabase SQL Editor
- Click "Run"

**XONG!** Database đã được migrate.

---

## Tóm tắt nhanh

| Tình huống | File cần chạy | Thứ tự |
|------------|---------------|--------|
| Database mới | `setup_database.sql` → `enable_realtime.sql` | 1, 2 |
| Database cũ (muốn giữ dữ liệu) | **KHÔNG NÊN** chạy migration | - |
| Database cũ (OK xóa dữ liệu) | `migrate_to_simple_schema.sql` → `enable_realtime.sql` | 1, 2 |

---

## Kiểm tra sau khi chạy

Chạy query này để kiểm tra:
```sql
-- Kiểm tra bảng đã được tạo
SELECT * FROM public.otp_records LIMIT 1;
SELECT * FROM public.otp_verifications LIMIT 1;

-- Kiểm tra Realtime đã bật
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Xem dashboard
SELECT * FROM public.v_otp_dashboard;
```

---

## Lưu ý

- **Nếu database mới:** Chỉ cần chạy `setup_database.sql` + `enable_realtime.sql`
- **Nếu database cũ:** Cân nhắc kỹ trước khi chạy `migrate_to_simple_schema.sql` vì sẽ mất dữ liệu
- **Sau khi chạy:** Đảm bảo chạy `enable_realtime.sql` để bật realtime

