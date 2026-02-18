"""
MQTT сервис для IoT устройств
"""
import asyncio
import json
from typing import Optional, Callable, Dict
from datetime import datetime
from gmqtt import Client as MQTTClient
from app.config import settings
from app.utils.logging import get_logger
from app.services.websocket import send_telemetry_update

logger = get_logger("mqtt")


class MQTTService:
    """Сервис для работы с MQTT"""
    
    def __init__(self):
        self.client: Optional[MQTTClient] = None
        self.is_connected = False
        self.message_handlers: Dict[str, Callable] = {}
        
        # MQTT топики
        self.topics = {
            "greenhouse_status": "ghouse/greenhouse/+/status",
            "greenhouse_command": "ghouse/greenhouse/+/command",
            "air_metrics": "ghouse/air/+/metrics",
            "drones_telemetry": "ghouse/drones/+/telemetry",
            "drones_command": "ghouse/drones/+/command",
            "conveyor_status": "ghouse/conveyor/status",
            "conveyor_command": "ghouse/conveyor/command",
            "soil_analysis": "ghouse/soil/+/analysis"
        }
    
    async def connect(self):
        """Подключение к MQTT брокеру"""
        try:
            self.client = MQTTClient(client_id=settings.MQTT_CLIENT_ID)
            
            self.client.on_connect = self._on_connect
            self.client.on_message = self._on_message
            self.client.on_disconnect = self._on_disconnect
            
            await self.client.connect(
                settings.MQTT_BROKER,
                port=settings.MQTT_PORT,
                username=settings.MQTT_USERNAME,
                password=settings.MQTT_PASSWORD
            )
            
            logger.info(f"Подключено к MQTT брокеру: {settings.MQTT_BROKER}:{settings.MQTT_PORT}")
            
        except Exception as e:
            logger.error(f"Ошибка подключения к MQTT: {e}")
            self.is_connected = False
    
    def _on_connect(self, client, flags, rc, properties):
        """Обработчик подключения"""
        self.is_connected = True
        logger.info("MQTT подключен")
        
        # Подписка на топики
        for topic_name, topic in self.topics.items():
            self.client.subscribe(topic)
            logger.debug(f"Подписка на топик: {topic}")
    
    def _on_message(self, client, topic, payload, qos, properties):
        """Обработчик входящих сообщений"""
        try:
            message = json.loads(payload) if payload else {}
            logger.debug(f"MQTT сообщение: topic={topic}, message={message}")
            
            # Маршрутизация сообщений
            if "greenhouse" in topic and "status" in topic:
                asyncio.create_task(self._handle_greenhouse_status(message))
            elif "air" in topic and "metrics" in topic:
                asyncio.create_task(self._handle_air_metrics(message))
            elif "drones" in topic and "telemetry" in topic:
                asyncio.create_task(self._handle_drone_telemetry(message))
            elif "conveyor" in topic and "status" in topic:
                asyncio.create_task(self._handle_conveyor_status(message))
            elif "soil" in topic and "analysis" in topic:
                asyncio.create_task(self._handle_soil_analysis(message))
            
        except json.JSONDecodeError:
            logger.error(f"Неверный JSON в MQTT сообщении: {payload}")
        except Exception as e:
            logger.error(f"Ошибка обработки MQTT сообщения: {e}")
    
    def _on_disconnect(self, client, packet, exc=None):
        """Обработчик отключения"""
        self.is_connected = False
        logger.warning("MQTT отключен")
    
    async def _handle_greenhouse_status(self, data: dict):
        """Обработка статуса теплицы"""
        await send_telemetry_update("greenhouse", {
            "system": data.get("system"),
            "value": data.get("value"),
            "status": data.get("status")
        })
    
    async def _handle_air_metrics(self, data: dict):
        """Обработка метрик воздуха"""
        await send_telemetry_update("air", {
            "temperature": data.get("temperature"),
            "humidity": data.get("humidity"),
            "co2": data.get("co2"),
            "pressure": data.get("pressure")
        })
    
    async def _handle_drone_telemetry(self, data: dict):
        """Обработка телеметрии дрона"""
        await send_telemetry_update("drones", {
            "drone_id": data.get("drone_id"),
            "battery": data.get("battery"),
            "gps": data.get("gps"),
            "altitude": data.get("altitude"),
            "speed": data.get("speed"),
            "status": data.get("status")
        })
    
    async def _handle_conveyor_status(self, data: dict):
        """Обработка статуса конвейера"""
        await send_telemetry_update("conveyor", {
            "is_running": data.get("is_running"),
            "speed": data.get("speed"),
            "items_transported": data.get("items_transported")
        })
    
    async def _handle_soil_analysis(self, data: dict):
        """Обработка анализа почвы"""
        await send_telemetry_update("soil", {
            "zone_id": data.get("zone_id"),
            "moisture": data.get("moisture"),
            "ph": data.get("ph"),
            "npk": data.get("npk"),
            "status": data.get("status")
        })
    
    async def publish(self, topic: str, message: dict):
        """Публикация сообщения"""
        if not self.is_connected or not self.client:
            logger.warning("MQTT не подключен, публикация невозможна")
            return
        
        payload = json.dumps(message)
        self.client.publish(topic, payload)
        logger.debug(f"MQTT публикация: topic={topic}, message={message}")
    
    async def send_command(self, device_type: str, device_id: str, command: str, params: dict = None):
        """Отправка команды устройству"""
        topic = f"ghouse/{device_type}/{device_id}/command"
        message = {
            "command": command,
            "parameters": params or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.publish(topic, message)
    
    async def disconnect(self):
        """Отключение от MQTT"""
        if self.client:
            await self.client.disconnect()
            logger.info("MQTT отключен")


# Глобальный сервис
mqtt_service = MQTTService()


async def init_mqtt():
    """Инициализация MQTT сервиса"""
    await mqtt_service.connect()


async def close_mqtt():
    """Закрытие MQTT сервиса"""
    await mqtt_service.disconnect()
