from django.db import models
from django.contrib.auth.models import User
from apps.digital_twin.models import CityZone, FloodPrediction

class Alert(models.Model):
    SEVERITY_CHOICES = [
        ('low', 'Low Advisory'),
        ('medium', 'Medium Warning'),
        ('high', 'High Flood Alert'),
        ('critical', 'Critical Disaster Emergency'),
    ]

    zone = models.ForeignKey(CityZone, on_delete=models.PROTECT, related_name='alerts')
    prediction = models.ForeignKey(FloodPrediction, on_delete=models.SET_NULL, null=True, blank=True, related_name='alerts')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')
    message = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)
    acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    sms_sent = models.BooleanField(default=False)
    email_sent = models.BooleanField(default=False)
    target_recipients = models.CharField(max_length=255, blank=True, default='NDMA, Chennai Corp, Rescue Unit 4')

    class Meta:
        ordering = ['-sent_at']

    def __str__(self):
        return f"[{self.severity.upper()}] {self.zone.name}: {self.message[:40]}... ({'Acked' if self.acknowledged else 'Pending'})"


class AgentDecisionLog(models.Model):
    DECISION_CHOICES = [
        ('alert', 'Trigger Public & Emergency Alert'),
        ('resimulate', 'Re-Simulate with Alternative Parameters'),
        ('log_only', 'Log Only (Below Threshold)'),
        ('escalate', 'Escalate to Disaster Command HQ'),
    ]

    prediction = models.ForeignKey(FloodPrediction, on_delete=models.SET_NULL, null=True, blank=True, related_name='decision_logs')
    decision = models.CharField(max_length=20, choices=DECISION_CHOICES, default='log_only')
    reasoning_text = models.TextField()
    triggered_via = models.CharField(max_length=50, default='autonomous', help_text="autonomous, chat, or manual")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['prediction', '-timestamp']),
        ]

    def __str__(self):
        pred_label = f"Pred #{self.prediction.id}" if self.prediction else "General"
        return f"Decision: {self.decision} on {pred_label} ({self.triggered_via}) @ {self.timestamp.strftime('%H:%M:%S')}"

