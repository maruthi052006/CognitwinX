from django.urls import path
from .views import ChatMessageView, ChatSessionCreateListView, ChatSessionDetailView

urlpatterns = [
    path('chat/message/', ChatMessageView.as_view(), name='chat_message'),
    path('chat/sessions/', ChatSessionCreateListView.as_view(), name='chat_sessions'),
    path('chat/sessions/<int:pk>/', ChatSessionDetailView.as_view(), name='chat_session_detail'),
]
