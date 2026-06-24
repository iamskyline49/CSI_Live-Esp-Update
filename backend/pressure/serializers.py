from zoneinfo import ZoneInfo
from django.utils import timezone
from rest_framework import serializers
from .models import DeviceStatus


class DeviceStatusSerializer(serializers.ModelSerializer):
    last_seen_display = serializers.SerializerMethodField()

    class Meta:
        model = DeviceStatus
        fields = [
            "id",
            "device_id",
            "opto_pin",
            "pressure_status",
            "device_state",
            "last_message",
            "last_seen",
            "last_seen_display",
        ]

    def get_last_seen_display(self, obj):
        if not obj.last_seen:
            return "Unknown"

        bdt_timezone = ZoneInfo("Asia/Dhaka")

        if timezone.is_naive(obj.last_seen):
            aware_time = timezone.make_aware(obj.last_seen, timezone=timezone.utc)
        else:
            aware_time = obj.last_seen

        bdt_time = aware_time.astimezone(bdt_timezone)

        return bdt_time.strftime("%d %b %Y, %I:%M:%S %p BDT")