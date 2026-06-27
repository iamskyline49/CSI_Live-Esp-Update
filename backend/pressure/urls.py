from django.urls import path

from . import auth_views
from . import views


urlpatterns = [
    path("auth/csrf/", auth_views.csrf_token, name="csrf_token"),

    path("auth/register/", auth_views.register_user, name="register_user"),
    path("auth/login/", auth_views.login_user, name="login_user"),
    path("auth/logout/", auth_views.logout_user, name="logout_user"),
    path("auth/me/", auth_views.current_user, name="current_user"),

    path("auth/users/", auth_views.list_users, name="list_users"),
    path("auth/users/create/", auth_views.create_user_by_admin, name="create_user_by_admin"),
    path("auth/users/<int:user_id>/", auth_views.user_detail, name="user_detail"),
    path("auth/users/<int:user_id>/update/", auth_views.update_user_by_admin, name="update_user_by_admin"),
    path("auth/users/<int:user_id>/delete/", auth_views.delete_user_by_admin, name="delete_user_by_admin"),

    path("auth/password-reset/request-otp/", auth_views.request_password_reset_otp, name="request_password_reset_otp"),
    path("auth/password-reset/verify-otp/", auth_views.verify_password_reset_otp, name="verify_password_reset_otp"),
    path("auth/password-reset/confirm/", auth_views.confirm_password_reset, name="confirm_password_reset"),

    path("status/", views.get_device_status, name="get_device_status"),
    path("device/on/", views.turn_on_device, name="turn_on_device"),
    path("device/off/", views.turn_off_device, name="turn_off_device"),
    path("device/reset/", views.reset_device_state, name="reset_device_state"),

    path("relay-activity/", views.relay_activity, name="relay_activity"),
]