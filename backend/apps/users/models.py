from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('ndma_officer', 'NDMA/SDMA Officer'),
        ('public_viewer', 'Public Viewer'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='public_viewer')
    phone_number = models.CharField(max_length=20, blank=True, default='')
    agency = models.CharField(max_length=100, blank=True, default='')
    is_approved = models.BooleanField(
        default=True,
        help_text="NDMA/SDMA officers require administrative approval before elevated access"
    )

    def __str__(self):
        status = "Approved" if self.is_approved else "Pending Approval"
        return f"{self.user.username} ({self.role} - {status})"

@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    else:
        if hasattr(instance, 'profile'):
            instance.profile.save()
