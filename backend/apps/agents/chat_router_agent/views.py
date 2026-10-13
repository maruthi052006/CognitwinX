from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from apps.digital_twin.models import CityZone
from .models import ChatSession, ChatMessage
from .router import ChatRouter

def get_request_user(request):
    """Fallback to demo ndma_officer or public_viewer user for local evaluation."""
    if request.user and request.user.is_authenticated:
        return request.user
    role_header = request.headers.get('X-User-Role', 'ndma_officer')
    username = 'citizen_user' if role_header == 'public_viewer' else 'ndma_officer'
    user, _ = User.objects.get_or_create(username=username)
    if hasattr(user, 'profile'):
        user.profile.role = role_header
        user.profile.save()
    return user

class ChatSessionCreateListView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        user = get_request_user(request)
        sessions = ChatSession.objects.filter(user=user).order_by('-created_at')[:15]
        data = [{
            'id': s.id,
            'zone_id': s.zone_context.id if s.zone_context else None,
            'zone_name': s.zone_context.name if s.zone_context else 'General Basin',
            'created_at': s.created_at.isoformat(),
            'message_count': s.messages.count()
        } for s in sessions]
        return Response(data)

    def post(self, request):
        user = get_request_user(request)
        zone_id = request.data.get('zone_id')
        zone = CityZone.objects.filter(id=zone_id).first() if zone_id else None
        session = ChatSession.objects.create(user=user, zone_context=zone)
        return Response({
            'id': session.id,
            'zone_id': zone.id if zone else None,
            'zone_name': zone.name if zone else 'General Basin',
            'created_at': session.created_at.isoformat()
        }, status=status.HTTP_201_CREATED)

class ChatSessionDetailView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request, pk):
        session = get_object_or_404(ChatSession, pk=pk)
        messages = session.messages.order_by('timestamp')
        return Response({
            'session_id': session.id,
            'zone_id': session.zone_context.id if session.zone_context else None,
            'zone_name': session.zone_context.name if session.zone_context else 'General Basin',
            'pending_confirmation': session.pending_confirmation,
            'messages': [{
                'id': m.id,
                'role': m.role,
                'content': m.content,
                'tool_calls_made': m.tool_calls_made,
                'requires_confirmation': m.requires_confirmation,
                'confirmation_payload': m.confirmation_payload,
                'timestamp': m.timestamp.isoformat()
            } for m in messages]
        })

class ChatMessageView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        user = get_request_user(request)
        message_text = request.data.get('message', '').strip()
        if not message_text:
            return Response({'error': 'Message text is required.'}, status=status.HTTP_400_BAD_REQUEST)

        session_id = request.data.get('session_id')
        zone_id = request.data.get('zone_id')
        language = request.data.get('language', 'en')

        # Retrieve or create session
        if session_id:
            session = get_object_or_404(ChatSession, pk=session_id)
        else:
            zone = CityZone.objects.filter(id=zone_id).first() if zone_id else None
            session = ChatSession.objects.create(user=user, zone_context=zone)

        # Record User Message
        user_msg = ChatMessage.objects.create(
            session=session,
            role='user',
            content=message_text
        )

        # Orchestrate response via ChatRouter
        router = ChatRouter(user=user, session=session, language=language)
        response_data = router.process_message(message_text)

        # Record Twin Message
        twin_msg = ChatMessage.objects.create(
            session=session,
            role='twin',
            content=response_data.get('content', ''),
            tool_calls_made=response_data.get('tool_calls_made', []),
            requires_confirmation=response_data.get('requires_confirmation', False),
            confirmation_payload=response_data.get('confirmation_payload')
        )

        return Response({
            'session_id': session.id,
            'user_message': {
                'id': user_msg.id,
                'role': user_msg.role,
                'content': user_msg.content,
                'timestamp': user_msg.timestamp.isoformat()
            },
            'twin_response': {
                'id': twin_msg.id,
                'role': twin_msg.role,
                'content': twin_msg.content,
                'tool_calls_made': twin_msg.tool_calls_made,
                'requires_confirmation': twin_msg.requires_confirmation,
                'confirmation_payload': twin_msg.confirmation_payload,
                'timestamp': twin_msg.timestamp.isoformat()
            }
        })
