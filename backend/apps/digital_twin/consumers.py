import json
from channels.generic.websocket import AsyncWebsocketConsumer

class TwinUpdatesConsumer(AsyncWebsocketConsumer):
    GROUP_NAME = 'twin_updates'

    async def connect(self):
        await self.channel_layer.group_add(self.GROUP_NAME, self.channel_name)
        await self.accept()
        # Send initial connection acknowledgement
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to Cognitive Digital Twin Live Stream',
            'status': 'active'
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.GROUP_NAME, self.channel_name)

    async def receive(self, text_data):
        # Allow client pings or zone selection subscription
        try:
            data = json.loads(text_data)
            action = data.get('action')
            if action == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except Exception:
            pass

    async def broadcast_event(self, event):
        """Handler for events dispatched to group"""
        await self.send(text_data=json.dumps(event['data']))
