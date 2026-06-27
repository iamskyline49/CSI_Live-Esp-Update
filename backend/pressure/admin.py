from django.contrib import admin

from .models import DeviceStatus, PasswordResetOTP, RelayActionLog, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "role",
        "created_at",
        "updated_at",
    ]
    list_filter = ["role"]
    search_fields = [
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
    ]


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = [
        "email",
        "otp_code",
        "is_verified",
        "is_used",
        "created_at",
        "expires_at",
    ]
    list_filter = [
        "is_verified",
        "is_used",
    ]
    search_fields = [
        "email",
        "user__username",
    ]
    readonly_fields = [
        "reset_token",
        "created_at",
    ]


@admin.register(DeviceStatus)
class DeviceStatusAdmin(admin.ModelAdmin):
    list_display = [
        "device_id",
        "pressure_status",
        "device_state",
        "mqtt_status",
        "last_seen",
    ]
    list_filter = [
        "pressure_status",
        "device_state",
        "mqtt_status",
    ]
    search_fields = ["device_id"]


@admin.register(RelayActionLog)
class RelayActionLogAdmin(admin.ModelAdmin):
    list_display = [
        "actor_full_name",
        "actor_role",
        "action",
        "source",
        "status",
        "requested_at",
        "confirmed_at",
    ]
    list_filter = [
        "action",
        "source",
        "status",
    ]
    search_fields = [
        "actor_username",
        "actor_full_name",
        "actor_role",
        "device_id",
    ]
    readonly_fields = [
        "requested_at",
        "confirmed_at",
    ]