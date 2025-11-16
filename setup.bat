@echo off
echo Setting up MTC E-commerce Server...

REM Copy environment file
if not exist .env (
    copy .env.example .env
    echo Created .env file from .env.example
) else (
    echo .env file already exists
)

echo.
echo Please update the .env file with your MongoDB connection string:
echo - For local MongoDB: mongodb://localhost:27017/mtc-ecommerce
echo - For MongoDB Atlas: your Atlas connection string
echo.
echo After updating .env, run: npm run dev
pause
