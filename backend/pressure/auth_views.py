import random
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db import transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import PasswordResetOTP, UserProfile
from .permissions import ensure_user_profile, has_all_access, is_super_admin


def parse_bool(value):
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        return value.lower() in ["true", "1", "yes", "active"]

    return bool(value)


def serialize_user(user):
    profile = ensure_user_profile(user)

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.get_full_name(),
        "role": profile.role,
        "role_label": profile.get_role_display(),
        "all_access": profile.has_all_access,
        "can_control_device": profile.can_control_device,
        "is_active": user.is_active,
    }


def get_allowed_roles_for_user(user):
    if is_super_admin(user):
        return [
            UserProfile.ROLE_SUPER_ADMIN,
            UserProfile.ROLE_COMPANY_ADMIN,
            UserProfile.ROLE_OPERATOR,
        ]

    return [
        UserProfile.ROLE_COMPANY_ADMIN,
        UserProfile.ROLE_OPERATOR,
    ]


def is_target_super_admin(target_user):
    profile = ensure_user_profile(target_user)

    return (
        target_user.is_superuser
        or profile.role == UserProfile.ROLE_SUPER_ADMIN
    )


def can_manage_target_user(actor, target_user):
    if is_super_admin(actor):
        return True

    if is_target_super_admin(target_user):
        return False

    return True


def get_visible_users_for_actor(actor):
    users = User.objects.all().order_by("-id")

    if is_super_admin(actor):
        return users

    return users.exclude(
        is_superuser=True
    ).exclude(
        profile__role=UserProfile.ROLE_SUPER_ADMIN
    )


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def csrf_token(request):
    return Response({
        "api_success": True,
        "csrf_token": get_token(request),
        "message": "CSRF cookie set successfully."
    }, status=status.HTTP_200_OK)


@csrf_protect
@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    username = request.data.get("username", "").strip()
    email = request.data.get("email", "").strip()
    password = request.data.get("password", "")
    first_name = request.data.get("first_name", "").strip()
    last_name = request.data.get("last_name", "").strip()

    if not username:
        return Response({
            "api_success": False,
            "message": "Username is required."
        }, status=status.HTTP_400_BAD_REQUEST)

    if not password or len(password) < 6:
        return Response({
            "api_success": False,
            "message": "Password must be at least 6 characters."
        }, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({
            "api_success": False,
            "message": "Username already exists."
        }, status=status.HTTP_400_BAD_REQUEST)

    if email and User.objects.filter(email=email).exists():
        return Response({
            "api_success": False,
            "message": "Email already exists."
        }, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        profile = ensure_user_profile(user)
        profile.role = UserProfile.ROLE_OPERATOR
        profile.save()

        login(request, user)
        request.session.cycle_key()

    return Response({
        "api_success": True,
        "message": "Registration successful.",
        "user": serialize_user(user),
    }, status=status.HTTP_201_CREATED)


@csrf_protect
@api_view(["POST"])
@permission_classes([AllowAny])
def login_user(request):
    username_or_email = request.data.get("username_or_email", "").strip()
    password = request.data.get("password", "")

    if not username_or_email or not password:
        return Response({
            "api_success": False,
            "message": "Username/email and password are required."
        }, status=status.HTTP_400_BAD_REQUEST)

    username = username_or_email

    if "@" in username_or_email:
        user_by_email = User.objects.filter(email=username_or_email).first()

        if user_by_email:
            username = user_by_email.username

    user = authenticate(
        request,
        username=username,
        password=password
    )

    if not user:
        return Response({
            "api_success": False,
            "message": "Invalid login credentials."
        }, status=status.HTTP_401_UNAUTHORIZED)

    if not user.is_active:
        return Response({
            "api_success": False,
            "message": "This account is inactive."
        }, status=status.HTTP_403_FORBIDDEN)

    ensure_user_profile(user)

    login(request, user)
    request.session.cycle_key()

    return Response({
        "api_success": True,
        "message": "Login successful.",
        "user": serialize_user(user),
    }, status=status.HTTP_200_OK)


@csrf_protect
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_user(request):
    logout(request)

    return Response({
        "api_success": True,
        "message": "Logout successful."
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
    return Response({
        "api_success": True,
        "user": serialize_user(request.user),
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_users(request):
    if not has_all_access(request.user):
        return Response({
            "api_success": False,
            "message": "You do not have permission to view users."
        }, status=status.HTTP_403_FORBIDDEN)

    users = get_visible_users_for_actor(request.user)

    return Response({
        "api_success": True,
        "users": [serialize_user(user) for user in users],
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_detail(request, user_id):
    if not has_all_access(request.user):
        return Response({
            "api_success": False,
            "message": "You do not have permission to view this user."
        }, status=status.HTTP_403_FORBIDDEN)

    target_user = User.objects.filter(id=user_id).first()

    if not target_user:
        return Response({
            "api_success": False,
            "message": "User not found."
        }, status=status.HTTP_404_NOT_FOUND)

    if not can_manage_target_user(request.user, target_user):
        return Response({
            "api_success": False,
            "message": "You cannot access SuperAdmin account information."
        }, status=status.HTTP_403_FORBIDDEN)

    return Response({
        "api_success": True,
        "user": serialize_user(target_user),
    }, status=status.HTTP_200_OK)


@csrf_protect
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_user_by_admin(request):
    if not has_all_access(request.user):
        return Response({
            "api_success": False,
            "message": "You do not have permission to create users."
        }, status=status.HTTP_403_FORBIDDEN)

    username = request.data.get("username", "").strip()
    email = request.data.get("email", "").strip()
    password = request.data.get("password", "")
    first_name = request.data.get("first_name", "").strip()
    last_name = request.data.get("last_name", "").strip()
    role = request.data.get("role", UserProfile.ROLE_OPERATOR).strip()
    is_active = parse_bool(request.data.get("is_active", True))

    allowed_roles = get_allowed_roles_for_user(request.user)

    if role not in allowed_roles:
        return Response({
            "api_success": False,
            "message": "You cannot create this role."
        }, status=status.HTTP_403_FORBIDDEN)

    if not username:
        return Response({
            "api_success": False,
            "message": "Username is required."
        }, status=status.HTTP_400_BAD_REQUEST)

    if not password or len(password) < 6:
        return Response({
            "api_success": False,
            "message": "Password must be at least 6 characters."
        }, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({
            "api_success": False,
            "message": "Username already exists."
        }, status=status.HTTP_400_BAD_REQUEST)

    if email and User.objects.filter(email=email).exists():
        return Response({
            "api_success": False,
            "message": "Email already exists."
        }, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        user.is_active = is_active
        user.is_superuser = role == UserProfile.ROLE_SUPER_ADMIN
        user.is_staff = role == UserProfile.ROLE_SUPER_ADMIN
        user.save()

        profile = ensure_user_profile(user)
        profile.role = role
        profile.save()

    return Response({
        "api_success": True,
        "message": "User created successfully.",
        "user": serialize_user(user),
    }, status=status.HTTP_201_CREATED)


@csrf_protect
@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_user_by_admin(request, user_id):
    if not has_all_access(request.user):
        return Response({
            "api_success": False,
            "message": "You do not have permission to update users."
        }, status=status.HTTP_403_FORBIDDEN)

    target_user = User.objects.filter(id=user_id).first()

    if not target_user:
        return Response({
            "api_success": False,
            "message": "User not found."
        }, status=status.HTTP_404_NOT_FOUND)

    if not can_manage_target_user(request.user, target_user):
        return Response({
            "api_success": False,
            "message": "Company Admin cannot update SuperAdmin accounts."
        }, status=status.HTTP_403_FORBIDDEN)

    target_profile = ensure_user_profile(target_user)

    username = request.data.get("username", target_user.username).strip()
    email = request.data.get("email", target_user.email).strip()
    first_name = request.data.get("first_name", target_user.first_name).strip()
    last_name = request.data.get("last_name", target_user.last_name).strip()
    role = request.data.get("role", target_profile.role).strip()
    is_active = parse_bool(request.data.get("is_active", target_user.is_active))
    password = request.data.get("password", "")

    allowed_roles = get_allowed_roles_for_user(request.user)

    if role not in allowed_roles:
        return Response({
            "api_success": False,
            "message": "You cannot assign this role."
        }, status=status.HTTP_403_FORBIDDEN)

    if not username:
        return Response({
            "api_success": False,
            "message": "Username is required."
        }, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.exclude(id=target_user.id).filter(username=username).exists():
        return Response({
            "api_success": False,
            "message": "Username already exists."
        }, status=status.HTTP_400_BAD_REQUEST)

    if email and User.objects.exclude(id=target_user.id).filter(email=email).exists():
        return Response({
            "api_success": False,
            "message": "Email already exists."
        }, status=status.HTTP_400_BAD_REQUEST)

    target_user.username = username
    target_user.email = email
    target_user.first_name = first_name
    target_user.last_name = last_name
    target_user.is_active = is_active

    if is_super_admin(request.user):
        target_user.is_superuser = role == UserProfile.ROLE_SUPER_ADMIN
        target_user.is_staff = role == UserProfile.ROLE_SUPER_ADMIN

    if password:
        if len(password) < 6:
            return Response({
                "api_success": False,
                "message": "Password must be at least 6 characters."
            }, status=status.HTTP_400_BAD_REQUEST)

        target_user.set_password(password)

    target_user.save()

    profile = ensure_user_profile(target_user)
    profile.role = role
    profile.save()

    return Response({
        "api_success": True,
        "message": "User updated successfully.",
        "user": serialize_user(target_user),
    }, status=status.HTTP_200_OK)


@csrf_protect
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_user_by_admin(request, user_id):
    if not has_all_access(request.user):
        return Response({
            "api_success": False,
            "message": "You do not have permission to delete users."
        }, status=status.HTTP_403_FORBIDDEN)

    target_user = User.objects.filter(id=user_id).first()

    if not target_user:
        return Response({
            "api_success": False,
            "message": "User not found."
        }, status=status.HTTP_404_NOT_FOUND)

    if target_user.id == request.user.id:
        return Response({
            "api_success": False,
            "message": "You cannot delete your own account."
        }, status=status.HTTP_400_BAD_REQUEST)

    if not can_manage_target_user(request.user, target_user):
        return Response({
            "api_success": False,
            "message": "Company Admin cannot delete SuperAdmin accounts."
        }, status=status.HTTP_403_FORBIDDEN)

    target_user.delete()

    return Response({
        "api_success": True,
        "message": "User deleted successfully."
    }, status=status.HTTP_200_OK)


@csrf_protect
@api_view(["POST"])
@permission_classes([AllowAny])
def request_password_reset_otp(request):
    email = request.data.get("email", "").strip()

    if not email:
        return Response({
            "api_success": False,
            "message": "Email is required."
        }, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email=email, is_active=True).first()

    generic_message = "If the email exists, an OTP has been sent."

    if not user:
        return Response({
            "api_success": True,
            "message": generic_message
        }, status=status.HTTP_200_OK)

    otp_code = f"{random.randint(100000, 999999)}"

    expires_at = timezone.now() + timedelta(
        minutes=settings.PASSWORD_RESET_OTP_EXPIRY_MINUTES
    )

    PasswordResetOTP.objects.filter(
        user=user,
        is_used=False
    ).update(is_used=True)

    PasswordResetOTP.objects.create(
        user=user,
        email=email,
        otp_code=otp_code,
        expires_at=expires_at,
    )

    subject = "Password Reset OTP"
    message = (
        f"Your password reset OTP is: {otp_code}\n\n"
        f"This OTP will expire in "
        f"{settings.PASSWORD_RESET_OTP_EXPIRY_MINUTES} minutes.\n\n"
        "If you did not request this, please ignore this email."
    )

    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [email],
        fail_silently=False,
    )

    return Response({
        "api_success": True,
        "message": generic_message
    }, status=status.HTTP_200_OK)


@csrf_protect
@api_view(["POST"])
@permission_classes([AllowAny])
def verify_password_reset_otp(request):
    email = request.data.get("email", "").strip()
    otp_code = request.data.get("otp_code", "").strip()

    if not email or not otp_code:
        return Response({
            "api_success": False,
            "message": "Email and OTP are required."
        }, status=status.HTTP_400_BAD_REQUEST)

    otp = PasswordResetOTP.objects.filter(
        email=email,
        otp_code=otp_code,
        is_used=False
    ).order_by("-created_at").first()

    if not otp or not otp.is_valid_for_verify():
        return Response({
            "api_success": False,
            "message": "Invalid or expired OTP."
        }, status=status.HTTP_400_BAD_REQUEST)

    otp.is_verified = True
    otp.save()

    return Response({
        "api_success": True,
        "message": "OTP verified successfully.",
        "reset_token": str(otp.reset_token),
    }, status=status.HTTP_200_OK)


@csrf_protect
@api_view(["POST"])
@permission_classes([AllowAny])
def confirm_password_reset(request):
    email = request.data.get("email", "").strip()
    reset_token = request.data.get("reset_token", "").strip()
    new_password = request.data.get("new_password", "")

    if not email or not reset_token or not new_password:
        return Response({
            "api_success": False,
            "message": "Email, reset token, and new password are required."
        }, status=status.HTTP_400_BAD_REQUEST)

    if len(new_password) < 6:
        return Response({
            "api_success": False,
            "message": "Password must be at least 6 characters."
        }, status=status.HTTP_400_BAD_REQUEST)

    otp = PasswordResetOTP.objects.filter(
        email=email,
        reset_token=reset_token,
        is_used=False,
        is_verified=True
    ).order_by("-created_at").first()

    if not otp or not otp.is_valid_for_reset():
        return Response({
            "api_success": False,
            "message": "Invalid or expired reset request."
        }, status=status.HTTP_400_BAD_REQUEST)

    user = otp.user
    user.set_password(new_password)
    user.save()

    otp.is_used = True
    otp.save()

    return Response({
        "api_success": True,
        "message": "Password reset successful. Please login again."
    }, status=status.HTTP_200_OK)