import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('cognitwin')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Celery Beat Periodic Task Schedules
app.conf.beat_schedule = {
    # 1. Scheduled Cognitive Cycle for all monitored zones every 15 minutes
    'orchestrator-cognitive-cycle-every-15-mins': {
        'task': 'tasks.run_cognitive_cycle',
        'schedule': 900.0,  # every 15 minutes
        'args': (1,),       # Primary pilot zone ID (default to 1 or dynamically looped)
    },
    # 2. Sensing Agent SAR & IMERG telemetry ingestion every 20 minutes
    'sensing-agent-telemetry-every-20-mins': {
        'task': 'tasks.run_sensing_agent',
        'schedule': 1200.0,  # every 20 minutes
        'args': (1,),
    },
    # 3. Daily ISRO Bhuvan WMS API token refresh at midnight (tokens expire after 24h)
    'bhuvan-token-refresh-daily': {
        'task': 'tasks.refresh_bhuvan_token',
        'schedule': crontab(hour=0, minute=0),
    },
    # 4. RAG Index synchronization every 10 minutes for live sensor and cognition context
    'rag-index-refresh-every-10-mins': {
        'task': 'tasks.refresh_rag_index',
        'schedule': 600.0,  # every 10 minutes
    },
    # 5. Infrastructure Recurring Risk Flagging check every 2 hours
    'flag-recurring-risk-zones-every-2-hours': {
        'task': 'tasks.flag_recurring_risk_zones',
        'schedule': 7200.0, # every 2 hours
    },
}

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')

