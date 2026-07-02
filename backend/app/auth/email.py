from email.message import EmailMessage
import smtplib

from app.core.config import Settings


def send_verification_email(settings: Settings, *, to_email: str, code: str) -> bool:
    if not settings.smtp_host or not settings.smtp_from_email:
        return False

    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message["Subject"] = "Email verification code"
    message.set_content(
        f"Your verification code is {code}. "
        f"It expires in {settings.email_verification_expire_minutes} minutes."
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)

    return True
