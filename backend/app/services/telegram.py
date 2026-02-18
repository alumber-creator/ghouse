"""
Telegram сервис для отправки уведомлений
"""
import asyncio
from typing import Optional, List
from datetime import datetime
import aiohttp
from app.config import settings
from app.utils.logging import get_logger

logger = get_logger("telegram_service")


class TelegramService:
    """Сервис для работы с Telegram Bot API"""
    
    def __init__(self):
        self.bot_token = settings.TELEGRAM_BOT_TOKEN
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None
        self.is_available = bool(self.bot_token)
    
    async def send_message(
        self,
        chat_id: str,
        text: str,
        parse_mode: str = "HTML",
        disable_notification: bool = False
    ) -> bool:
        """Отправка сообщения"""
        if not self.is_available:
            logger.warning("Telegram bot не настроен")
            return False
        
        url = f"{self.base_url}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_notification": disable_notification
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    result = await response.json()
                    
                    if result.get("ok"):
                        logger.info(f"Сообщение отправлено в Telegram: chat_id={chat_id}")
                        return True
                    else:
                        logger.error(f"Ошибка Telegram API: {result}")
                        return False
                        
        except Exception as e:
            logger.error(f"Ошибка отправки сообщения в Telegram: {e}")
            return False
    
    async def send_notification(
        self,
        chat_id: str,
        title: str,
        message: str,
        notification_type: str = "info"
    ) -> bool:
        """Отправка уведомления"""
        emoji = {
            "info": "ℹ️",
            "warning": "⚠️",
            "error": "❌",
            "success": "✅"
        }
        
        icon = emoji.get(notification_type, "ℹ️")
        
        text = (
            f"{icon} <b>{title}</b>\n\n"
            f"{message}\n\n"
            f"<i>GHouse Dashboard</i>\n"
            f"<code>{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}</code>"
        )
        
        return await self.send_message(chat_id, text)
    
    async def send_alert(
        self,
        chat_id: str,
        alert_type: str,
        description: str,
        value: float = None,
        threshold: float = None
    ) -> bool:
        """Отправка алерта"""
        value_str = ""
        if value is not None and threshold is not None:
            value_str = f"\nЗначение: <b>{value}</b> (порог: {threshold})"
        
        text = (
            f"🚨 <b>ТРЕВОГА: {alert_type}</b>\n\n"
            f"{description}"
            f"{value_str}\n\n"
            f"<i>Требуется немедленное внимание!</i>"
        )
        
        return await self.send_message(chat_id, text, disable_notification=False)
    
    async def send_daily_report(
        self,
        chat_id: str,
        report_data: dict
    ) -> bool:
        """Отправка ежедневного отчета"""
        date_str = datetime.utcnow().strftime("%d.%m.%Y")
        
        text = (
            f"📊 <b>Ежедневный отчет GHouse</b>\n"
            f"<code>{date_str}</code>\n\n"
        )
        
        # Теплица
        if "greenhouse" in report_data:
            gh = report_data["greenhouse"]
            text += (
                f"🏡 <b>Теплица:</b>\n"
                f"  • Полив: {gh.get('watering', 0)}%\n"
                f"  • Освещение: {gh.get('lighting', 0)}%\n"
                f"  • Вентиляция: {gh.get('ventilation', 0)}%\n\n"
            )
        
        # Воздух
        if "air" in report_data:
            air = report_data["air"]
            text += (
                f"🌡️ <b>Воздух:</b>\n"
                f"  • Температура: {air.get('temperature', 0)}°C\n"
                f"  • Влажность: {air.get('humidity', 0)}%\n"
                f"  • CO₂: {air.get('co2', 0)} ppm\n\n"
            )
        
        # Дроны
        if "drones" in report_data:
            drones = report_data["drones"]
            text += (
                f"🚁 <b>Дроны:</b>\n"
                f"  • Активных: {drones.get('active', 0)}\n"
                f"  • На зарядке: {drones.get('charging', 0)}\n"
                f"  • Миссий выполнено: {drones.get('missions_completed', 0)}\n\n"
            )
        
        # Конвейер
        if "conveyor" in report_data:
            conv = report_data["conveyor"]
            text += (
                f"📦 <b>Конвейер:</b>\n"
                f"  • Перевезено: {conv.get('items_transported', 0)}\n"
                f"  • Время работы: {conv.get('work_hours', 0)} ч\n"
                f"  • Эффективность: {conv.get('efficiency', 0)}%\n\n"
            )
        
        text += "<i>Система GHouse работает в штатном режиме</i>"
        
        return await self.send_message(chat_id, text)
    
    async def broadcast(
        self,
        chat_ids: List[str],
        text: str,
        parse_mode: str = "HTML"
    ) -> dict:
        """Массовая рассылка"""
        results = {"sent": 0, "failed": 0, "errors": []}
        
        for chat_id in chat_ids:
            success = await self.send_message(chat_id, text, parse_mode)
            if success:
                results["sent"] += 1
            else:
                results["failed"] += 1
                results["errors"].append(chat_id)
        
        logger.info(f"Рассылка завершена: отправлено={results['sent']}, ошибок={results['failed']}")
        return results
    
    async def get_me(self) -> Optional[dict]:
        """Получение информации о боте"""
        if not self.is_available:
            return None
        
        url = f"{self.base_url}/getMe"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    result = await response.json()
                    return result.get("result") if result.get("ok") else None
        except Exception as e:
            logger.error(f"Ошибка получения информации о боте: {e}")
            return None
    
    async def set_webhook(self, webhook_url: str) -> bool:
        """Установка webhook"""
        if not self.is_available:
            return False
        
        url = f"{self.base_url}/setWebhook"
        payload = {
            "url": webhook_url,
            "allowed_updates": ["message", "callback_query"]
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    result = await response.json()
                    return result.get("ok", False)
        except Exception as e:
            logger.error(f"Ошибка установки webhook: {e}")
            return False
    
    async def delete_webhook(self) -> bool:
        """Удаление webhook"""
        if not self.is_available:
            return False
        
        url = f"{self.base_url}/deleteWebhook"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url) as response:
                    result = await response.json()
                    return result.get("ok", False)
        except Exception as e:
            logger.error(f"Ошибка удаления webhook: {e}")
            return False


# Глобальный сервис
telegram_service = TelegramService()


async def init_telegram():
    """Инициализация Telegram сервиса"""
    if telegram_service.is_available:
        bot_info = await telegram_service.get_me()
        if bot_info:
            logger.info(f"Telegram bot инициализирован: @{bot_info.get('username')}")
        else:
            logger.warning("Не удалось подключиться к Telegram Bot API")
    else:
        logger.warning("Telegram bot не настроен (отсутствует токен)")
