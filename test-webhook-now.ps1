# PowerShell script để test webhook
$RESEND_EMAIL_ID = "88c5d2c2-2924-4a7e-acaf-405d2dc75270"
$EMAIL = "test@nonexistent123.com"
$PROJECT_ID = "xeliuljgfwjygzdumzyv"
$WEBHOOK_URL = "https://${PROJECT_ID}.supabase.co/functions/v1/webhook"

Write-Host "Testing webhook với:"
Write-Host "  Email ID: $RESEND_EMAIL_ID"
Write-Host "  Email: $EMAIL"
Write-Host "  URL: $WEBHOOK_URL"
Write-Host ""

$body = @{
    type = "email.failed"
    created_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    data = @{
        email_id = $RESEND_EMAIL_ID
        from = "finance@y99.vn"
        to = @($EMAIL)
        subject = "Xác thực Email - Mã OTP từ Doanh Nghiệp Tư Nhân Y99"
        created_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        error = @{
            code = "550"
            message = "The recipient's mail server permanently rejected the email."
        }
        reason = "The recipient's mail server permanently rejected the email."
    }
} | ConvertTo-Json -Depth 10

Write-Host "Sending webhook request..."
try {
    $response = Invoke-RestMethod -Uri $WEBHOOK_URL -Method Post -Body $body -ContentType "application/json"
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Webhook request da duoc gui!" -ForegroundColor Green
Write-Host "Bay gio hay:"
Write-Host "   1. Kiem tra logs trong Supabase Dashboard -> Edge Functions -> resend-webhook -> Logs"
Write-Host "   2. Chay lai query SQL de xem status co duoc cap nhat thanh 'failed' khong"

