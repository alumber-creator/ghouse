"""
API роуты для аутентификации
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from app.db.database import get_db
from app.models.models import User, Role
from app.schemas.schemas import (
    Token, LoginRequest, UserResponse, UserCreate, PasswordChange
)
from app.utils.auth import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token,
    get_current_user, get_current_active_admin
)
from app.utils.logging import get_logger

logger = get_logger("auth")

router = APIRouter(prefix="/auth", tags=["Аутентификация"])


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Вход пользователя"""
    result = await db.execute(
        select(User).where(User.username == form_data.username)
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        logger.warning(f"Неверная попытка входа для пользователя: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверное имя пользователя или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь деактивирован"
        )
    
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id}
    )
    refresh_token = create_refresh_token(
        data={"sub": user.username, "user_id": user.id}
    )
    
    logger.info(f"Пользователь {user.username} успешно вошел в систему")
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=3600,
        user=UserResponse.model_validate(user)
    )


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user)
):
    """Выход пользователя"""
    logger.info(f"Пользователь {current_user.username} вышел из системы")
    return {"message": "Выход выполнен успешно"}


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
):
    """Обновление токена"""
    from app.utils.auth import decode_token
    
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный refresh токен"
        )
    
    username = payload.get("sub")
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден"
        )
    
    new_access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id}
    )
    new_refresh_token = create_refresh_token(
        data={"sub": user.username, "user_id": user.id}
    )
    
    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        expires_in=3600,
        user=UserResponse.model_validate(user)
    )


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    current_user: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    """Регистрация нового пользователя (только админ)"""
    # Проверка существования пользователя
    result = await db.execute(
        select(User).where(
            (User.username == user_data.username) | 
            (User.email == user_data.email)
        )
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким именем или email уже существует"
        )
    
    # Создание пользователя
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role_id=user_data.role_id
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    logger.info(f"Администратор {current_user.username} создал пользователя {new_user.username}")
    
    return UserResponse.model_validate(new_user)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Текущий пользователь"""
    return UserResponse.model_validate(current_user)


@router.put("/password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Смена пароля"""
    if not verify_password(password_data.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный текущий пароль"
        )
    
    current_user.password_hash = get_password_hash(password_data.new_password)
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} сменил пароль")
    
    return {"message": "Пароль успешно изменен"}
