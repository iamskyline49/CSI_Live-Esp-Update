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