from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .models import DeviceStatus
from .serializers import DeviceStatusSerializer
from .mqtt_client import publish_turn_on_command, publish_turn_off_command


DEVICE_ID = "esp32-001"

# ESP32 publishes pressure every 1 second.
# If no MQTT data comes for 5 seconds, ESP32 is considered offline.
ONLINE_TIMEOUT_SECONDS = 5


def build_unknown_response():
    return {
        "api_success": True,
        "esp32_connected": False,

        # This means relay-controlled device, not ESP32
        "relay_device_is_on": False,

        "pressure_text": "Unknown",
        "relay_device_text": "Unknown",
        "display_message": "ESP32 not connected",
        "data": {
            "id": None,
            "device_id": DEVICE_ID,
            "opto_pin": None,
            "pressure_status": "unknown",

            # device_state means relay device state
            "device_state": "unknown",

            "last_message": None,
            "last_seen": None,
            "last_seen_display": "Unknown",
        }
    }


def build_device_response(device):
    if device is None:
        return build_unknown_response()

    if device.last_seen is None:
        return build_unknown_response()

    is_recent = timezone.now() - device.last_seen <= timedelta(
        seconds=ONLINE_TIMEOUT_SECONDS
    )

    if not is_recent:
        return build_unknown_response()

    relay_device_is_on = device.device_state == "on"

    if device.pressure_status == "normal":
        pressure_text = "Pressure Normal"
        display_message = "Pressure Normal"

    elif device.pressure_status == "low":
        pressure_text = "Pressure Low"
        display_message = "Pressure Low"

    else:
        pressure_text = "Unknown"
        display_message = "Pressure Unknown"

    if device.device_state == "on":
        relay_device_text = "Relay Device ON"

    elif device.device_state == "off":
        relay_device_text = "Relay Device OFF"

    else:
        relay_device_text = "Unknown"

    return {
        "api_success": True,
        "esp32_connected": True,

        # This means relay-controlled device, not ESP32
        "relay_device_is_on": relay_device_is_on,

        "pressure_text": pressure_text,
        "relay_device_text": relay_device_text,
        "display_message": display_message,
        "data": DeviceStatusSerializer(device).data
    }


@api_view(["GET"])
def get_device_status(request):
    device = DeviceStatus.objects.filter(device_id=DEVICE_ID).first()

    return Response(
        build_device_response(device),
        status=status.HTTP_200_OK
    )


@api_view(["POST"])
def turn_on_device(request):
    """
    This turns ON the relay-controlled device.
    It does not turn on the ESP32.
    """

    device_id = request.data.get("device_id", DEVICE_ID)

    try:
        mqtt_payload = publish_turn_on_command(device_id)

        return Response({
            "api_success": True,
            "message": "TURN_ON_DEVICE command sent to ESP32 for relay device",
            "mqtt_payload": mqtt_payload
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            "api_success": False,
            "message": "Failed to send relay device ON command",
            "error": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
def turn_off_device(request):
    """
    This turns OFF the relay-controlled device.
    It does not turn off the ESP32.
    """

    device_id = request.data.get("device_id", DEVICE_ID)

    try:
        mqtt_payload = publish_turn_off_command(device_id)

        return Response({
            "api_success": True,
            "message": "TURN_OFF_DEVICE command sent to ESP32 for relay device",
            "mqtt_payload": mqtt_payload
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            "api_success": False,
            "message": "Failed to send relay device OFF command",
            "error": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
def reset_device_state(request):
    device_id = request.data.get("device_id", DEVICE_ID)

    device, created = DeviceStatus.objects.get_or_create(
        device_id=device_id
    )

    device.opto_pin = None
    device.pressure_status = "unknown"

    # This is relay device state
    device.device_state = "unknown"

    device.last_message = None
    device.last_seen = None
    device.save()

    return Response({
        "api_success": True,
        "message": "Data reset. Waiting for real ESP32 MQTT data.",
        "esp32_connected": False,
        "relay_device_is_on": False,
        "pressure_text": "Unknown",
        "relay_device_text": "Unknown",
        "display_message": "ESP32 not connected",
        "data": {
            "id": device.id,
            "device_id": device.device_id,
            "opto_pin": None,
            "pressure_status": "unknown",
            "device_state": "unknown",
            "last_message": None,
            "last_seen": None,
            "last_seen_display": "Unknown",
        }
    }, status=status.HTTP_200_OK)