from django.urls import path
from . import views


urlpatterns = [
    path("status/", views.get_device_status, name="get_device_status"),
    path("device/on/", views.turn_on_device, name="turn_on_device"),
    path("device/off/", views.turn_off_device, name="turn_off_device"),
    path("device/reset/", views.reset_device_state, name="reset_device_state"),
]