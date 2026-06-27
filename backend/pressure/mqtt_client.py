import json
import ssl

import paho.mqtt.client as mqtt
from django.conf import settings


def create_mqtt_client(client_id):
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=client_id,
    )

    if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
        client.username_pw_set(
            settings.MQTT_USERNAME,
            settings.MQTT_PASSWORD
        )

    if settings.MQTT_USE_TLS:
        client.tls_set(cert_reqs=ssl.CERT_REQUIRED)

    return client


def publish_command(device_id, command):
    client = create_mqtt_client("django_dashboard_command")

    client.connect(
        settings.MQTT_BROKER_HOST,
        settings.MQTT_BROKER_PORT,
        60
    )

    payload = {
        "device_id": device_id,
        "command": command,
        "source": "dashboard",
    }

    client.publish(
        settings.MQTT_COMMAND_TOPIC,
        json.dumps(payload),
        qos=1
    )

    client.disconnect()


def publish_turn_on_command(device_id):
    publish_command(device_id, "TURN_ON_DEVICE")


def publish_turn_off_command(device_id):
    publish_command(device_id, "TURN_OFF_DEVICE")