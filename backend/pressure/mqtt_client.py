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

    if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
        client.username_pw_set(
            settings.MQTT_USERNAME,
            settings.MQTT_PASSWORD
        )

    if settings.MQTT_USE_TLS:
        client.tls_set(tls_version=ssl.PROTOCOL_TLS_CLIENT)

    return client


def publish_mqtt_message(topic, payload, client_id_prefix="django_publisher"):
    client = create_mqtt_client(client_id_prefix)

    client.connect(
        settings.MQTT_BROKER_HOST,
        settings.MQTT_BROKER_PORT,
        60
    )

    client.loop_start()

    result = client.publish(
        topic,
        json.dumps(payload),
        qos=1
    )

    result.wait_for_publish()

    client.loop_stop()
    client.disconnect()

    return payload


def publish_device_command(device_id="esp32-001", command="TURN_ON_DEVICE"):
    payload = {
        "device_id": device_id,
        "command": command
    }

    return publish_mqtt_message(
        settings.MQTT_COMMAND_TOPIC,
        payload,
        "django_command_publisher"
    )


def publish_turn_on_command(device_id="esp32-001"):
    return publish_device_command(device_id, "TURN_ON_DEVICE")


def publish_turn_off_command(device_id="esp32-001"):
    return publish_device_command(device_id, "TURN_OFF_DEVICE")


def publish_server_ack(device_id="esp32-001", received_type="unknown", status="received"):
    payload = {
        "device_id": device_id,
        "ack": True,
        "status": status,
        "received_type": received_type,
        "message": f"Server received {received_type} data"
    }

    return publish_mqtt_message(
        settings.MQTT_ACK_TOPIC,
        payload,
        "django_ack_publisher"
    )