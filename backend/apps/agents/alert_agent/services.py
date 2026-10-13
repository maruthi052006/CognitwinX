import os
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def dispatch_sms_alert(phone_number: str, message: str) -> bool:
    """
    Dispatches SMS alert via Twilio REST API.
    Supports:
      1. Twilio API Key authentication (API Key SID 'SK...' + API Secret + Account SID)
      2. Standard Account SID + Auth Token authentication
      3. Graceful simulation/demo fallback if unconfigured
    """
    account_sid = str(getattr(settings, 'TWILIO_ACCOUNT_SID', '') or '').strip()
    auth_token = str(getattr(settings, 'TWILIO_AUTH_TOKEN', '') or '').strip()
    api_key_sid = str(getattr(settings, 'TWILIO_API_KEY_SID', '') or '').strip()
    api_key_secret = str(getattr(settings, 'TWILIO_API_KEY_SECRET', '') or '').strip()
    from_number = str(getattr(settings, 'TWILIO_PHONE_NUMBER', '+15551234567') or '').strip()
    enabled = getattr(settings, 'TWILIO_ENABLED', False)

    if not enabled:
        logger.info(f"[SMS DISPATCH - SIMULATED (TWILIO_ENABLED=False)] To: {phone_number} | Msg: {message}")
        return True

    try:
        from twilio.rest import Client

        # Twilio API Key authentication requires API Key SID + API Secret + Account SID
        if api_key_sid and api_key_secret and account_sid:
            client = Client(username=api_key_sid, password=api_key_secret, account_sid=account_sid)
        elif account_sid and auth_token and not account_sid.startswith('MOCK_'):
            client = Client(account_sid, auth_token)
        else:
            logger.warning(
                f"[SMS DISPATCH - INCOMPLETE CREDENTIALS] Twilio is enabled, but required credentials are incomplete "
                f"(API Key SID '{api_key_sid[:6]}...' present, requires TWILIO_API_KEY_SECRET & TWILIO_ACCOUNT_SID). "
                f"Simulating dispatch to {phone_number} | Msg: {message}"
            )
            return True

        client.http_client.timeout = 5.0
        msg = client.messages.create(
            body=message,
            from_=from_number,
            to=phone_number
        )
        logger.info(f"[SMS DISPATCH - TWILIO SUCCESS] Message SID: {msg.sid} dispatched to {phone_number}")
        return True
    except Exception as e:
        logger.error(f"[SMS DISPATCH - ERROR] Twilio dispatch failed: {e}")
        return False

def dispatch_email_alert(recipient: str, subject: str, body: str) -> bool:
    """
    Sends emergency advisory email via Django mail backend.
    """
    try:
        from django.core.mail import send_mail
        send_mail(
            subject=subject,
            message=body,
            from_email='alerts@cognitwin.gov.in',
            recipient_list=[recipient],
            fail_silently=True
        )
        logger.info(f"[EMAIL DISPATCH] Alert sent to {recipient}")
        return True
    except Exception as e:
        logger.warning(f"[EMAIL DISPATCH - SKIPPED] {e}")
        return False
