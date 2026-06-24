import json

from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone

from pressure.models import DeviceStatus
from pressure.mqtt_client import create_mqtt_client, publish_server_ack


class Command(BaseCommand):
    help = "Start MQTT listener for real ESP32 pressure status and device response"

    def handle(self, *args, **kwargs):
        self.stdout.write(
            self.style.SUCCESS("Starting MQTT listener...")
        )

        client = create_mqtt_client("django_mqtt_listener")

        def on_connect(client, userdata, flags, reason_code, properties):
            self.stdout.write(
                self.style.SUCCESS("Connected to MQTT broker")
            )

            client.subscribe(settings.MQTT_PRESSURE_TOPIC, qos=1)
            client.subscribe(settings.MQTT_RESPONSE_TOPIC, qos=1)

            self.stdout.write(
                self.style.SUCCESS(
                    f"Subscribed to pressure topic: {settings.MQTT_PRESSURE_TOPIC}"
                )
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Subscribed to response topic: {settings.MQTT_RESPONSE_TOPIC}"
                )
            )

        def on_message(client, userdata, msg):
            close_old_connections()

            topic = msg.topic
            message = msg.payload.decode()

            self.stdout.write(
                f"MQTT Message Received: {topic} -> {message}"
            )

            if topic == settings.MQTT_PRESSURE_TOPIC:
                self.handle_pressure_message(message)

            elif topic == settings.MQTT_RESPONSE_TOPIC:
                self.handle_device_response(message)

        client.on_connect = on_connect
        client.on_message = on_message

        client.connect(
            settings.MQTT_BROKER_HOST,
            settings.MQTT_BROKER_PORT,
            60
        )

        client.loop_forever()

    def handle_pressure_message(self, message):
        try:
            data = json.loads(message)

            device_id = data.get("device_id", "esp32-001")
            opto_pin = int(data.get("opto_pin", 0))
            pressure_status = data.get("pressure_status", "unknown")

            if opto_pin == 0:
                pressure_status = "normal"
            elif opto_pin == 1:
                pressure_status = "low"
            else:
                pressure_status = "unknown"

            DeviceStatus.objects.update_or_create(
                device_id=device_id,
                defaults={
                    "opto_pin": opto_pin,
                    "pressure_status": pressure_status,
                    "last_message": message,
                    "last_seen": timezone.now(),
                }
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Updated pressure: {pressure_status}, opto_pin={opto_pin}"
                )
            )

            publish_server_ack(
                device_id=device_id,
                received_type="pressure_status",
                status="received"
            )

            self.stdout.write(
                self.style.SUCCESS("ACK sent to ESP32 for pressure data")
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Pressure message error: {e}")
            )

    def handle_device_response(self, message):
        try:
            data = json.loads(message)

            device_id = data.get("device_id", "esp32-001")
            device_state = data.get("device_state", "unknown")

            if device_state not in ["on", "off"]:
                device_state = "unknown"

            DeviceStatus.objects.update_or_create(
                device_id=device_id,
                defaults={
                    "device_state": device_state,
                    "last_message": message,
                    "last_seen": timezone.now(),
                }
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Updated relay device state: {device_state}"
                )
            )

            publish_server_ack(
                device_id=device_id,
                received_type="relay_device_response",
                status="received"
            )

            self.stdout.write(
                self.style.SUCCESS("ACK sent to ESP32 for relay response")
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Device response error: {e}")
            )