"""
API роуты для управления пользователями и ролями
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.db.database import get_db
from app.models.models import User, Role, NotificationSettings
from app.schemas.schemas import (
    UserResponse, UserCreate, UserUpdate,
    RoleResponse, RoleCreate, RoleUpdate
)
from app.utils.auth import get_current_user, get_current_active_admin, get_password_hash
from app.utils.logging import get_logger

logger = get_logger("users")

router = APIRouter(prefix="/users", tags=["Пользователи"])


@router.get("", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    """Список пользователей"""
    result = await db.execute(select(User).offset(skip).limit(limit))
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    """Информация о пользователе"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    return UserResponse.model_validate(user)


@router.post("", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    """Создание пользователя"""
    # Проверка существования
    result = await db.execute(
        select(User).where(
            (User.username == user_data.username) |
            (User.email == user_data.email)
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким именем или email уже существует"
        )
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role_id=user_data.role_id
    )
    
    db.add(new_user)
    
    # Создаем настройки уведомлений
    notif_settings = NotificationSettings(user_id=new_user.id)
    db.add(notif_settings)
    
    await db.commit()
    await db.refresh(new_user)
    
    logger.info(f"Администратор {current_user.username} создал пользователя {new_user.username}")
    
    return UserResponse.model_validate(new_user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    """Обновление пользователя"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    logger.info(f"Администратор {current_user.username} обновил пользователя {user.username}")
    
    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    """Удаление пользователя"""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить самого себя"
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    await db.delete(user)
    await db.commit()
    
    logger.info(f"Администратор {current_user.username} удалил пользователя {user.username}")
    
    return {"status": "success", "message": f"Пользователь {user.username} удален"}


# ==================== Roles ====================

roles_router = APIRouter(prefix="/roles", tags=["Роли"])


@roles_router.get("", response_model=List[RoleResponse])
async def get_roles(
    db: AsyncSession = Depends(get_db)
):
    """Список ролей"""
    result = await db.execute(select(Role))
    roles = result.scalars().all()
    
    if not roles:
        # Создаем дефолтные роли
        default_roles = [
            Role(name="admin", description="Администратор системы", permissions=["*"]),
            Role(name="operator", description="Оператор", permissions=["greenhouse:read", "greenhouse:write", "drones:read", "conveyor:read", "soil:read"]),
            Role(name="viewer", description="Наблюдатель", permissions=["greenhouse:read", "air:read", "drones:read", "conveyor:read", "soil:read"]),
            Role(name="maintenance", description="Технический специалист", permissions=["greenhouse:read", "greenhouse:write", "conveyor:read", "conveyor:write"])
        ]
        db.add_all(default_roles)
        await db.commit()
        return [RoleResponse.model_validate(r) for r in default_roles]
    
    return [RoleResponse.model_validate(r) for r in roles]


@roles_router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Информация о роли"""
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Роль не найдена"
        )
    
    return RoleResponse.model_validate(role)


@roles_router.post("", response_model=RoleResponse)
async def create_role(
    role_data: RoleCreate,
    current_user: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    """Создание роли"""
    result = await db.execute(select(Role).where(Role.name == role_data.name))
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Роль с таким именем уже существует"
        )
    
    new_role = Role(
        name=role_data.name,
        description=role_data.description,
        permissions=role_data.permissions
    )
    
    db.add(new_role)
    await db.commit()
    await db.refresh(new_role)
    
    logger.info(f"Администратор {current_user.username} создал роль {new_role.name}")
    
    return RoleResponse.model_validate(new_role)


@roles_router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    role_data: RoleUpdate,
    current_user: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    """Обновление роли"""
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Роль не найдена"
        )
    
    update_data = role_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(role, field, value)
    
    await db.commit()
    await db.refresh(role)
    
    logger.info(f"Администратор {current_user.username} обновил роль {role.name}")
    
    return RoleResponse.model_validate(role)


# ==================== Permissions ====================

permissions_router = APIRouter(prefix="/permissions", tags=["Разрешения"])


@permissions_router.get("")
async def get_permissions():
    """Список разрешений"""
    permissions = [
        {"name": "greenhouse:read", "description": "Чтение данных теплицы"},
        {"name": "greenhouse:write", "description": "Управление теплицей"},
        {"name": "air:read", "description": "Чтение данных воздуха"},
        {"name": "air:write", "description": "Управление порогами воздуха"},
        {"name": "drones:read", "description": "Чтение данных дронов"},
        {"name": "drones:write", "description": "Управление дронами"},
        {"name": "conveyor:read", "description": "Чтение данных конвейера"},
        {"name": "conveyor:write", "description": "Управление конвейером"},
        {"name": "soil:read", "description": "Чтение данных почвы"},
        {"name": "soil:write", "description": "Управление анализом почвы"},
        {"name": "users:read", "description": "Чтение данных пользователей"},
        {"name": "users:write", "description": "Управление пользователями"},
        {"name": "admin:*", "description": "Полный доступ администратора"}
    ]
    return {"permissions": permissions}
