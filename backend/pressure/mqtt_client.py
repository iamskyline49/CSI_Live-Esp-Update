import json
import ssl
import uuid

import paho.mqtt.client as mqtt
from django.conf import settings


def create_mqtt_client(client_id_prefix):
    client_id = f"{client_id_prefix}_{uuid.uuid4().hex[:8]}"

    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=client_id
    )

    if settings.MQTT_USERNAME:
        client.username_pw_set(
            settings.MQTT_USERNAME,
            settings.MQTT_PASSWORD
        )

    if settings.MQTT_USE_TLS:
        client.tls_set(
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLS_CLIENT
        )
        client.tls_insecure_set(False)

    return client


def publish_device_command(device_id="esp32-001", command="TURN_ON_DEVICE"):
    payload = {
        "device_id": device_id,
        "command": command
    }

    client = create_mqtt_client("django_command_publisher")

    client.connect(
        settings.MQTT_BROKER_HOST,
        settings.MQTT_BROKER_PORT,
        60
    )

    client.loop_start()

    result = client.publish(
        settings.MQTT_COMMAND_TOPIC,
        json.dumps(payload),
        qos=1
    )

    result.wait_for_publish()

    client.loop_stop()
    client.disconnect()

    return payload


def publish_turn_on_command(device_id="esp32-001"):
    return publish_device_command(device_id, "TURN_ON_DEVICE")


def publish_turn_off_command(device_id="esp32-001"):
    return publish_device_command(device_id, "TURN_OFF_DEVICE")