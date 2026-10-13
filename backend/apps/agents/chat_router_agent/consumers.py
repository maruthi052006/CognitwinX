import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import ChatSession, ChatMessage
from .router import ChatRouter

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs'].get('session_id')
        self.room_group_name = f"chat_{self.session_id}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Send connection established
        await self.send(text_data=json.dumps({
            'type': 'connected',
            'session_id': self.session_id,
            'message': 'Connected to Cognitive Digital Twin Chat Stream'
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get('action')

            if action == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
                return

            if action == 'send_message':
                message_text = data.get('message', '').strip()
                language = data.get('language', 'en')
                if not message_text:
                    return

                # Send typing indicator
                await self.send(text_data=json.dumps({
                    'type': 'typing',
                    'status': 'thinking',
                    'agent': 'Chat Router Agent'
                }))

                # Process message asynchronously with database sync
                response_payload = await self.process_chat(message_text, language)

                # Send token-by-token or structured chunk stream
                tokens = response_payload['twin_response']['content'].split(' ')
                accumulated = ""
                for i, token in enumerate(tokens):
                    accumulated += token + " "
                    if i % 3 == 0 or i == len(tokens) - 1:
                        await self.send(text_data=json.dumps({
                            'type': 'stream_chunk',
                            'chunk': accumulated,
                            'done': (i == len(tokens) - 1)
                        }))
                        await asyncio.sleep(0.015)

                # Final complete response event
                await self.send(text_data=json.dumps({
                    'type': 'message_complete',
                    'data': response_payload
                }))

        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    @database_sync_to_async
    def process_chat(self, message_text, language):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            user, _ = User.objects.get_or_create(username='ndma_officer')

        try:
            session = ChatSession.objects.get(id=int(self.session_id))
        except (ChatSession.DoesNotExist, ValueError):
            session = ChatSession.objects.create(user=user)

        user_msg = ChatMessage.objects.create(
            session=session,
            role='user',
            content=message_text
        )

        router = ChatRouter(user=user, session=session, language=language)
        response_data = router.process_message(message_text)

        twin_msg = ChatMessage.objects.create(
            session=session,
            role='twin',
            content=response_data.get('content', ''),
            tool_calls_made=response_data.get('tool_calls_made', []),
            requires_confirmation=response_data.get('requires_confirmation', False),
            confirmation_payload=response_data.get('confirmation_payload')
        )

        return {
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
        }
