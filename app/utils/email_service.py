import os
import re
from dataclasses import dataclass
from typing import Optional, Tuple
import requests
from flask import current_app


@dataclass
class EmailDeliveryResult:
    success: bool
    provider: Optional[str]
    status: str  # "delivered", "failed", "unconfigured", "skipped"
    message: str
    message_id: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "provider": self.provider,
            "status": self.status,
            "message": self.message,
            "message_id": self.message_id,
            "error": self.error,
        }


def get_active_email_provider() -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (provider_name, api_key) based on environment configuration.
    Supported providers: 'resend', 'brevo'.
    """
    explicit_provider = (os.getenv("EMAIL_PROVIDER") or "").strip().lower()
    resend_key = (os.getenv("RESEND_API_KEY") or "").strip()
    brevo_key = (os.getenv("BREVO_API_KEY") or "").strip()

    if explicit_provider == "resend":
        return ("resend", resend_key) if resend_key else ("resend", None)
    if explicit_provider == "brevo":
        return ("brevo", brevo_key) if brevo_key else ("brevo", None)

    # Auto-detect if not explicitly specified
    if resend_key:
        return ("resend", resend_key)
    if brevo_key:
        return ("brevo", brevo_key)

    return (None, None)


def build_activation_email_content(
    patient_name: str, activation_url: str, expires_in_hours: int = 48
) -> Tuple[str, str, str]:
    """
    Generates subject, HTML body, and plain-text body for patient account activation.
    """
    display_name = patient_name.strip() or "Valued Patient"
    subject = "Activate Your CirrhoCare AI Patient Portal Account"

    text_body = f"""Hello {display_name},

A patient portal account has been prepared for you in the CirrhoCare AI Clinical System.

To activate your account and set your own secure password, please visit the link below:
{activation_url}

Important Security Notices:
- This single-use activation link expires in {expires_in_hours} hours.
- CirrhoCare AI and your clinical care team will NEVER email you asking for your password.
- If you did not request this invitation or believe it was sent in error, please contact your clinic administrator.

Sincerely,
CirrhoCare AI Clinical Team
"""

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
    }}
    .wrapper {{
      max-width: 580px;
      margin: 32px auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
      border: 1px solid #e2e8f0;
    }}
    .header {{
      background: linear-gradient(135deg, #0b132b 0%, #1e293b 100%);
      padding: 32px 36px;
      text-align: left;
    }}
    .brand {{
      color: #ffffff;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
    }}
    .brand-pill {{
      display: inline-block;
      background: rgba(59, 130, 246, 0.25);
      border: 1px solid rgba(96, 165, 250, 0.4);
      color: #93c5fd;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      margin-left: 6px;
    }}
    .subtitle {{
      color: #94a3b8;
      font-size: 12px;
      margin-top: 4px;
      font-weight: 500;
    }}
    .body {{
      padding: 36px;
    }}
    h1 {{
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 16px 0;
    }}
    p {{
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      margin: 0 0 16px 0;
    }}
    .cta-container {{
      text-align: center;
      margin: 32px 0;
    }}
    .btn {{
      display: inline-block;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 14px 28px;
      border-radius: 10px;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
    }}
    .raw-url {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 12px;
      border-radius: 8px;
      font-size: 11px;
      color: #64748b;
      word-break: break-all;
      margin-bottom: 24px;
    }}
    .security-callout {{
      background-color: #f0fdf4;
      border-left: 4px solid #16a34a;
      padding: 14px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 12px;
      color: #166534;
      margin: 24px 0 0 0;
      line-height: 1.5;
    }}
    .footer {{
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 36px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h2 class="brand">CirrhoCare<span class="brand-pill">AI</span></h2>
      <div class="subtitle">Clinical Intelligence & Liver Disease Surveillance</div>
    </div>
    <div class="body">
      <h1>Activate Your Patient Account</h1>
      <p>Dear <strong>{display_name}</strong>,</p>
      <p>
        An authorized clinical care specialist has registered your patient profile in the 
        <strong>CirrhoCare AI</strong> patient portal. To securely access your diagnostic reports, 
        prescriptions, and AI-assisted clinical progress, please set your personal password below:
      </p>

      <div class="cta-container">
        <a href="{activation_url}" class="btn" target="_blank">Set Password & Activate Account</a>
      </div>

      <p style="font-size: 12px; color: #64748b; margin-bottom: 6px;">
        If the button does not open, copy and paste this secure link into your browser:
      </p>
      <div class="raw-url">{activation_url}</div>

      <div class="security-callout">
        <strong>Security & Privacy Safeguard:</strong> This activation link is single-use and valid for {expires_in_hours} hours.
        CirrhoCare AI will never send you unsolicited requests for your password.
      </div>
    </div>
    <div class="footer">
      This is a transactional clinical notification sent on behalf of your care team.<br>
      © CirrhoCare AI Healthcare Systems. All rights reserved.
    </div>
  </div>
</body>
</html>
"""
    return subject, html_body, text_body


def send_patient_activation_email(
    patient_name: str,
    recipient_email: str,
    activation_url: str,
    expires_in_hours: int = 48,
    timeout_seconds: int = 10,
) -> EmailDeliveryResult:
    """
    Sends activation email via configured transactional email service (Resend or Brevo).
    Ensures that delivery is only marked successful if confirmed by provider API.
    """
    cleaned_email = (recipient_email or "").strip().lower()

    if not cleaned_email or "@carepatient.com" in cleaned_email:
        return EmailDeliveryResult(
            success=False,
            provider=None,
            status="skipped",
            message="No valid personal email address provided for patient.",
            error="Missing or placeholder email address.",
        )

    provider, api_key = get_active_email_provider()

    if not provider or not api_key:
        provider_name = provider or "Resend / Brevo"
        return EmailDeliveryResult(
            success=False,
            provider=provider,
            status="unconfigured",
            message=f"Transactional email provider is not configured ({provider_name} API key missing). Set RESEND_API_KEY or BREVO_API_KEY in environment variables.",
            error="Provider API key not configured",
        )

    subject, html_body, text_body = build_activation_email_content(
        patient_name, activation_url, expires_in_hours
    )

    if provider == "resend":
        from_email = os.getenv("RESEND_FROM_EMAIL", "CirrhoCare AI <onboarding@resend.dev>").strip()
        payload = {
            "from": from_email,
            "to": [cleaned_email],
            "subject": subject,
            "html": html_body,
            "text": text_body,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        try:
            res = requests.post(
                "https://api.resend.com/emails",
                json=payload,
                headers=headers,
                timeout=timeout_seconds,
            )
            if res.status_code in (200, 201):
                data = res.json()
                message_id = data.get("id")
                return EmailDeliveryResult(
                    success=True,
                    provider="resend",
                    status="delivered",
                    message=f"Activation email successfully accepted by Resend for {cleaned_email}.",
                    message_id=message_id,
                )
            else:
                err_text = res.text
                return EmailDeliveryResult(
                    success=False,
                    provider="resend",
                    status="failed",
                    message=f"Resend rejected email dispatch (HTTP {res.status_code}): {err_text}",
                    error=err_text,
                )
        except requests.RequestException as exc:
            return EmailDeliveryResult(
                success=False,
                provider="resend",
                status="failed",
                message=f"Network error communicating with Resend: {str(exc)}",
                error=str(exc),
            )

    if provider == "brevo":
        from_email = os.getenv("BREVO_FROM_EMAIL", "no-reply@cirrhocare.ai").strip()
        payload = {
            "sender": {"name": "CirrhoCare AI", "email": from_email},
            "to": [{"email": cleaned_email, "name": patient_name}],
            "subject": subject,
            "htmlContent": html_body,
            "textContent": text_body,
        }
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        try:
            res = requests.post(
                "https://api.brevo.com/v3/smtp/email",
                json=payload,
                headers=headers,
                timeout=timeout_seconds,
            )
            if res.status_code in (200, 201):
                data = res.json()
                message_id = data.get("messageId")
                return EmailDeliveryResult(
                    success=True,
                    provider="brevo",
                    status="delivered",
                    message=f"Activation email successfully accepted by Brevo for {cleaned_email}.",
                    message_id=message_id,
                )
            else:
                err_text = res.text
                return EmailDeliveryResult(
                    success=False,
                    provider="brevo",
                    status="failed",
                    message=f"Brevo rejected email dispatch (HTTP {res.status_code}): {err_text}",
                    error=err_text,
                )
        except requests.RequestException as exc:
            return EmailDeliveryResult(
                success=False,
                provider="brevo",
                status="failed",
                message=f"Network error communicating with Brevo: {str(exc)}",
                error=str(exc),
            )

    return EmailDeliveryResult(
        success=False,
        provider=provider,
        status="unconfigured",
        message=f"Unsupported email provider: {provider}",
        error="Unsupported provider",
    )
