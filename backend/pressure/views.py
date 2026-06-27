from datetime import timedelta
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import DeviceStatus, RelayActionLog
from .mqtt_client import publish_turn_off_command, publish_turn_on_command
from .permissions import can_control_device, ensure_user_profile, has_all_access


DEVICE_ID = "esp32-001"
ONLINE_TIMEOUT_SECONDS = 5


def format_bd_time(dt):
    if not dt:
        return "Not available"

    bd_timezone = ZoneInfo("Asia/Dhaka")

    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone=dt_timezone.utc)

    bd_time = dt.astimezone(bd_timezone)

    return bd_time.strftime("%d %b %Y, %I:%M:%S %p")


def create_relay_action_log(user, action):
    profile = ensure_user_profile(user)

    return RelayActionLog.objects.create(
        user=user,
        device_id=DEVICE_ID,
        action=action,
        source=RelayActionLog.SOURCE_DASHBOARD,
        status=RelayActionLog.STATUS_PENDING,
        actor_username=user.username,
        actor_full_name=user.get_full_name() or user.username,
        actor_role=profile.get_role_display(),
        note="Command sent from dashboard.",
    )


def serialize_relay_action(log):
    actor_name = (
        log.actor_full_name
        or log.actor_username
        or log.get_source_display()
    )

    if log.source == RelayActionLog.SOURCE_PHYSICAL_BUTTON:
        actor_name = "Physical Button"

    manual_action = log.source == RelayActionLog.SOURCE_PHYSICAL_BUTTON

    return {
        "id": log.id,
        "device_id": log.device_id,
        "action": log.action,
        "action_text": log.get_action_display(),
        "source": log.source,
        "source_text": log.get_source_display(),
        "status": log.status,
        "status_text": log.get_status_display(),
        "actor_name": actor_name,
        "actor_username": log.actor_username,
        "actor_role": log.actor_role,
        "requested_at": log.requested_at,
        "requested_at_display": format_bd_time(log.requested_at),
        "confirmed_at": log.confirmed_at,
        "confirmed_at_display": format_bd_time(log.confirmed_at),
        "is_manual": manual_action,
        "manual_text": (
            "Manual button was used to control the relay."
            if manual_action
            else ""
        ),
        "note": log.note,
    }


def build_public_response(device):
    if device is None:
        return {
            "api_success": True,
            "system_online": False,
            "system_status_text": "System Offline",
            "pressure_status": "unknown",
            "pressure_text": "Waiting for data",
            "relay_state": "unknown",
            "relay_text": "Unknown",
            "relay_is_on": False,
            "last_update": "Not available",
            "message": "The system is waiting for device data.",
        }

    if device.mqtt_status == "offline":
        return {
            "api_success": True,
            "system_online": False,
            "system_status_text": "System Offline",
            "pressure_status": "unknown",
            "pressure_text": "Waiting for data",
            "relay_state": "unknown",
            "relay_text": "Unknown",
            "relay_is_on": False,
            "last_update": format_bd_time(device.last_seen),
            "message": "The device is currently offline.",
        }

    if device.last_seen is None:
        return {
            "api_success": True,
            "system_online": False,
            "system_status_text": "System Offline",
            "pressure_status": "unknown",
            "pressure_text": "Waiting for data",
            "relay_state": "unknown",
            "relay_text": "Unknown",
            "relay_is_on": False,
            "last_update": "Not available",
            "message": "No recent data received.",
        }

    is_recent = timezone.now() - device.last_seen <= timedelta(
        seconds=ONLINE_TIMEOUT_SECONDS
    )

    if not is_recent:
        return {
            "api_success": True,
            "system_online": False,
            "system_status_text": "System Offline",
            "pressure_status": "unknown",
            "pressure_text": "Waiting for data",
            "relay_state": "unknown",
            "relay_text": "Unknown",
            "relay_is_on": False,
            "last_update": format_bd_time(device.last_seen),
            "message": "Connection timeout. Please check the device.",
        }

    if device.pressure_status == "normal":
        pressure_text = "Pressure Normal"
        message = "System is running normally."

    elif device.pressure_status == "low":
        pressure_text = "Pressure Low"
        message = "Low pressure detected. Please check the system."

    else:
        pressure_text = "Waiting for data"
        message = "Pressure data is not available yet."

    if device.device_state == "on":
        relay_text = "Device ON"
        relay_is_on = True

    elif device.device_state == "off":
        relay_text = "Device OFF"
        relay_is_on = False

    else:
        relay_text = "Unknown"
        relay_is_on = False

    return {
        "api_success": True,
        "system_online": True,
        "system_status_text": "System Online",
        "pressure_status": device.pressure_status,
        "pressure_text": pressure_text,
        "relay_state": device.device_state,
        "relay_text": relay_text,
        "relay_is_on": relay_is_on,
        "last_update": format_bd_time(device.last_seen),
        "message": message,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_device_status(request):
    device = DeviceStatus.objects.filter(device_id=DEVICE_ID).first()

    return Response(
        build_public_response(device),
        status=status.HTTP_200_OK
    )


@csrf_protect
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def turn_on_device(request):
    if not can_control_device(request.user):
        return Response({
            "api_success": False,
            "message": "You do not have permission to control the device."
        }, status=status.HTTP_403_FORBIDDEN)

    action_log = create_relay_action_log(
        request.user,
        RelayActionLog.ACTION_ON
    )

    try:
        publish_turn_on_command(DEVICE_ID)

        return Response({
            "api_success": True,
            "message": "Device ON command sent successfully.",
            "relay_action": serialize_relay_action(action_log),
        }, status=status.HTTP_200_OK)

    except Exception:
        action_log.status = RelayActionLog.STATUS_FAILED
        action_log.note = "Unable to send ON command."
        action_log.save()

        return Response({
            "api_success": False,
            "message": "Unable to send command. Please try again."
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_protect
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def turn_off_device(request):
    if not can_control_device(request.user):
        return Response({
            "api_success": False,
            "message": "You do not have permission to control the device."
        }, status=status.HTTP_403_FORBIDDEN)

    action_log = create_relay_action_log(
        request.user,
        RelayActionLog.ACTION_OFF
    )

    try:
        publish_turn_off_command(DEVICE_ID)

        return Response({
            "api_success": True,
            "message": "Device OFF command sent successfully.",
            "relay_action": serialize_relay_action(action_log),
        }, status=status.HTTP_200_OK)

    except Exception:
        action_log.status = RelayActionLog.STATUS_FAILED
        action_log.note = "Unable to send OFF command."
        action_log.save()

        return Response({
            "api_success": False,
            "message": "Unable to send command. Please try again."
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_protect
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reset_device_state(request):
    if not has_all_access(request.user):
        return Response({
            "api_success": False,
            "message": "Only SuperAdmin or Company Admin can reset system data."
        }, status=status.HTTP_403_FORBIDDEN)

    device, created = DeviceStatus.objects.get_or_create(
        device_id=DEVICE_ID
    )

    device.opto_pin = None
    device.relay_pin = None
    device.pressure_status = "unknown"
    device.device_state = "unknown"
    device.mqtt_status = "unknown"
    device.last_message = None
    device.last_seen = None
    device.save()

    return Response({
        "api_success": True,
        "system_online": False,
        "system_status_text": "System Offline",
        "pressure_status": "unknown",
        "pressure_text": "Waiting for data",
        "relay_state": "unknown",
        "relay_text": "Unknown",
        "relay_is_on": False,
        "last_update": "Not available",
        "message": "System data has been reset.",
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def relay_activity(request):
    logs = RelayActionLog.objects.all().order_by("-requested_at")[:30]

    return Response({
        "api_success": True,
        "relay_activity": [
            serialize_relay_action(log)
            for log in logs
        ],
    }, status=status.HTTP_200_OK)