from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['role', 'phone_number', 'agency', 'is_approved']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, default='public_viewer')
    phone_number = serializers.CharField(required=False, allow_blank=True, default='')
    agency = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'role', 'phone_number', 'agency']

    def create(self, validated_data):
        # SECURITY VULNERABILITY FIX: Prevent mass assignment. 
        # Ignore client-provided 'role' and force 'public_viewer' for all registrations.
        validated_data.pop('role', None)
        role = 'public_viewer'
        
        phone_number = validated_data.pop('phone_number', '')
        agency = validated_data.pop('agency', '')
        password = validated_data.pop('password')

        user = User.objects.create_user(
            username=validated_data.get('username'),
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        user.set_password(password)
        user.save()

        # Update profile created via signal
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.phone_number = phone_number
        profile.agency = agency
        # All newly registered users are public viewers and auto-approved
        profile.is_approved = True
        profile.save()
        user.profile = profile
        return user

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')

        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError({"detail": "Invalid username or credentials provided."})

        if not user.is_active:
            raise serializers.ValidationError({"detail": "User account is inactive."})

        profile = getattr(user, 'profile', None)
        refresh = RefreshToken.for_user(user)

        return {
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'role': profile.role if profile else 'public_viewer',
            'is_approved': profile.is_approved if profile else True
        }
