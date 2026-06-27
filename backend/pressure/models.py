import uuid

from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


class UserProfile(models.Model):
    ROLE_SUPER_ADMIN = "SUPER_ADMIN"
    ROLE_COMPANY_ADMIN = "COMPANY_ADMIN"
    ROLE_OPERATOR = "OPERATOR"

    ROLE_CHOICES = [
        (ROLE_SUPER_ADMIN, "SuperAdmin"),
        (ROLE_COMPANY_ADMIN, "Company Admin"),
        (ROLE_OPERATOR, "Operator"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile"
    )

    role = models.CharField(
        max_length=30,
        choices=ROLE_CHOICES,
        default=ROLE_OPERATOR
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def has_all_access(self):
        return self.role in [
            self.ROLE_SUPER_ADMIN,
            self.ROLE_COMPANY_ADMIN,
        ]

    @property
    def can_control_device(self):
        return self.role in [
            self.ROLE_SUPER_ADMIN,
            self.ROLE_COMPANY_ADMIN,
            self.ROLE_OPERATOR,
        ]

    def __str__(self):
        return f"{self.user.username} - {self.role}"


@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        role = (
            UserProfile.ROLE_SUPER_ADMIN
            if instance.is_superuser
            else UserProfile.ROLE_OPERATOR
        )

        UserProfile.objects.create(
            user=instance,
            role=role
        )

    else:
        if hasattr(instance, "profile"):
            if instance.is_superuser and instance.profile.role != UserProfile.ROLE_SUPER_ADMIN:
                instance.profile.role = UserProfile.ROLE_SUPER_ADMIN
                instance.profile.save()


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="password_reset_otps"
    )

    email = models.EmailField()
    otp_code = models.CharField(max_length=6)
    reset_token = models.UUIDField(default=uuid.uuid4, unique=True)

    is_verified = models.BooleanField(default=False)
    is_used = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_expired(self):
        return timezone.now() > self.expires_at

    def is_valid_for_verify(self):
        return not self.is_used and not self.is_expired()

    def is_valid_for_reset(self):
        return self.is_verified and not self.is_used and not self.is_expired()

    def __str__(self):
        return f"{self.email} - OTP"


class DeviceStatus(models.Model):
    PRESSURE_CHOICES = [
        ("unknown", "Unknown"),
        ("normal", "Pressure Normal"),
        ("low", "Pressure Low"),
    ]

    DEVICE_CHOICES = [
        ("unknown", "Unknown"),
        ("off", "OFF"),
        ("on", "ON"),
    ]

    MQTT_STATUS_CHOICES = [
        ("unknown", "Unknown"),
        ("online", "Online"),
        ("offline", "Offline"),
    ]

    device_id = models.CharField(
        max_length=100,
        unique=True,
        default="esp32-001"
    )

    opto_pin = models.IntegerField(null=True, blank=True)
    relay_pin = models.IntegerField(null=True, blank=True)

    pressure_status = models.CharField(
        max_length=20,
        choices=PRESSURE_CHOICES,
        default="unknown"
    )

    device_state = models.CharField(
        max_length=20,
        choices=DEVICE_CHOICES,
        default="unknown"
    )

    mqtt_status = models.CharField(
        max_length=20,
        choices=MQTT_STATUS_CHOICES,
        default="unknown"
    )

    last_message = models.TextField(blank=True, null=True)
    last_seen = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return (
            f"{self.device_id} - "
            f"pressure={self.pressure_status} - "
            f"device={self.device_state} - "
            f"mqtt={self.mqtt_status}"
        )


class RelayActionLog(models.Model):
    ACTION_ON = "on"
    ACTION_OFF = "off"

    ACTION_CHOICES = [
        (ACTION_ON, "Turned ON"),
        (ACTION_OFF, "Turned OFF"),
    ]

    SOURCE_DASHBOARD = "dashboard"
    SOURCE_PHYSICAL_BUTTON = "physical_button"
    SOURCE_SYSTEM = "system"

    SOURCE_CHOICES = [
        (SOURCE_DASHBOARD, "Dashboard"),
        (SOURCE_PHYSICAL_BUTTON, "Physical Button"),
        (SOURCE_SYSTEM, "System"),
    ]

    STATUS_PENDING = "pending"
    STATUS_CONFIRMED = "confirmed"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_FAILED, "Failed"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="relay_actions"
    )

    device_id = models.CharField(
        max_length=100,
        default="esp32-001"
    )

    action = models.CharField(
        max_length=10,
        choices=ACTION_CHOICES
    )

    source = models.CharField(
        max_length=30,
        choices=SOURCE_CHOICES,
        default=SOURCE_DASHBOARD
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )

    actor_username = models.CharField(max_length=150, blank=True)
    actor_full_name = models.CharField(max_length=255, blank=True)
    actor_role = models.CharField(max_length=50, blank=True)

    requested_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    note = models.TextField(blank=True)

    class Meta:
        ordering = ["-requested_at"]

    def __str__(self):
        actor = self.actor_full_name or self.actor_username or self.get_source_display()
        return f"{actor} {self.get_action_display()} - {self.status}"