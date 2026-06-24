from django.contrib import admin
from .models import DeviceStatus


@admin.register(DeviceStatus)
class DeviceStatusAdmin(admin.ModelAdmin):
    list_display = (
        "device_id",
        "opto_pin",
        "pressure_status",
        "device_state",
        "last_seen",
    )