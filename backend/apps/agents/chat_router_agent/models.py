from django.db import models
from django.conf import settings
from apps.digital_twin.models import CityZone

class ChatSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_sessions")
    zone_context = models.ForeignKey(CityZone, null=True, blank=True, on_delete=models.SET_NULL)
    pending_confirmation = models.JSONField(null=True, blank=True, help_text="Stores unconfirmed side-effect action state (e.g. trigger_alert)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        zone_str = f" - {self.zone_context.name}" if self.zone_context else ""
        return f"ChatSession #{self.id} ({self.user.username}{zone_str})"

class ChatMessage(models.Model):
    ROLE_CHOICES = [
        ("user", "User"),
        ("twin", "Twin"),
    ]

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    tool_calls_made = models.JSONField(null=True, blank=True, help_text="Audit trail of which agents/tools were invoked")
    requires_confirmation = models.BooleanField(default=False)
    confirmation_payload = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"[{self.role.upper()}] Session #{self.session.id}: {self.content[:40]}"
