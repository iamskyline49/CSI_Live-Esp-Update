from datetime import timedelta
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .models import DeviceStatus
from .mqtt_client import publish_turn_on_command, publish_turn_off_command


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


def build_public_response(device):
    """
    Public response for normal users.
    No raw MQTT data.
    No device ID.
    No pin value.
    No technical/debug information.
    """

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
def get_device_status(request):
    device = DeviceStatus.objects.filter(device_id=DEVICE_ID).first()

    return Response(
        build_public_response(device),
        status=status.HTTP_200_OK
    )


@api_view(["POST"])
def turn_on_device(request):
    try:
        publish_turn_on_command(DEVICE_ID)

        return Response({
            "api_success": True,
            "message": "Device ON command sent successfully."
        }, status=status.HTTP_200_OK)

    except Exception:
        return Response({
            "api_success": False,
            "message": "Unable to send command. Please try again."
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
def turn_off_device(request):
    try:
        publish_turn_off_command(DEVICE_ID)

        return Response({
            "api_success": True,
            "message": "Device OFF command sent successfully."
        }, status=status.HTTP_200_OK)

    except Exception:
        return Response({
            "api_success": False,
            "message": "Unable to send command. Please try again."
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
def reset_device_state(request):
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