"""
WebSocket сервис для real-time обновлений
"""
import json
from typing import Dict, List, Set
from fastapi import WebSocket, WebSocketDisconnect, Depends
from datetime import datetime
from app.utils.logging import get_logger
from app.utils.auth import decode_token

logger = get_logger("websocket")


class ConnectionManager:
    """Менеджер WebSocket подключений"""
    
    def __init__(self):
        # Активные подключения: {connection: user_id}
        self.active_connections: Dict[WebSocket, int] = {}
        # Подписки по каналам: {channel: set of connections}
        self.channel_subscriptions: Dict[str, Set[WebSocket]] = {}
        # Подписки по пользователям: {user_id: set of connections}
        self.user_connections: Dict[int, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """Подключение клиента"""
        await websocket.accept()
        self.active_connections[websocket] = user_id
        
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)
        
        logger.info(f"WebSocket подключен: user_id={user_id}, всего подключений={len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """Отключение клиента"""
        if websocket in self.active_connections:
            user_id = self.active_connections[websocket]
            del self.active_connections[websocket]
            
            if user_id in self.user_connections:
                self.user_connections[user_id].discard(websocket)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]
            
            # Удаляем из всех каналов
            for channel in self.channel_subscriptions.values():
                channel.discard(websocket)
            
            logger.info(f"WebSocket отключен: user_id={user_id}, всего подключений={len(self.active_connections)}")
    
    def subscribe(self, websocket: WebSocket, channel: str):
        """Подписка на канал"""
        if channel not in self.channel_subscriptions:
            self.channel_subscriptions[channel] = set()
        self.channel_subscriptions[channel].add(websocket)
        logger.debug(f"Подписка на канал: channel={channel}")
    
    def unsubscribe(self, websocket: WebSocket, channel: str):
        """Отписка от канала"""
        if channel in self.channel_subscriptions:
            self.channel_subscriptions[channel].discard(websocket)
    
    async def broadcast_to_channel(self, channel: str, message: dict):
        """Отправка сообщения всем подписчикам канала"""
        if channel not in self.channel_subscriptions:
            return
        
        message_str = json.dumps(message)
        disconnected = []
        
        for connection in self.channel_subscriptions[channel]:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Ошибка отправки в канал {channel}: {e}")
                disconnected.append(connection)
        
        # Удаляем отключившихся
        for conn in disconnected:
            self.disconnect(conn)
    
    async def send_to_user(self, user_id: int, message: dict):
        """Отправка сообщения конкретному пользователю"""
        if user_id not in self.user_connections:
            return
        
        message_str = json.dumps(message)
        disconnected = []
        
        for connection in self.user_connections.get(user_id, set()):
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Ошибка отправки пользователю {user_id}: {e}")
                disconnected.append(connection)
        
        for conn in disconnected:
            self.disconnect(conn)
    
    async def broadcast_to_all(self, message: dict):
        """Отправка сообщения всем подключенным"""
        message_str = json.dumps(message)
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Ошибка широковещательной отправки: {e}")
                disconnected.append(connection)
        
        for conn in disconnected:
            self.disconnect(conn)
    
    def get_channel_stats(self) -> dict:
        """Статистика по каналам"""
        return {
            "total_connections": len(self.active_connections),
            "channels": {
                channel: len(connections)
                for channel, connections in self.channel_subscriptions.items()
            }
        }


# Глобальный менеджер подключений
manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket, token: str = None):
    """
    Основная точка подключения WebSocket
    Подключение: ws://host/ws?token=<access_token>
    """
    # Проверка токена
    if not token:
        await websocket.close(code=4001, reason="Token required")
        return
    
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4002, reason="Invalid token")
        return
    
    user_id = payload.get("user_id")
    if not user_id:
        await websocket.close(code=4003, reason="Invalid token payload")
        return
    
    # Подключение
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                msg_type = message.get("type")
                channel = message.get("channel")
                payload_data = message.get("payload", {})
                
                if msg_type == "subscribe" and channel:
                    manager.subscribe(websocket, channel)
                    await websocket.send_text(json.dumps({
                        "type": "subscribed",
                        "channel": channel,
                        "timestamp": datetime.utcnow().isoformat()
                    }))
                
                elif msg_type == "unsubscribe" and channel:
                    manager.unsubscribe(websocket, channel)
                    await websocket.send_text(json.dumps({
                        "type": "unsubscribed",
                        "channel": channel,
                        "timestamp": datetime.utcnow().isoformat()
                    }))
                
                elif msg_type == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    }))
                
                elif msg_type == "get_stats":
                    stats = manager.get_channel_stats()
                    await websocket.send_text(json.dumps({
                        "type": "stats",
                        "payload": stats,
                        "timestamp": datetime.utcnow().isoformat()
                    }))
                
                else:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": f"Unknown message type: {msg_type}",
                        "timestamp": datetime.utcnow().isoformat()
                    }))
            
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON",
                    "timestamp": datetime.utcnow().isoformat()
                }))
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Ошибка WebSocket: {e}")
        manager.disconnect(websocket)


# Функции для отправки событий из других модулей

async def send_telemetry_update(channel: str, data: dict):
    """Отправка обновления телеметрии"""
    await manager.broadcast_to_channel(channel, {
        "type": "telemetry_update",
        "channel": channel,
        "timestamp": datetime.utcnow().isoformat(),
        "payload": data
    })


async def send_alert(channel: str, alert_data: dict):
    """Отправка алерта"""
    await manager.broadcast_to_channel(channel, {
        "type": "alert",
        "channel": channel,
        "timestamp": datetime.utcnow().isoformat(),
        "payload": alert_data
    })


async def send_notification(user_id: int, notification_data: dict):
    """Отправка уведомления пользователю"""
    await manager.send_to_user(user_id, {
        "type": "notification",
        "channel": "notifications",
        "timestamp": datetime.utcnow().isoformat(),
        "payload": notification_data
    })


async def send_command_response(user_id: int, command: str, status: str, data: dict = None):
    """Отправка ответа на команду"""
    await manager.send_to_user(user_id, {
        "type": "command_response",
        "channel": "system",
        "timestamp": datetime.utcnow().isoformat(),
        "payload": {
            "command": command,
            "status": status,
            "data": data or {}
        }
    })
