from django.db import models


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

    device_id = models.CharField(
        max_length=100,
        unique=True,
        default="esp32-001"
    )

    opto_pin = models.IntegerField(null=True, blank=True)

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

    last_message = models.TextField(blank=True, null=True)

    # Important: this should update only when MQTT message comes from ESP32
    last_seen = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.device_id} - {self.pressure_status} - {self.device_state}"