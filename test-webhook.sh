#!/bin/bash

# Script để test webhook thủ công
# Sử dụng: ./test-webhook.sh <resend_email_id> <email>

RESEND_EMAIL_ID=$1
EMAIL=${2:-"test@example.com"}
PROJECT_ID="xeliuljgfwjygzdumzyv"
WEBHOOK_URL="https://${PROJECT_ID}.supabase.co/functions/v1/resend-webhook"

echo "Testing webhook with:"
echo "  Email ID: $RESEND_EMAIL_ID"
echo "  Email: $EMAIL"
echo "  URL: $WEBHOOK_URL"
echo ""

# Test với email.failed event
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"email.failed\",
    \"created_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"email_id\": \"$RESEND_EMAIL_ID\",
      \"from\": \"finance@y99.vn\",
      \"to\": [\"$EMAIL\"],
      \"subject\": \"Test OTP\",
      \"created_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"error\": {
        \"code\": \"550\",
        \"message\": \"The recipient's mail server permanently rejected the email.\"
      },
      \"reason\": \"The recipient's mail server permanently rejected the email.\"
    }
  }"

echo ""
echo ""
echo "Check Supabase logs to see if webhook was processed."

