from django.urls import path
from .views import CurrentUserProfileView, RegisterView, LoginView, ApproveOfficerView

urlpatterns = [
    path('me/', CurrentUserProfileView.as_view(), name='current_user_profile'),
    path('register/', RegisterView.as_view(), name='user_register'),
    path('login/', LoginView.as_view(), name='user_login'),
    path('approve-officer/<int:user_id>/', ApproveOfficerView.as_view(), name='approve_officer'),
]
