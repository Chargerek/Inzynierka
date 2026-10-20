from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import appointments, auth, availability, doctors, health, services

app = FastAPI(
    title=settings.app_name,
    description="REST API — rezerwacje wizyt i dokumentacja dermatologiczna",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(services.router)
app.include_router(doctors.router)
app.include_router(availability.router)
app.include_router(appointments.router)
