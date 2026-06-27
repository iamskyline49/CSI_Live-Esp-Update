from .models import UserProfile


def ensure_user_profile(user):
    if hasattr(user, "profile"):
        return user.profile

    role = (
        UserProfile.ROLE_SUPER_ADMIN
        if user.is_superuser
        else UserProfile.ROLE_OPERATOR
    )

    return UserProfile.objects.create(
        user=user,
        role=role
    )


def is_super_admin(user):
    if not user or not user.is_authenticated:
        return False

    profile = ensure_user_profile(user)

    return (
        user.is_superuser
        or profile.role == UserProfile.ROLE_SUPER_ADMIN
    )


def is_company_admin(user):
    if not user or not user.is_authenticated:
        return False

    profile = ensure_user_profile(user)

    return profile.role == UserProfile.ROLE_COMPANY_ADMIN


def is_operator(user):
    if not user or not user.is_authenticated:
        return False

    profile = ensure_user_profile(user)

    return profile.role == UserProfile.ROLE_OPERATOR


def has_all_access(user):
    if not user or not user.is_authenticated:
        return False

    profile = ensure_user_profile(user)

    return profile.has_all_access


def can_control_device(user):
    if not user or not user.is_authenticated:
        return False

    profile = ensure_user_profile(user)

    return profile.can_control_device