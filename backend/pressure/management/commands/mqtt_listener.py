import json

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.utils import timezone

from pressure.models import DeviceStatus, RelayActionLog
from pressure.mqtt_client import create_mqtt_client


class Command(BaseCommand):
    help = "Start MQTT listener for ESP32 pressure, relay response, and online/offline status"

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
            client.subscribe(settings.MQTT_STATUS_TOPIC, qos=1)

            self.stdout.write(
                self.style.SUCCESS(
                    f"Subscribed pressure topic: {settings.MQTT_PRESSURE_TOPIC}"
                )
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Subscribed response topic: {settings.MQTT_RESPONSE_TOPIC}"
                )
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Subscribed status topic: {settings.MQTT_STATUS_TOPIC}"
                )
            )

        def on_message(client, userdata, msg):
            close_old_connections()

            topic = msg.topic
            message = msg.payload.decode(errors="ignore")

            self.stdout.write(
                f"MQTT Message Received: {topic} -> {message}"
            )

            if topic == settings.MQTT_PRESSURE_TOPIC:
                self.handle_pressure_message(message)

            elif topic == settings.MQTT_RESPONSE_TOPIC:
                self.handle_device_response(message)

            elif topic == settings.MQTT_STATUS_TOPIC:
                self.handle_status_message(message)

        client.on_connect = on_connect
        client.on_message = on_message

        client.connect(
            settings.MQTT_BROKER_HOST,
            settings.MQTT_BROKER_PORT,
            60
        )

        client.loop_forever()

    def confirm_pending_dashboard_action(self, device_state):
        if device_state not in ["on", "off"]:
            return False

        pending_log = RelayActionLog.objects.filter(
            device_id=settings.MQTT_DEVICE_ID,
            action=device_state,
            source=RelayActionLog.SOURCE_DASHBOARD,
            status=RelayActionLog.STATUS_PENDING,
        ).order_by("-requested_at").first()

        if not pending_log:
            return False

        pending_log.status = RelayActionLog.STATUS_CONFIRMED
        pending_log.confirmed_at = timezone.now()
        pending_log.note = "ESP32 confirmed relay state from dashboard command."
        pending_log.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Confirmed dashboard relay action: {device_state}"
            )
        )

        return True

    def create_physical_button_action(self, device_state):
        if device_state not in ["on", "off"]:
            return

        RelayActionLog.objects.create(
            device_id=settings.MQTT_DEVICE_ID,
            action=device_state,
            source=RelayActionLog.SOURCE_PHYSICAL_BUTTON,
            status=RelayActionLog.STATUS_CONFIRMED,
            actor_username="physical_button",
            actor_full_name="Physical Button",
            actor_role="Device",
            confirmed_at=timezone.now(),
            note="Relay changed using ESP32 physical/manual button.",
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Created manual button relay action: {device_state}"
            )
        )

    def handle_pressure_message(self, message):
        try:
            data = json.loads(message)

            device_id = data.get("device_id", settings.MQTT_DEVICE_ID)

            opto_pin = int(data.get("opto_pin", 0))
            relay_pin = int(data.get("relay_pin", 0))

            pressure_status = data.get("pressure_status", "unknown")
            device_state = data.get("device_state", "unknown")

            if opto_pin == 0:
                pressure_status = "normal"
            elif opto_pin == 1:
                pressure_status = "low"
            else:
                pressure_status = "unknown"

            if relay_pin == 1:
                device_state = "on"
            elif relay_pin == 0:
                device_state = "off"
            else:
                device_state = "unknown"

            DeviceStatus.objects.update_or_create(
                device_id=device_id,
                defaults={
                    "opto_pin": opto_pin,
                    "relay_pin": relay_pin,
                    "pressure_status": pressure_status,
                    "device_state": device_state,
                    "mqtt_status": "online",
                    "last_message": message,
                    "last_seen": timezone.now(),
                }
            )

            self.confirm_pending_dashboard_action(device_state)

            self.stdout.write(
                self.style.SUCCESS(
                    f"Updated pressure={pressure_status}, device={device_state}"
                )
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Pressure message error: {e}")
            )

    def handle_device_response(self, message):
        try:
            data = json.loads(message)

            device_id = data.get("device_id", settings.MQTT_DEVICE_ID)
            device_state = data.get("device_state", "unknown")
            source = data.get("source", "").strip().lower()

            if device_state == "on":
                relay_pin = 1
            elif device_state == "off":
                relay_pin = 0
            else:
                relay_pin = None
                device_state = "unknown"

            defaults = {
                "device_state": device_state,
                "mqtt_status": "online",
                "last_message": message,
                "last_seen": timezone.now(),
            }

            if relay_pin is not None:
                defaults["relay_pin"] = relay_pin

            DeviceStatus.objects.update_or_create(
                device_id=device_id,
                defaults=defaults
            )

            if source == "physical_button":
                self.create_physical_button_action(device_state)

            elif source == "dashboard_command":
                self.confirm_pending_dashboard_action(device_state)

            else:
                self.confirm_pending_dashboard_action(device_state)

            self.stdout.write(
                self.style.SUCCESS(
                    f"Updated device response: {device_state}, source={source or 'unknown'}"
                )
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Device response error: {e}")
            )

    def handle_status_message(self, message):
        try:
            mqtt_status = message.strip().lower()

            if mqtt_status not in ["online", "offline"]:
                mqtt_status = "unknown"

            device, created = DeviceStatus.objects.get_or_create(
                device_id=settings.MQTT_DEVICE_ID
            )

            device.mqtt_status = mqtt_status
            device.last_message = message
            device.last_seen = timezone.now()
            device.save()

            self.stdout.write(
                self.style.SUCCESS(
                    f"Updated MQTT status: {mqtt_status}"
                )
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Status message error: {e}")
            )