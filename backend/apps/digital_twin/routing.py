from django.urls import re_path
from . import consumers
from apps.agents.chat_router_agent import consumers as chat_consumers

websocket_urlpatterns = [
    re_path(r'^ws/live-updates/?$', consumers.TwinUpdatesConsumer.as_asgi()),
    re_path(r'^ws/chat/(?P<session_id>[\w-]+)/?$', chat_consumers.ChatConsumer.as_asgi()),
]

