# 📋 LOGIC CHUYỂN TRẠNG THÁI OTP - TỔNG HỢP

## 🎯 Tổng quan hệ thống

Hệ thống OTP có 2 loại trạng thái chính:

### 1. **OTP Status** (Trạng thái gửi email)
- `success`: Gửi email OTP thành công
- `failed`: Gửi email OTP thất bại

### 2. **Approval Status** (Trạng thái xác thực)
- `pending`: Chờ kế toán xử lý
- `approved`: Kế toán đã xác nhận
- `rejected`: Kế toán từ chối
- `expired`: OTP đã hết hạn (quá 30 phút)
- `locked`: OTP bị khóa do nhập sai ≥ 3 lần

---

## 🔄 Luồng chuyển trạng thái

### **Bước 1: Kế toán gửi OTP** (`/` - Index.tsx)

```
[Kế toán nhập email] 
    ↓
[Gửi OTP qua Gmail]
    ↓
┌─────────────┬──────────────┐
│  Thành công │  Thất bại    │
│  status:    │  status:     │
│  'success'  │  'failed'    │
└─────────────┴──────────────┘
    ↓
[Lưu vào otp_records]
    ↓
[Tự động tạo expires_at = created_at + 30 phút]
    ↓
[Hiển thị OTP mới nhất trong lịch sử]
```

**File liên quan:**
- `src/components/OtpForm.tsx` (dòng 26-100)
- `src/pages/Index.tsx` (dòng 47-103)

---

### **Bước 2: CS xác thực OTP** (`/cs-verify` - CsVerify.tsx)

```
[CS nhập email + OTP từ khách hàng]
    ↓
[Tìm OTP record mới nhất theo email]
    ↓
┌──────── Kiểm tra tính hợp lệ ────────┐
│                                       │
│  1. OTP đã hết hạn? (> 30 phút)      │
│     → Toast error "OTP đã hết hạn"   │
│     → Dừng                            │
│                                       │
│  2. Đã nhập sai ≥ 3 lần?             │
│     → Toast error "OTP đã bị khóa"   │
│     → Dừng                            │
│                                       │
│  3. OTP không đúng?                   │
│     → Lưu vào otp_failed_attempts    │
│     → Đếm số lần sai (1/3, 2/3, 3/3) │
│     → Nếu = 3: Khóa OTP              │
│     → Toast thông báo số lần còn lại │
│     → Dừng                            │
│                                       │
│  4. OTP đúng:                         │
│     → Kiểm tra đã verify chưa?       │
│     → Nếu chưa: Tạo verification     │
│        với approval_status='pending' │
│     → Nếu rồi: Toast warning         │
│                                       │
└───────────────────────────────────────┘
```

**File liên quan:**
- `src/components/CsVerifyOtp.tsx` (dòng 84-221)

**Các kiểm tra quan trọng:**
- Dòng 122-128: Kiểm tra expired
- Dòng 132-143: Kiểm tra locked (≥ 3 failed attempts)
- Dòng 146-167: Xử lý OTP sai
- Dòng 181-191: Kiểm tra đã verify chưa
- Dòng 194-210: Tạo verification mới

---

### **Bước 3: Kế toán xác nhận/từ chối** (`/accountant` - Accountant.tsx)

```
[Load danh sách OTP đã verify]
    ↓
┌──────── Auto check expired/locked ────────┐
│  Mỗi 1 phút hoặc khi có thay đổi:         │
│                                            │
│  1. Tìm verifications với:                │
│     - approval_status = 'pending'         │
│     - expires_at < now                    │
│     → Cập nhật: approval_status='expired' │
│                                            │
│  2. Tìm verifications với:                │
│     - approval_status = 'pending'         │
│     - failed_attempts ≥ 3                 │
│     → Cập nhật: approval_status='locked'  │
│                                            │
└────────────────────────────────────────────┘
    ↓
[Hiển thị danh sách với các trạng thái]
    ↓
┌──────── Kế toán thao tác ──────────┐
│                                     │
│  Nếu trạng thái = 'pending':       │
│                                     │
│  [Xác nhận] → approval_status =    │
│               'approved'            │
│               + approved_by         │
│               + approved_at         │
│                                     │
│  [Từ chối] → approval_status =     │
│              'rejected'             │
│              + rejected_by          │
│              + rejected_at          │
│                                     │
└─────────────────────────────────────┘
```

**File liên quan:**
- `src/pages/Accountant.tsx`
- Dòng 72-134: `autoRejectExpiredOtps()`
- Dòng 136-230: `loadHistory()` - Load OTP chưa xử lý
- Dòng 232-439: `loadVerifiedOtps()` - Load OTP đã verify
- Dòng 501-534: `handleApprove()`
- Dòng 536-569: `handleReject()`

---

## 📊 Các bảng Database

### **1. otp_records**
Lưu trữ OTP được gửi bởi kế toán

```sql
CREATE TABLE otp_records (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    status otp_status NOT NULL,       -- 'success' | 'failed'
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ            -- Auto set = created_at + 30 phút
);
```

### **2. otp_verifications**
Lưu trữ xác thực của CS và approval của kế toán

```sql
CREATE TABLE otp_verifications (
    id BIGSERIAL PRIMARY KEY,
    otp_record_id BIGINT REFERENCES otp_records(id),
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    verified_by TEXT NOT NULL,        -- Tên CS
    verified_at TIMESTAMPTZ NOT NULL,
    approval_status approval_status,  -- 'pending' | 'approved' | 'rejected' | 'expired' | 'locked'
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejected_by TEXT,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);
```

### **3. otp_failed_attempts**
Lưu trữ các lần nhập sai OTP

```sql
CREATE TABLE otp_failed_attempts (
    id BIGSERIAL PRIMARY KEY,
    otp_record_id BIGINT REFERENCES otp_records(id),
    email TEXT NOT NULL,
    attempted_otp TEXT NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
```

---

## 🔐 Quy tắc chuyển trạng thái

### **Trạng thái OTP (otp_records.status)**
- Không thay đổi sau khi tạo
- `success`: Email gửi thành công
- `failed`: Email gửi thất bại

### **Trạng thái Approval (otp_verifications.approval_status)**

#### **pending → expired**
- **Điều kiện:** `expires_at < now` (quá 30 phút)
- **Khi nào:** 
  - Auto check mỗi 1 phút trong Accountant
  - Khi load dữ liệu
  - Trước khi CS verify
- **Hành động:** 
  - Set `approval_status = 'expired'`
  - Set `rejected_by = 'system'`
  - Set `rejected_at = now`

#### **pending → locked**
- **Điều kiện:** Có ≥ 3 bản ghi trong `otp_failed_attempts` cho `otp_record_id` này
- **Khi nào:**
  - Khi CS nhập sai lần thứ 3
  - Auto check mỗi 1 phút trong Accountant
- **Hành động:**
  - Set `approval_status = 'locked'`
  - Set `rejected_by = 'system'`
  - Set `rejected_at = thời điểm lần thứ 3`

#### **pending → approved**
- **Điều kiện:** Kế toán click "Xác nhận"
- **Yêu cầu:** Kế toán phải nhập tên
- **Hành động:**
  - Set `approval_status = 'approved'`
  - Set `approved_by = tên kế toán`
  - Set `approved_at = now`

#### **pending → rejected**
- **Điều kiện:** Kế toán click "Từ chối"
- **Yêu cầu:** Kế toán phải nhập tên
- **Hành động:**
  - Set `approval_status = 'rejected'`
  - Set `rejected_by = tên kế toán`
  - Set `rejected_at = now`

---

## ✅ Các sửa đổi đã thực hiện

### **1. Đồng bộ Interface** ✅
**File:** `src/pages/Index.tsx`

**Trước:**
```typescript
export interface OtpRecord {
  id: number;
  email: string;
  otp: string;
  timestamp: Date;
  status: "success" | "failed";
}
```

**Sau:**
```typescript
export interface OtpRecord {
  id: number;
  email: string;
  otp: string;
  timestamp: Date;
  status: "success" | "failed";
  expiresAt?: Date;           // ✅ Thêm
  lockedAt?: Date;            // ✅ Thêm
  failedAttemptsCount?: number; // ✅ Thêm
}
```

### **2. Load đầy đủ dữ liệu** ✅
**File:** `src/pages/Index.tsx` - `loadHistory()`

**Cải thiện:**
- Load `otp_failed_attempts` để đếm số lần nhập sai
- Tính toán `lockedAt` (thời điểm lần nhập sai thứ 3)
- Load `expires_at` từ database
- Đồng bộ với Accountant.tsx

### **3. Sửa logic locked không nhất quán** ✅
**File:** `src/components/CsVerifyOtp.tsx`

**Vấn đề:** 
- Code cũ cố gắng update `approval_status = 'locked'` cho verification chưa tồn tại
- Gây lỗi logic

**Sửa:**
```typescript
// ❌ Code cũ:
if (newFailedCount >= 3) {
  await supabase
    .from("otp_verifications")
    .update({ approval_status: "locked" })
    .eq("otp_record_id", otpRecord.id)
    .eq("approval_status", "pending");
}

// ✅ Code mới:
if (newFailedCount >= 3) {
  toast.error("Mã OTP sai. Đã nhập sai 3 lần, OTP đã bị khóa");
}
// Không cần update vì verification chưa tồn tại
// Logic locked sẽ được xử lý trong Accountant khi load dữ liệu
```

### **4. Xử lý dữ liệu an toàn hơn** ✅
**File:** `src/components/OtpHistory.tsx`

**Cải thiện:**
- Chỉ hiển thị `expiresAt`, `lockedAt`, `failedAttemptsCount` khi `status === "success"`
- Tránh hiển thị thông tin không liên quan cho OTP failed
- Kiểm tra `failedAttemptsCount > 0` trước khi hiển thị

**Code:**
```typescript
{latestOtp.expiresAt && latestOtp.status === "success" && (
  // Hiển thị thời gian còn lại
)}
{latestOtp.lockedAt && latestOtp.status === "success" && (
  // Hiển thị trạng thái khóa
)}
{latestOtp.failedAttemptsCount > 0 && !latestOtp.lockedAt && latestOtp.status === "success" && (
  // Hiển thị số lần nhập sai
)}
```

---

## 🎨 UI Components và hiển thị

### **1. Index Page (Kế toán gửi OTP)**
- **Form gửi OTP:** `OtpForm.tsx`
- **Lịch sử OTP mới nhất:** `OtpHistory.tsx`
  - Hiển thị OTP vừa gửi
  - Countdown thời gian còn lại
  - Số lần nhập sai (nếu có)
  - Trạng thái khóa (nếu có)

### **2. CS Verify Page (CS xác thực OTP)**
- **Form xác thực:** `CsVerifyOtp.tsx`
  - Nhập email, OTP, tên CS
  - Kiểm tra tính hợp lệ
  - Tạo verification record
- **Lịch sử xác thực:** Hiển thị 10 verification gần đây

### **3. Accountant Page (Kế toán quản lý)**
- **Phần gửi OTP:** Giống Index
- **Danh sách OTP đã verify:**
  - Filter theo trạng thái
  - Tìm kiếm theo email
  - Xác nhận/Từ chối
  - Hiển thị đầy đủ thông tin

---

## 🔍 Các kiểm tra quan trọng

### **Khi CS verify OTP:**
1. ✅ Tìm OTP record mới nhất theo email
2. ✅ Kiểm tra `expires_at < now` → Hết hạn
3. ✅ Kiểm tra `failed_attempts >= 3` → Bị khóa
4. ✅ Kiểm tra OTP đúng/sai
5. ✅ Nếu sai: Lưu `otp_failed_attempts` và đếm
6. ✅ Nếu đúng: Kiểm tra đã verify chưa → Tạo mới hoặc cảnh báo

### **Khi Accountant load dữ liệu:**
1. ✅ Auto check expired: `expires_at < now` → Set `approval_status = 'expired'`
2. ✅ Auto check locked: `failed_attempts >= 3` → Set `approval_status = 'locked'`
3. ✅ Load `otp_records` chưa có verification hoặc verification đang pending
4. ✅ Load tất cả `otp_verifications` để hiển thị
5. ✅ Load `otp_failed_attempts` để tính số lần nhập sai

### **Khi Accountant approve/reject:**
1. ✅ Kiểm tra có nhập tên kế toán chưa
2. ✅ Không xử lý virtual records (ID âm)
3. ✅ Update `approval_status` và các trường liên quan
4. ✅ Reload dữ liệu để cập nhật UI

---

## 🚀 Realtime Updates

### **Supabase Realtime:**
- **Index:** Subscribe `otp_records` → Reload khi có OTP mới
- **CsVerify:** Subscribe `otp_verifications` → Reload lịch sử
- **Accountant:** Subscribe cả 2 bảng → Reload tất cả

### **Auto check định kỳ:**
- Mỗi 1 phút trong Accountant: `autoRejectExpiredOtps()`
- Kiểm tra và chuyển trạng thái expired/locked

---

## 📝 Tóm tắt

### **Logic đồng bộ và nhất quán:**
✅ Interface đã được đồng bộ giữa các component
✅ Load đầy đủ dữ liệu (expires_at, locked_at, failed_attempts)
✅ Logic chuyển trạng thái rõ ràng và nhất quán
✅ Xử lý dữ liệu an toàn, tránh lỗi UI
✅ Auto check expired/locked định kỳ
✅ Realtime updates đầy đủ

### **Các trạng thái cuối cùng:**
- `pending` → Chờ kế toán xử lý (có thể approve/reject)
- `approved` → Đã xác nhận (cuối)
- `rejected` → Đã từ chối (cuối)
- `expired` → Đã hết hạn (cuối)
- `locked` → Đã bị khóa (cuối)

### **Không có chuyển ngược:**
- Các trạng thái cuối (`approved`, `rejected`, `expired`, `locked`) không thể chuyển về `pending`
- `pending` có thể chuyển sang bất kỳ trạng thái nào trong 4 trạng thái cuối

---

## 🎯 Checklist hoàn thành

- [x] Đồng bộ interface OtpRecord
- [x] Load đầy đủ dữ liệu (expires_at, locked_at, failed_attempts)
- [x] Sửa logic locked không nhất quán
- [x] Xử lý dữ liệu an toàn trong UI
- [x] Không có lỗi linter
- [x] Logic chuyển trạng thái rõ ràng và nhất quán

**✅ Hệ thống OTP đã được kiểm tra và đảm bảo đồng bộ, nhất quán!**

